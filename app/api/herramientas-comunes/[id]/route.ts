import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { resolveActionActor } from "@/lib/action-actor";
import { DEFAULT_TOOL_SETTINGS, normalizeToolSettings } from "@/lib/app-settings";
import { shelfPositionExists } from "@/lib/herramientas-comunes";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EstadoHerramienta, EstanteriaHerramientas, HerramientaComun, TipoIncidenciaHerramienta } from "@/types/herramientas-comunes";

type Context = { params: Promise<{ id: string }> };
const STATES: EstadoHerramienta[] = ["disponible", "prestada", "perdida"];
const clean = (value: unknown, length = 200) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, length);

export async function PATCH(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "common-tools:update", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Herramienta no válida." }, { status: 400 });
    const body = await request.json() as { action?: string; actor_user_id?: unknown; empleado?: unknown; vehiculo?: unknown; estado?: EstadoHerramienta; detalle?: unknown; incidencia_tipo?: TipoIncidenciaHerramienta | null; estanteria_id?: unknown; nivel?: unknown; posicion?: unknown; codigo?: unknown; nombre?: unknown; categoria?: unknown; marca?: unknown; descripcion?: unknown; solo_localizacion?: unknown; espacio_ocupado?: unknown };
    const signedUser = await getRequestUser(request);
    if (!signedUser) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    if (["editar", "archivar", "restaurar", "resolver_incidencia"].includes(body.action || "") && signedUser.rol !== "administrador") return NextResponse.json({ error: "Esta acción necesita permisos de administrador." }, { status: 403 });
    const { url, key } = getSupabaseApiConfig();
    const select = new URLSearchParams({ select: "*", id: `eq.${id}`, limit: "1" });
    const currentResponse = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?${select}`, { headers: supabaseHeaders(key) });
    const current = (await parseSupabaseResponse<HerramientaComun[]>(currentResponse))[0];
    if (!current) return NextResponse.json({ error: "Herramienta no encontrada." }, { status: 404 });

    let settings = DEFAULT_TOOL_SETTINGS;
    const settingsResponse = await fetch(`${url}/rest/v1/cazapiezas_configuracion?select=valor&clave=eq.herramientas&limit=1`, { headers: supabaseHeaders(key), cache: "no-store" });
    if (settingsResponse.ok) {
      const row = (await parseSupabaseResponse<Array<{ valor: unknown }>>(settingsResponse))[0];
      settings = normalizeToolSettings(row?.valor);
    }

    const actor = body.action === "retirar" || body.action === "devolver" ? await resolveActionActor(request, body.actor_user_id) : signedUser;
    if (!actor) return NextResponse.json({ error: "Selecciona el empleado que realiza la acción." }, { status: 400 });
    const employee = clean(actor.nombre, 100);
    const vehicle = clean(body.vehiculo, 120) || null;
    if (body.action === "retirar" && current.solo_localizacion) return NextResponse.json({ error: "Este material es solo para localizar y no se puede retirar." }, { status: 409 });
    if (body.action === "retirar" && current.incidencia_abierta_tipo) return NextResponse.json({ error: "Resuelve primero la incidencia abierta de esta herramienta." }, { status: 409 });
    if (body.action === "retirar" && current.archivada) return NextResponse.json({ error: "La herramienta está archivada." }, { status: 409 });
    if (body.action === "retirar" && (!current.estanteria_id || !current.nivel || !current.posicion)) return NextResponse.json({ error: "Coloca primero la herramienta en una ubicación antes de retirarla." }, { status: 409 });
    if (body.action === "retirar" && settings.requireVehicleOnLoan && !vehicle) return NextResponse.json({ error: "Indica el vehículo antes de retirar la herramienta." }, { status: 400 });
    if (body.action === "retirar") {
      const activeLoansParams = new URLSearchParams({ select: "id", estado: "eq.prestada", empleado_actual: `eq.${employee}`, limit: "3" });
      const activeLoansResponse = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?${activeLoansParams}`, { headers: supabaseHeaders(key), cache: "no-store" });
      const activeLoans = await parseSupabaseResponse<Array<{ id: number }>>(activeLoansResponse);
      if (activeLoans.length >= 3) return NextResponse.json({ error: `${employee} ya tiene 3 herramientas retiradas. Debe devolver una antes de coger otra.` }, { status: 409 });
    }
    if (body.action === "devolver" && settings.requireLocationScanOnReturn) {
      const confirmedShelf = Number(body.estanteria_id); const confirmedLevel = Number(body.nivel); const confirmedPosition = clean(body.posicion, 80);
      if (confirmedShelf !== current.estanteria_id || confirmedLevel !== current.nivel || confirmedPosition.toUpperCase() !== clean(current.posicion, 80).toUpperCase()) return NextResponse.json({ error: "Escanea el QR de la ubicación correcta antes de devolverla." }, { status: 400 });
    }
    if (body.action === "estado" && body.estado === "perdida" && signedUser.rol !== "administrador" && !settings.employeesCanMarkMissing) return NextResponse.json({ error: "Solo un administrador puede marcar herramientas no localizadas." }, { status: 403 });
    if (body.action === "devolver") {
      const incidentType = body.incidencia_tipo || null;
      const incidentDetail = clean(body.detalle, 500) || null;
      if (incidentType && !["falta_pieza", "danada", "revision"].includes(incidentType)) return NextResponse.json({ error: "Tipo de incidencia no válido." }, { status: 400 });
      if (incidentType && !settings.allowReturnIncidents) return NextResponse.json({ error: "El registro de incidencias al devolver está desactivado." }, { status: 403 });
      if (incidentType && settings.requireIncidentComment && !incidentDetail) return NextResponse.json({ error: "Escribe un comentario para registrar la incidencia." }, { status: 400 });
      const rpcResponse = await fetch(`${url}/rest/v1/rpc/herramientas_comunes_devolver_con_incidencia`, {
        method: "POST", headers: supabaseHeaders(key), body: JSON.stringify({ p_herramienta_id: Number(id), p_empleado: employee, p_incidencia_tipo: incidentType, p_incidencia_detalle: incidentDetail }),
      });
      if (!rpcResponse.ok) {
        const payload = await rpcResponse.json().catch(() => null) as { message?: string; error?: string; code?: string } | null;
        const missingUpdate = rpcResponse.status === 404 || payload?.code === "PGRST202";
        return NextResponse.json({ error: missingUpdate ? "Falta aplicar la actualización 202608240001_control_herramientas_comunes.sql." : payload?.message || payload?.error || "No se pudo registrar la devolución." }, { status: missingUpdate ? 503 : 409 });
      }
      return NextResponse.json(await rpcResponse.json());
    }
    if (body.action === "archivar" || body.action === "restaurar") {
      const rpcResponse = await fetch(`${url}/rest/v1/rpc/herramientas_comunes_archivar`, {
        method: "POST", headers: supabaseHeaders(key), body: JSON.stringify({ p_herramienta_id: Number(id), p_archivar: body.action === "archivar", p_empleado: employee, p_motivo: clean(body.detalle, 500) || null }),
      });
      if (!rpcResponse.ok) {
        const payload = await rpcResponse.json().catch(() => null) as { message?: string; error?: string } | null;
        return NextResponse.json({ error: payload?.message || payload?.error || "No se pudo cambiar el archivo de la herramienta." }, { status: rpcResponse.status === 404 ? 503 : 409 });
      }
      const payload = await rpcResponse.json() as HerramientaComun | HerramientaComun[];
      return NextResponse.json(Array.isArray(payload) ? payload[0] : payload);
    }
    if (body.action === "resolver_incidencia") {
      const rpcResponse = await fetch(`${url}/rest/v1/rpc/herramientas_comunes_resolver_incidencia`, {
        method: "POST", headers: supabaseHeaders(key), body: JSON.stringify({ p_herramienta_id: Number(id), p_empleado: employee, p_detalle: clean(body.detalle, 500) || null }),
      });
      if (!rpcResponse.ok) {
        const payload = await rpcResponse.json().catch(() => null) as { message?: string; error?: string } | null;
        return NextResponse.json({ error: payload?.message || payload?.error || "No se pudo resolver la incidencia." }, { status: rpcResponse.status === 404 ? 503 : 409 });
      }
      const payload = await rpcResponse.json() as HerramientaComun | HerramientaComun[];
      return NextResponse.json(Array.isArray(payload) ? payload[0] : payload);
    }
    if (body.action === "retirar" || body.action === "estado") {
      const rpcResponse = await fetch(`${url}/rest/v1/rpc/herramientas_comunes_cambiar_estado`, {
        method: "POST",
        headers: supabaseHeaders(key),
        body: JSON.stringify({ p_herramienta_id: Number(id), p_accion: body.action, p_empleado: employee || null, p_vehiculo: vehicle, p_estado_nuevo: body.estado || null }),
      });
      if (rpcResponse.ok) {
        const payload = await rpcResponse.json() as HerramientaComun | HerramientaComun[];
        return NextResponse.json(Array.isArray(payload) ? payload[0] : payload);
      }
      if (rpcResponse.status !== 404) {
        const payload = await rpcResponse.json().catch(() => null) as { message?: string; error?: string } | null;
        return NextResponse.json({ error: payload?.message || payload?.error || "No se pudo guardar el movimiento." }, { status: rpcResponse.status >= 500 ? 500 : 409 });
      }
    }
    let nextState: EstadoHerramienta;
    let patch: Record<string, unknown>;
    let type: "retirada" | "devolucion" | "cambio_estado" | "cambio_ubicacion" | "edicion" | null;
    if (body.action === "retirar") {
      if (current.estado !== "disponible") return NextResponse.json({ error: "La herramienta ya no está disponible." }, { status: 409 });
      if (!employee) return NextResponse.json({ error: "Selecciona el empleado que la retira." }, { status: 400 });
      nextState = "prestada";
      patch = { estado: nextState, empleado_actual: employee, vehiculo_actual: vehicle, retirada_at: new Date().toISOString() };
      type = "retirada";
    } else if (body.action === "devolver") {
      if (current.estado !== "prestada") return NextResponse.json({ error: "La herramienta no figura como prestada." }, { status: 409 });
      nextState = "disponible";
      patch = { estado: nextState, empleado_actual: null, vehiculo_actual: null, retirada_at: null };
      type = "devolucion";
    } else if (body.action === "estado" && body.estado && STATES.includes(body.estado) && body.estado !== "prestada") {
      nextState = body.estado;
      patch = { estado: nextState, empleado_actual: null, vehiculo_actual: null, retirada_at: null };
      type = "cambio_estado";
    } else if (body.action === "ubicacion") {
      const shelfId = Number(body.estanteria_id); const level = Number(body.nivel); const position = clean(body.posicion, 80);
      const shelfParams = new URLSearchParams({ select: "*", id: `eq.${shelfId}`, activa: "eq.true", limit: "1" });
      const shelfResponse = await fetch(`${url}/rest/v1/herramientas_comunes_estanterias?${shelfParams}`, { headers: supabaseHeaders(key) });
      const shelf = (await parseSupabaseResponse<EstanteriaHerramientas[]>(shelfResponse))[0];
      if (!shelf || !shelfPositionExists(shelf.configuracion, level, position)) return NextResponse.json({ error: "La nueva ubicación no es válida." }, { status: 400 });
      nextState = current.estado;
      patch = { estanteria_id: shelfId, nivel: level, posicion: position };
      type = "cambio_ubicacion";
      body.detalle = `${current.estanteria_id ? `${current.estanteria_id} · nivel ${current.nivel} · ${current.posicion}` : "Sin ubicación"} → ${shelf.codigo} · nivel ${level} · ${position}`;
    } else if (body.action === "editar") {
      const name = clean(body.nombre, 150);
      if (!name) return NextResponse.json({ error: "Indica un nombre válido." }, { status: 400 });
      nextState = current.estado;
      const onlyLocation = body.solo_localizacion === true || body.solo_localizacion === "true" || body.solo_localizacion === "on";
      if (onlyLocation && current.estado === "prestada") return NextResponse.json({ error: "Devuelve primero la herramienta antes de marcarla como solo localización." }, { status: 409 });
      patch = { nombre: name, categoria: clean(body.categoria, 100) || null, marca: clean(body.marca, 100) || null, descripcion: clean(body.descripcion, 500) || null, solo_localizacion: onlyLocation, espacio_ocupado: clean(body.espacio_ocupado, 150) || null };
      type = "edicion";
      body.detalle = "Datos generales de la herramienta actualizados.";
    } else {
      return NextResponse.json({ error: "Acción no válida." }, { status: 400 });
    }

    const updateParams = new URLSearchParams({ id: `eq.${id}`, estado: `eq.${current.estado}`, select: "*" });
    const updateResponse = await fetch(`${url}/rest/v1/herramientas_comunes_herramientas?${updateParams}`, {
      method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(patch),
    });
    const updated = (await parseSupabaseResponse<HerramientaComun[]>(updateResponse))[0];
    if (!updated) return NextResponse.json({ error: "La herramienta cambió mientras la estabas actualizando. Recarga la página." }, { status: 409 });
    if (type) {
      const movementResponse = await fetch(`${url}/rest/v1/herramientas_comunes_movimientos`, {
        method: "POST", headers: supabaseHeaders(key), body: JSON.stringify({ herramienta_id: current.id, tipo: type, empleado: employee || current.empleado_actual, vehiculo: vehicle || current.vehiculo_actual, estado_anterior: current.estado, estado_nuevo: nextState, detalle: clean(body.detalle, 300) || null }),
      });
      if (!movementResponse.ok) return NextResponse.json({ error: "La herramienta se actualizó, pero no se pudo guardar el historial." }, { status: 500 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar la herramienta." }, { status: 500 });
  }
}
