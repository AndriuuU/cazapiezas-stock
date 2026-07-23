import { NextResponse } from "next/server";
import { recordAuditEventsSafely } from "@/lib/almacen-desguace-auditoria";
import { withPublicPhotos } from "@/lib/almacen-desguace-data";
import { buildCatPayload, getRecambioFacilConfig, insertCatPiecesBatch, validateCatPiece, type CatBatchItemResponse } from "@/lib/recambio-facil-api";
import { protectApiOrPostmanRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { PiezaDesguace } from "@/types/almacen-desguace";

type PublicationResult = { id: number; codigo: string; reason?: string; error?: string; publishedExternally?: boolean };

function normalizeIds(body: { id?: unknown; ids?: unknown }) {
  const source = Array.isArray(body.ids) ? body.ids : body.id === undefined ? [] : [body.id];
  return [...new Set(source.map(Number).filter((id) => Number.isInteger(id) && id > 0))];
}

async function markOnline(pieces: PiezaDesguace[], url: string, key: string, config: ReturnType<typeof getRecambioFacilConfig>) {
  const updated = await Promise.all(pieces.map(async (piece) => {
    const updateParams = new URLSearchParams({ id: `eq.${piece.id}`, select: "id" });
    const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${updateParams}`, {
      method: "PATCH",
      headers: supabaseHeaders(key, { Prefer: "return=representation" }),
      body: JSON.stringify({
        publicado_online: true,
        codigo_recambio_facil: buildCatPayload(piece, config).Codigo,
      }),
    });
    if (!response.ok) throw new Error((await response.text()).slice(0, 250));
    const rows = await response.json() as Array<{ id: number }>;
    return rows[0]?.id;
  }));
  if (updated.some((id) => !id)) throw new Error("No se pudieron confirmar todas las piezas en la base de datos.");
}

export async function POST(request: Request) {
  const guard = await protectApiOrPostmanRequest(request, { keyPrefix: "desguace:rf-publish", limit: 20, windowMs: 60_000 });
  if (guard) return guard;

  let auditPieces: PiezaDesguace[] = [];
  try {
    const ids = normalizeIds(await request.json() as { id?: unknown; ids?: unknown });
    if (!ids.length) return NextResponse.json({ error: "Selecciona al menos una pieza." }, { status: 400 });
    if (ids.length > 50) return NextResponse.json({ error: "Se pueden publicar hasta 50 piezas por petición." }, { status: 400 });

    const recambioConfig = getRecambioFacilConfig();
    const { url, key } = getSupabaseApiConfig();
    const selectParams = new URLSearchParams({
      select: "*,fotos:almacen_desguace_fotos(*)",
      id: `in.(${ids.join(",")})`,
      limit: "50",
    });
    const selectedResponse = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${selectParams}`, {
      headers: supabaseHeaders(key), cache: "no-store",
    });
    const selected = await parseSupabaseResponse<PiezaDesguace[]>(selectedResponse);
    const byId = new Map(selected.map((piece) => [piece.id, piece]));
    const missingIds = ids.filter((id) => !byId.has(id));
    if (missingIds.length) return NextResponse.json({ error: "Alguna pieza seleccionada ya no existe. Actualiza el listado." }, { status: 409 });

    const pieces = await Promise.all(ids.map((id) => withPublicPhotos(byId.get(id)!)));
    auditPieces = pieces;
    if (!recambioConfig.apiKey) {
      const configError = "Falta configurar RECAMBIO_FACIL_API_KEY.";
      await recordAuditEventsSafely(pieces.map((piece) => ({
        pieza_id: piece.id,
        pieza_codigo: piece.codigo_interno,
        pieza_nombre: piece.nombre_pieza,
        cajon_id: piece.cajon_id,
        tipo_evento: "publicacion_rf",
        accion: "Error al publicar en R/F",
        campos_cambiados: [],
        valor_anterior: { publicado_online: piece.publicado_online },
        valor_nuevo: { publicado_online: piece.publicado_online },
        exito: false,
        error: configError,
        detalle: "No se inició la publicación porque falta la credencial de Recambio Fácil.",
        origen: "recambio_facil",
      })));
      return NextResponse.json({ error: configError }, { status: 500 });
    }
    const published: PublicationResult[] = [];
    const skipped: PublicationResult[] = [];
    const failed: PublicationResult[] = [];
    const ready: PiezaDesguace[] = [];

    for (const piece of pieces) {
      if (piece.publicado_online) {
        skipped.push({ id: piece.id, codigo: piece.codigo_interno, reason: "Ya estaba online." });
        continue;
      }
      if (piece.estado_proceso === "Vendida" || piece.estado_proceso === "Retirada") {
        failed.push({ id: piece.id, codigo: piece.codigo_interno, error: `La pieza está ${piece.estado_proceso.toLowerCase()} y no se puede publicar.` });
        continue;
      }
      const missing = validateCatPiece(piece, recambioConfig);
      if (missing.length) {
        failed.push({ id: piece.id, codigo: piece.codigo_interno, error: `Faltan: ${missing.join(", ")}.` });
        continue;
      }
      ready.push(piece);
    }

    for (let index = 0; index < ready.length; index += 10) {
        const batch = ready.slice(index, index + 10);
        try {
          const batchResponse = await insertCatPiecesBatch(batch, recambioConfig);
          const responseItems = Array.isArray(batchResponse.body) ? batchResponse.body as CatBatchItemResponse[] : [];
          const byExternalCode = new Map(responseItems.map((item) => [String(item.Pieza), item]));
          const created: PiezaDesguace[] = [];
          const alreadyInserted: PiezaDesguace[] = [];

          for (const piece of batch) {
            const payload = buildCatPayload(piece, recambioConfig);
            const item = byExternalCode.get(payload.Codigo);
            if (!responseItems.length && batchResponse.status === 200) {
              created.push(piece);
            } else if (item?.Estado === 200) {
              created.push(piece);
            } else if (item && /ya est[aá] insertad/i.test(item.Mensaje || "")) {
              alreadyInserted.push(piece);
            } else {
              failed.push({
                id: piece.id,
                codigo: piece.codigo_interno,
                error: `${item?.Mensaje || "Recambio Fácil no devolvió el resultado de esta pieza."} · Código enviado: ${payload.Codigo} · Referencia enviada: ${payload.Referencia || "sin referencia"}`,
              });
            }
          }

          const accepted = [...created, ...alreadyInserted];
          if (accepted.length) {
            try {
              await markOnline(accepted, url, key, recambioConfig);
              published.push(...created.map((piece) => ({ id: piece.id, codigo: piece.codigo_interno })));
              skipped.push(...alreadyInserted.map((piece) => ({ id: piece.id, codigo: piece.codigo_interno, reason: "Ya estaba insertada en Recambio Fácil; se ha sincronizado como Online." })));
            } catch (error) {
              const detail = error instanceof Error ? error.message : "Error desconocido al actualizar la base de datos.";
              failed.push(...accepted.map((piece) => ({ id: piece.id, codigo: piece.codigo_interno, error: `Publicada en Recambio Fácil, pero no se pudo marcar online: ${detail}`, publishedExternally: true })));
            }
          }
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Error desconocido al publicar el lote.";
          if (batch.length > 1 && /(?:batch respondi[oó] 500|respondi[oó] 500 al publicar el lote)/i.test(detail)) {
            for (const piece of batch) {
              const payload = buildCatPayload(piece, recambioConfig);
              try {
                const retry = await insertCatPiecesBatch([piece], recambioConfig);
                const items = Array.isArray(retry.body) ? retry.body as CatBatchItemResponse[] : [];
                const item = items.find((candidate) => String(candidate.Pieza) === payload.Codigo);
                const createdNow = (!items.length && retry.status === 200) || item?.Estado === 200;
                const existed = Boolean(item && /ya est[aá] insertad/i.test(item.Mensaje || ""));
                if (!createdNow && !existed) {
                  failed.push({ id: piece.id, codigo: piece.codigo_interno, error: `${item?.Mensaje || "Recambio Fácil no devolvió el resultado de esta pieza."} · Código enviado: ${payload.Codigo} · Referencia enviada: ${payload.Referencia || "sin referencia"}` });
                  continue;
                }
                try {
                  await markOnline([piece], url, key, recambioConfig);
                  if (createdNow) published.push({ id: piece.id, codigo: piece.codigo_interno });
                  else skipped.push({ id: piece.id, codigo: piece.codigo_interno, reason: "Ya estaba insertada en Recambio Fácil; se ha sincronizado como Online." });
                } catch (databaseError) {
                  const databaseDetail = databaseError instanceof Error ? databaseError.message : "Error desconocido al actualizar la base de datos.";
                  failed.push({ id: piece.id, codigo: piece.codigo_interno, error: `Publicada en Recambio Fácil, pero no se pudo marcar online: ${databaseDetail}`, publishedExternally: true });
                }
              } catch (retryError) {
                const retryDetail = retryError instanceof Error ? retryError.message : "Error desconocido al reintentar individualmente.";
                failed.push({ id: piece.id, codigo: piece.codigo_interno, error: `${retryDetail} · Código enviado: ${payload.Codigo} · Referencia enviada: ${payload.Referencia || "sin referencia"}` });
              }
            }
            continue;
          }
          failed.push(...batch.map((piece) => {
            const payload = buildCatPayload(piece, recambioConfig);
            return { id: piece.id, codigo: piece.codigo_interno, error: `${detail} · Código enviado: ${payload.Codigo} · Referencia enviada: ${payload.Referencia || "sin referencia"}` };
          }));
        }
    }

    const pieceById = new Map(pieces.map((piece) => [piece.id, piece]));
    await recordAuditEventsSafely([
      ...published.map((result) => {
        const piece = pieceById.get(result.id)!;
        return {
          pieza_id: piece.id,
          pieza_codigo: piece.codigo_interno,
          pieza_nombre: piece.nombre_pieza,
          cajon_id: piece.cajon_id,
          tipo_evento: "publicacion_rf" as const,
          accion: "Publicación correcta en R/F",
          campos_cambiados: ["publicado_online"],
          valor_anterior: { publicado_online: false },
          valor_nuevo: { publicado_online: true },
          detalle: "Recambio Fácil confirmó la publicación de la pieza.",
          origen: "recambio_facil",
        };
      }),
      ...skipped.map((result) => {
        const piece = pieceById.get(result.id)!;
        const synchronized = /insertada en Recambio F[aá]cil/i.test(result.reason || "");
        return {
          pieza_id: piece.id,
          pieza_codigo: piece.codigo_interno,
          pieza_nombre: piece.nombre_pieza,
          cajon_id: piece.cajon_id,
          tipo_evento: "publicacion_rf" as const,
          accion: synchronized ? "Ya existía en R/F · sincronizada Online" : "Publicación omitida · ya estaba Online",
          campos_cambiados: synchronized ? ["publicado_online"] : [],
          valor_anterior: { publicado_online: piece.publicado_online },
          valor_nuevo: { publicado_online: true },
          detalle: result.reason || "La pieza ya constaba como Online.",
          origen: "recambio_facil",
          metadata: { ya_existia: true },
        };
      }),
      ...failed.map((result) => {
        const piece = pieceById.get(result.id)!;
        return {
          pieza_id: piece.id,
          pieza_codigo: piece.codigo_interno,
          pieza_nombre: piece.nombre_pieza,
          cajon_id: piece.cajon_id,
          tipo_evento: "publicacion_rf" as const,
          accion: "Error al publicar en R/F",
          campos_cambiados: [],
          valor_anterior: { publicado_online: piece.publicado_online },
          valor_nuevo: { publicado_online: piece.publicado_online },
          exito: false,
          error: result.error || "Recambio Fácil no confirmó la publicación.",
          detalle: result.publishedExternally
            ? "La pieza pudo publicarse externamente, pero no se confirmó como Online en la aplicación."
            : "La pieza no se marcó como Online.",
          origen: "recambio_facil",
          metadata: { publicada_externamente: Boolean(result.publishedExternally) },
        };
      }),
    ]);

    return NextResponse.json({ requested: ids.length, published, skipped, failed }, { status: failed.length ? 207 : 200 });
  } catch (error) {
    const detail = error instanceof Error ? error.message : "No se pudieron publicar las piezas en Recambio Fácil.";
    await recordAuditEventsSafely(auditPieces.map((piece) => ({
      pieza_id: piece.id,
      pieza_codigo: piece.codigo_interno,
      pieza_nombre: piece.nombre_pieza,
      cajon_id: piece.cajon_id,
      tipo_evento: "publicacion_rf",
      accion: "Error inesperado al publicar en R/F",
      campos_cambiados: [],
      valor_anterior: { publicado_online: piece.publicado_online },
      valor_nuevo: { publicado_online: piece.publicado_online },
      exito: false,
      error: detail,
      detalle: "La petición de publicación no pudo completarse.",
      origen: "recambio_facil",
    })));
    return NextResponse.json({ error: detail }, { status: 500 });
  }
}
