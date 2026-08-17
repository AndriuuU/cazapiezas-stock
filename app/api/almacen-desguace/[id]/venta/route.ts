import { NextResponse } from "next/server";
import { getAuditHistory, recordAuditEvents } from "@/lib/almacen-desguace-auditoria";
import { getPieza } from "@/lib/almacen-desguace-data";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EstadoProceso, EventoAlmacen, PiezaDesguace } from "@/types/almacen-desguace";

type Context = { params: Promise<{ id: string }> };

type PreviousPieceState = {
  estado_proceso: EstadoProceso;
  precio_venta: number | null;
  ubicacion: string | null;
  cajon_id: number | null;
  publicado_online: boolean;
};

function previousState(piece: PiezaDesguace): PreviousPieceState {
  return {
    estado_proceso: piece.estado_proceso,
    precio_venta: piece.precio_venta,
    ubicacion: piece.ubicacion,
    cajon_id: piece.cajon_id,
    publicado_online: piece.publicado_online,
  };
}

async function updatePiece(id: string, patch: Record<string, unknown>, processFilter?: string) {
  const { url, key } = getSupabaseApiConfig();
  const params = new URLSearchParams({ id: `eq.${id}`, select: "*" });
  if (processFilter) params.set("estado_proceso", processFilter);
  const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
    method: "PATCH",
    headers: supabaseHeaders(key, { Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  return { response, rows: response.ok ? await parseSupabaseResponse<PiezaDesguace[]>(response) : [] };
}

function saleOperation(event: EventoAlmacen) {
  return String(event.metadata?.operacion || "");
}

export async function POST(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:sale", limit: 30, windowMs: 60_000 });
  if (guard) return guard;

  try {
    const { id } = await context.params;
    const piece = await getPieza(id);
    if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    if (piece.estado_proceso === "Vendida") return NextResponse.json({ error: "Esta pieza ya figura como vendida." }, { status: 409 });
    if (piece.estado_proceso === "Retirada") return NextResponse.json({ error: "Una pieza retirada no se puede vender sin devolverla antes al almacén." }, { status: 409 });

    const body = await request.json() as Record<string, unknown>;
    const employee = String(body.empleado || "").trim();
    const notes = String(body.observaciones || "").trim();
    const paymentMethod = String(body.forma_pago || "No indicada").trim();
    const price = Number(body.precio_final);
    const saleDate = new Date(String(body.fecha_venta || ""));

    if (employee.length < 2 || employee.length > 100) return NextResponse.json({ error: "Indica el empleado que registra la venta." }, { status: 400 });
    if (!Number.isFinite(price) || price < 0 || price > 999999.99) return NextResponse.json({ error: "El precio final no es válido." }, { status: 400 });
    if (Number.isNaN(saleDate.getTime())) return NextResponse.json({ error: "La fecha de venta no es válida." }, { status: 400 });
    if (saleDate.getTime() > Date.now() + 5 * 60_000) return NextResponse.json({ error: "La fecha de venta no puede estar en el futuro." }, { status: 400 });
    if (notes.length > 2000) return NextResponse.json({ error: "Las observaciones no pueden superar los 2.000 caracteres." }, { status: 400 });
    if (paymentMethod.length < 2 || paymentMethod.length > 50) return NextResponse.json({ error: "La forma de pago no es válida." }, { status: 400 });

    const before = previousState(piece);
    const patch = {
      estado_proceso: "Vendida",
      precio_venta: Math.round(price * 100) / 100,
      publicado_online: false,
      ubicacion: null,
      cajon_id: null,
    };
    const update = await updatePiece(id, patch, "not.in.(Vendida,Retirada)");
    if (!update.response.ok) {
      const problem = await update.response.json().catch(() => null);
      return NextResponse.json({ error: problem?.message || problem?.error || "No se pudo registrar la venta." }, { status: 409 });
    }
    const updated = update.rows[0];
    if (!updated) return NextResponse.json({ error: "La pieza cambió mientras registrabas la venta. Actualiza el listado." }, { status: 409 });

    try {
      await recordAuditEvents([{
        pieza_id: piece.id,
        pieza_codigo: piece.codigo_interno,
        pieza_nombre: piece.nombre_pieza,
        cajon_id: before.cajon_id,
        tipo_evento: "edicion_pieza",
        accion: "Venta registrada",
        campos_cambiados: ["fecha_venta", "empleado", "precio_final", "forma_pago", "observaciones"],
        valor_anterior: before,
        valor_nuevo: {
          fecha_venta: saleDate.toISOString(),
          empleado: employee,
          precio_final: patch.precio_venta,
          forma_pago: paymentMethod,
          observaciones: notes || null,
        },
        detalle: `Venta registrada por ${employee}. La ubicación${before.cajon_id ? " y el espacio del cajón" : ""} quedó libre.`,
        origen: "flujo de venta",
        usuario_nombre: employee,
        metadata: { operacion: "venta", version: 1 },
      }]);
    } catch (auditError) {
      await updatePiece(id, before);
      throw new Error(`No se pudo guardar el historial de la venta. No se ha aplicado ningún cambio. ${auditError instanceof Error ? auditError.message : ""}`.trim());
    }

    return NextResponse.json({ piece: updated, message: `${piece.codigo_interno} vendida por ${patch.precio_venta.toFixed(2)} €.` });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo registrar la venta." }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "desguace:undo-sale", limit: 30, windowMs: 60_000 });
  if (guard) return guard;

  try {
    const { id } = await context.params;
    const piece = await getPieza(id);
    if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    if (piece.estado_proceso !== "Vendida") return NextResponse.json({ error: "Esta pieza no figura como vendida." }, { status: 409 });

    const history = await getAuditHistory({ pieceId: id, limit: 200 });
    const latestTrackedOperation = history.find((event) => ["venta", "venta_anulada"].includes(saleOperation(event)));
    if (latestTrackedOperation && saleOperation(latestTrackedOperation) === "venta_anulada") {
      return NextResponse.json({ error: "No se encontró una venta activa que se pueda deshacer." }, { status: 409 });
    }
    const legacySale = history.find((event) =>
      event.tipo_evento === "cambio_proceso"
      && String(event.valor_nuevo?.estado_proceso || "") === "Vendida"
    );
    const latestSaleOperation = latestTrackedOperation || legacySale;
    if (!latestSaleOperation) return NextResponse.json({ error: "No se encontró el historial anterior a la venta." }, { status: 409 });

    const saved = latestSaleOperation.valor_anterior || {};
    const restore: PreviousPieceState = {
      estado_proceso: String(saved.estado_proceso || "Pendiente de identificar") as EstadoProceso,
      precio_venta: saved.precio_venta == null ? null : Number(saved.precio_venta),
      ubicacion: saved.ubicacion ? String(saved.ubicacion) : null,
      cajon_id: saved.cajon_id == null ? null : Number(saved.cajon_id),
      publicado_online: Boolean(saved.publicado_online),
    };

    let restoredStorage = true;
    let update = await updatePiece(id, restore, "eq.Vendida");
    if (!update.response.ok) {
      restoredStorage = false;
      const safeProcess: EstadoProceso = ["Publicada", "Lista para publicar"].includes(restore.estado_proceso)
        ? "Pendiente de identificar"
        : restore.estado_proceso;
      update = await updatePiece(id, {
        ...restore,
        estado_proceso: safeProcess,
        publicado_online: false,
        ubicacion: null,
        cajon_id: null,
      }, "eq.Vendida");
    }
    if (!update.response.ok) {
      const problem = await update.response.json().catch(() => null);
      return NextResponse.json({ error: problem?.message || problem?.error || "No se pudo deshacer la venta." }, { status: 409 });
    }

    const updated = update.rows[0];
    if (!updated) return NextResponse.json({ error: "La pieza cambió mientras deshacías la venta. Actualiza el listado." }, { status: 409 });
    await recordAuditEvents([{
      pieza_id: piece.id,
      pieza_codigo: piece.codigo_interno,
      pieza_nombre: piece.nombre_pieza,
      cajon_id: updated.cajon_id,
      tipo_evento: "edicion_pieza",
      accion: "Venta deshecha",
      campos_cambiados: ["estado_proceso", "precio_venta", "ubicacion", "cajon_id", "publicado_online"],
      valor_anterior: previousState(piece),
      valor_nuevo: previousState(updated),
      detalle: restoredStorage
        ? "Se anuló la venta accidental y se restauró el estado anterior, incluida su ubicación."
        : "Se anuló la venta, pero la ubicación anterior ya no estaba disponible. La pieza queda pendiente de ubicar.",
      origen: "flujo de venta",
      metadata: { operacion: "venta_anulada", venta_evento_id: latestSaleOperation.id, ubicacion_restaurada: restoredStorage },
    }]);

    return NextResponse.json({
      piece: updated,
      restoredStorage,
      message: restoredStorage
        ? `${piece.codigo_interno} ha vuelto al almacén y recuperó su ubicación anterior.`
        : `${piece.codigo_interno} ha vuelto al almacén, pero debes asignarle una nueva ubicación.`,
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo deshacer la venta." }, { status: 500 });
  }
}
