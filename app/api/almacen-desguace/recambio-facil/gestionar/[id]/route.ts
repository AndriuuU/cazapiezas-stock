import { NextResponse } from "next/server";
import { recordAuditEventsSafely } from "@/lib/almacen-desguace-auditoria";
import { getPieza, withPublicPhotos } from "@/lib/almacen-desguace-data";
import {
  deleteCatPiece,
  getCatPiece,
  getRecambioFacilCode,
  getRecambioFacilConfig,
  recambioFacilCentsToEuros,
  RecambioFacilRequestError,
  updateCatPiece,
  validateCatPiece,
  type CatRemotePiece,
} from "@/lib/recambio-facil-api";
import { protectAdminApiOrPostmanRequest, protectApiOrPostmanRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { PiezaDesguace, PiezaDesguaceInput } from "@/types/almacen-desguace";

type Context = { params: Promise<{ id: string }> };
type Operation = "consulta" | "actualizacion" | "eliminacion";

async function loadPiece(rawId: string) {
  const id = Number(rawId);
  if (!Number.isInteger(id) || id < 1) return null;
  const piece = await getPieza(id);
  return piece ? withPublicPhotos(piece) : null;
}

async function updateLocalPiece(piece: PiezaDesguace, existsInRecambioFacil: boolean, externalCode?: string) {
  const patch: PiezaDesguaceInput = { publicado_online: existsInRecambioFacil };
  if (existsInRecambioFacil && externalCode) patch.codigo_recambio_facil = externalCode;
  if (existsInRecambioFacil && piece.estado_proceso === "Lista para publicar") patch.estado_proceso = "Publicada";
  if (!existsInRecambioFacil && piece.estado_proceso === "Publicada") patch.estado_proceso = "Lista para publicar";

  const { url, key } = getSupabaseApiConfig();
  const params = new URLSearchParams({ id: `eq.${piece.id}`, select: "*" });
  const response = await fetch(`${url}/rest/v1/almacen_desguace_piezas?${params}`, {
    method: "PATCH",
    headers: supabaseHeaders(key, { Prefer: "return=representation" }),
    body: JSON.stringify(patch),
  });
  const rows = await parseSupabaseResponse<PiezaDesguace[]>(response);
  if (!rows[0]) throw new Error("La pieza ya no existe en Cazapiezas.");
  return rows[0];
}

function remoteSummary(remote: CatRemotePiece | null) {
  if (!remote) return null;
  const value = (...aliases: string[]) => {
    const entries = Object.entries(remote);
    for (const alias of aliases) {
      const exact = remote[alias];
      if (exact !== undefined) return exact;
      const found = entries.find(([key]) => key.toLocaleLowerCase("es") === alias.toLocaleLowerCase("es"));
      if (found) return found[1];
    }
    return null;
  };
  const price = (...aliases: string[]) => recambioFacilCentsToEuros(value(...aliases));
  return {
    Codigo: value("Codigo", "referenciaDMS"),
    Idcliente: value("Idcliente", "idcliente"),
    Referencia: value("Referencia", "referencia"),
    Referencia2: value("Referencia2", "referencia2"),
    Referencia3: value("Referencia3", "referencia3"),
    Descripcion: value("Descripcion", "descripcion"),
    Stock: value("Stock", "stock"),
    Precio: price("Precio", "preciocalculado"),
    Estado: value("Estado", "estado"),
    ImporteCasco: price("ImporteCasco", "importecasco"),
    ClaveDescuento: value("ClaveDescuento", "clavedescuento"),
    Fechabase: value("Fechabase", "fechabase"),
    PrecioPM: price("PrecioPM", "preciopm"),
    FechaUltimaEntrada: value("FechaUltimaEntrada", "fechaultimaentrada"),
    FechaUltimaSalida: value("FechaUltimaSalida", "fechaultimasalida"),
    FechaUltimoMovimiento: value("FechaUltimoMovimiento", "fechaultimomovimiento"),
    Ubicacion: value("Ubicacion", "ubicacion"),
    UbicacionEstanteria: value("UbicacionEstanteria", "ubicacionestanteria"),
    PrecioPVP: price("PrecioPVP", "preciopvp"),
    PrecioPUE: price("PrecioPUE", "preciopue"),
    Almacen: value("Almacen", "almacen"),
    Peso: value("Peso", "peso"),
    Observaciones: value("Observaciones", "observaciones"),
    Marca: value("Marca", "marca"),
    Modelo: value("Modelo", "modelo"),
    Puertas: value("Puertas", "puertas"),
    Kilometraje: value("Kilometraje", "kilometraje"),
    Vehiculo: value("Vehiculo", "vehiculo"),
    Bastidor: value("Bastidor", "Chasis", "chasis"),
    Matricula: value("Matricula", "matricula"),
    CodigoMotor: value("CodigoMotor", "codigomotor"),
    Combustible: value("Combustible", "combustible"),
    Color: value("Color", "color"),
    AnoStock: value("AnoStock", "Anno", "anno"),
    Familia: value("Familia", "familia"),
    Articulo: value("Articulo", "tipoArticulo"),
    ModeloInicio: value("ModeloInicio", "modeloAnoInicio"),
    ModeloFin: value("ModeloFin", "modeloAnoFin"),
    Version: value("Version", "version"),
    CodigoCambio: value("CodigoCambio", "codigocambio"),
    AnoVehiculo: value("AnoVehiculo", "anovehiculo"),
    Imagenes: value("Imagenes", "imagenes"),
    Sede: value("Sede", "sede"),
  };
}

async function auditOperation(options: {
  piece: PiezaDesguace;
  operation: Operation;
  externalCode: string;
  success: boolean;
  detail: string;
  error?: string;
  beforeOnline?: boolean;
  afterOnline?: boolean;
  remote?: CatRemotePiece | null;
  metadata?: Record<string, unknown>;
}) {
  const labels: Record<Operation, string> = {
    consulta: options.success ? "Comprobación de pieza en R/F" : "Error al comprobar la pieza en R/F",
    actualizacion: options.success ? "Pieza actualizada en R/F" : "Error al actualizar la pieza en R/F",
    eliminacion: options.success ? "Pieza eliminada de R/F" : "Error al eliminar la pieza de R/F",
  };
  const onlineChanged = options.beforeOnline !== undefined
    && options.afterOnline !== undefined
    && options.beforeOnline !== options.afterOnline;
  await recordAuditEventsSafely([{
    pieza_id: options.piece.id,
    pieza_codigo: options.piece.codigo_interno,
    pieza_nombre: options.piece.nombre_pieza,
    cajon_id: options.piece.cajon_id,
    tipo_evento: "publicacion_rf",
    accion: labels[options.operation],
    campos_cambiados: onlineChanged ? ["publicado_online"] : [],
    valor_anterior: options.beforeOnline === undefined ? null : { publicado_online: options.beforeOnline },
    valor_nuevo: {
      ...(options.afterOnline === undefined ? {} : { publicado_online: options.afterOnline }),
      ...(options.remote ? { recambio_facil: remoteSummary(options.remote) } : {}),
    },
    exito: options.success,
    detalle: options.detail,
    error: options.error ?? null,
    origen: "recambio_facil",
    metadata: { operacion: options.operation, codigo_rf: options.externalCode, ...options.metadata },
  }]);
}

function configOrError() {
  const config = getRecambioFacilConfig();
  if (!config.apiKey) throw new Error("Falta configurar RECAMBIO_FACIL_API_KEY.");
  return config;
}

function externalErrorResponse(error: unknown, fallback: string) {
  const message = error instanceof Error ? error.message : fallback;
  const status = error instanceof RecambioFacilRequestError
    ? error.status === 400 || error.status === 401 || error.status === 404 ? error.status : 502
    : 500;
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: Request, context: Context) {
  const guard = await protectApiOrPostmanRequest(request, { keyPrefix: "desguace:rf-check", limit: 40, windowMs: 60_000 });
  if (guard) return guard;

  let piece: PiezaDesguace | null = null;
  let externalCode = "";
  try {
    const { id } = await context.params;
    piece = await loadPiece(id);
    if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    const config = configOrError();
    externalCode = getRecambioFacilCode(piece, config);
    const result = await getCatPiece(piece, config);
    const exists = Boolean(result.piece);
    const updated = await updateLocalPiece(piece, exists, exists ? externalCode : undefined);
    await auditOperation({
      piece,
      operation: "consulta",
      externalCode,
      success: true,
      detail: exists
        ? "Recambio Fácil confirmó que la pieza está publicada."
        : "Recambio Fácil confirmó que la pieza no existe o ya no está publicada.",
      beforeOnline: piece.publicado_online,
      afterOnline: exists,
      remote: result.piece,
    });
    return NextResponse.json({
      exists,
      externalCode,
      remote: remoteSummary(result.piece),
      local: { publicado_online: updated.publicado_online, estado_proceso: updated.estado_proceso },
      message: exists ? "La pieza está publicada en Recambio Fácil." : "La pieza no está publicada en Recambio Fácil.",
    });
  } catch (error) {
    if (piece) {
      await auditOperation({
        piece,
        operation: "consulta",
        externalCode,
        success: false,
        detail: "No se pudo completar la comprobación en Recambio Fácil.",
        error: error instanceof Error ? error.message : "Error desconocido.",
      });
    }
    return externalErrorResponse(error, "No se pudo comprobar la pieza en Recambio Fácil.");
  }
}

export async function PUT(request: Request, context: Context) {
  const guard = await protectAdminApiOrPostmanRequest(request, { keyPrefix: "desguace:rf-update", limit: 20, windowMs: 60_000 });
  if (guard) return guard;

  let piece: PiezaDesguace | null = null;
  let externalCode = "";
  let updatedExternally = false;
  try {
    const { id } = await context.params;
    piece = await loadPiece(id);
    if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    if (piece.estado_proceso === "Vendida" || piece.estado_proceso === "Retirada") {
      const stateError = `La pieza está ${piece.estado_proceso.toLowerCase()} y no se puede actualizar en R/F.`;
      await auditOperation({
        piece,
        operation: "actualizacion",
        externalCode,
        success: false,
        detail: "La actualización no se inició por el estado actual de la pieza.",
        error: stateError,
      });
      return NextResponse.json({ error: stateError }, { status: 409 });
    }
    const config = configOrError();
    externalCode = getRecambioFacilCode(piece, config);
    const missing = validateCatPiece(piece, config);
    if (missing.length) {
      const validationError = `Antes de actualizar R/F revisa: ${missing.join(", ")}.`;
      await auditOperation({
        piece,
        operation: "actualizacion",
        externalCode,
        success: false,
        detail: "La actualización no se inició porque faltan datos obligatorios.",
        error: validationError,
      });
      return NextResponse.json({ error: validationError }, { status: 400 });
    }
    const result = await updateCatPiece(piece, config);
    updatedExternally = true;
    const updated = await updateLocalPiece(piece, true, result.externalCode);
    await auditOperation({
      piece,
      operation: "actualizacion",
      externalCode,
      success: true,
      detail: "Recambio Fácil confirmó la actualización completa con los datos actuales de Cazapiezas.",
      beforeOnline: piece.publicado_online,
      afterOnline: true,
    });
    return NextResponse.json({
      updated: true,
      externalCode: result.externalCode,
      remote: remoteSummary(result.payload),
      local: { publicado_online: updated.publicado_online, estado_proceso: updated.estado_proceso },
      message: "La pieza se ha actualizado correctamente en Recambio Fácil.",
    });
  } catch (error) {
    const rawDetail = error instanceof Error ? error.message : "Error desconocido.";
    const detail = updatedExternally
      ? `Recambio Fácil actualizó la pieza, pero Cazapiezas no pudo sincronizar el estado Online: ${rawDetail}`
      : rawDetail;
    if (piece) {
      await auditOperation({
        piece,
        operation: "actualizacion",
        externalCode,
        success: false,
        detail: updatedExternally
          ? "La actualización externa se completó, pero falló la sincronización local. No vuelvas a crear la pieza."
          : "Recambio Fácil no confirmó la actualización.",
        error: detail,
        metadata: { actualizada_externamente: updatedExternally },
      });
    }
    if (updatedExternally) {
      return NextResponse.json({ error: detail, updatedExternally: true }, { status: 500 });
    }
    return externalErrorResponse(error, "No se pudo actualizar la pieza en Recambio Fácil.");
  }
}

export async function DELETE(request: Request, context: Context) {
  const guard = await protectAdminApiOrPostmanRequest(request, { keyPrefix: "desguace:rf-delete", limit: 10, windowMs: 60_000 });
  if (guard) return guard;

  let piece: PiezaDesguace | null = null;
  let externalCode = "";
  let removalConfirmedExternally = false;
  let alreadyAbsent = false;
  try {
    const { id } = await context.params;
    piece = await loadPiece(id);
    if (!piece) return NextResponse.json({ error: "Pieza no encontrada." }, { status: 404 });
    const config = configOrError();
    externalCode = getRecambioFacilCode(piece, config);
    try {
      await deleteCatPiece(piece, config);
      removalConfirmedExternally = true;
    } catch (error) {
      if (error instanceof RecambioFacilRequestError && error.status === 404) {
        alreadyAbsent = true;
        removalConfirmedExternally = true;
      }
      else throw error;
    }
    const updated = await updateLocalPiece(piece, false);
    await auditOperation({
      piece,
      operation: "eliminacion",
      externalCode,
      success: true,
      detail: alreadyAbsent
        ? "La pieza ya no existía en Recambio Fácil; se ha corregido el estado local."
        : "Recambio Fácil confirmó la eliminación. La pieza continúa guardada en Cazapiezas y conserva su ubicación.",
      beforeOnline: piece.publicado_online,
      afterOnline: false,
    });
    return NextResponse.json({
      deleted: !alreadyAbsent,
      alreadyAbsent,
      externalCode,
      local: { publicado_online: updated.publicado_online, estado_proceso: updated.estado_proceso },
      message: alreadyAbsent
        ? "La pieza ya no estaba en Recambio Fácil. Se ha corregido su estado en Cazapiezas."
        : "La pieza se ha eliminado de Recambio Fácil, pero permanece en Cazapiezas.",
    });
  } catch (error) {
    const rawDetail = error instanceof Error ? error.message : "Error desconocido.";
    const detail = removalConfirmedExternally
      ? `${alreadyAbsent ? "La pieza ya no estaba en Recambio Fácil" : "Recambio Fácil eliminó la pieza"}, pero Cazapiezas no pudo actualizar el estado local: ${rawDetail}`
      : rawDetail;
    if (piece) {
      await auditOperation({
        piece,
        operation: "eliminacion",
        externalCode,
        success: false,
        detail: removalConfirmedExternally
          ? "La retirada externa está confirmada, pero falló la sincronización local. No es necesario repetir el DELETE."
          : "La pieza no se eliminó de Recambio Fácil ni se modificó en Cazapiezas.",
        error: detail,
        metadata: {
          eliminada_externamente: removalConfirmedExternally && !alreadyAbsent,
          ya_ausente_externamente: alreadyAbsent,
        },
      });
    }
    if (removalConfirmedExternally) {
      return NextResponse.json({
        error: detail,
        deletedExternally: !alreadyAbsent,
        alreadyAbsent,
      }, { status: 500 });
    }
    return externalErrorResponse(error, "No se pudo eliminar la pieza de Recambio Fácil.");
  }
}
