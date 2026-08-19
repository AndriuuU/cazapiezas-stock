import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { resolveActionActor } from "@/lib/action-actor";
import { DEFAULT_TOOL_SETTINGS, normalizeToolSettings } from "@/lib/app-settings";
import { shelfPositionExists } from "@/lib/herramientas-comunes";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { EstadoHerramienta, EstanteriaHerramientas, HerramientaComun } from "@/types/herramientas-comunes";

type Context = { params: Promise<{ id: string }> };
const STATES: EstadoHerramienta[] = ["disponible", "prestada", "perdida"];
const clean = (value: unknown, length = 200) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, length);

export async function PATCH(request: Request, context: Context) {
  const guard = await protectApiRequest(request, { keyPrefix: "common-tools:update", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Herramienta no válida." }, { status: 400 });
    const body = await request.json() as { action?: string; actor_user_id?: unknown; empleado?: unknown; vehiculo?: unknown; estado?: EstadoHerramienta; detalle?: unknown; estanteria_id?: unknown; nivel?: unknown; posicion?: unknown; codigo?: unknown; nombre?: unknown; categoria?: unknown; marca?: unknown; descripcion?: unknown };
    const signedUser = await getRequestUser(request);
    if (!signedUser) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    if ((body.action === "ubicacion" || body.action === "editar") && signedUser.rol !== "administrador") return NextResponse.json({ error: "Esta acción necesita permisos de administrador." }, { status: 403 });
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

    const actor = body.action === "retirar" ? await resolveActionActor(request, body.actor_user_id) : signedUser;
    if (!actor) return NextResponse.json({ error: "Selecciona el empleado que retira la herramienta." }, { status: 400 });
    const employee = clean(actor.nombre, 100);
    const vehicle = clean(body.vehiculo, 120) || null;
    if (body.action === "retirar" && settings.requireVehicleOnLoan && !vehicle) return NextResponse.json({ error: "Indica el vehículo antes de retirar la herramienta." }, { status: 400 });
    if (body.action === "devolver" && settings.requireLocationScanOnReturn) {
      const confirmedShelf = Number(body.estanteria_id); const confirmedLevel = Number(body.nivel); const confirmedPosition = clean(body.posicion, 80);
      if (confirmedShelf !== current.estanteria_id || confirmedLevel !== current.nivel || confirmedPosition.toUpperCase() !== clean(current.posicion, 80).toUpperCase()) return NextResponse.json({ error: "Escanea el QR de la ubicación correcta antes de devolverla." }, { status: 400 });
    }
    if (body.action === "estado" && body.estado === "perdida" && signedUser.rol !== "administrador" && !settings.employeesCanMarkMissing) return NextResponse.json({ error: "Solo un administrador puede marcar herramientas no localizadas." }, { status: 403 });
    if (body.action === "retirar" || body.action === "devolver" || body.action === "estado") {
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
    let type: "retirada" | "devolucion" | "cambio_estado" | "cambio_ubicacion" | null;
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
      body.detalle = `${current.estanteria_id} · nivel ${current.nivel} · ${current.posicion} → ${shelf.codigo} · nivel ${level} · ${position}`;
    } else if (body.action === "editar") {
      const code = clean(body.codigo, 40).toUpperCase(); const name = clean(body.nombre, 150);
      const shelfId = Number(body.estanteria_id); const level = Number(body.nivel); const position = clean(body.posicion, 80);
      if (!/^[A-Z0-9-]{2,40}$/.test(code) || !name) return NextResponse.json({ error: "Indica un código y un nombre válidos." }, { status: 400 });
      const shelfParams = new URLSearchParams({ select: "*", id: `eq.${shelfId}`, activa: "eq.true", limit: "1" });
      const shelfResponse = await fetch(`${url}/rest/v1/herramientas_comunes_estanterias?${shelfParams}`, { headers: supabaseHeaders(key) });
      const shelf = (await parseSupabaseResponse<EstanteriaHerramientas[]>(shelfResponse))[0];
      if (!shelf || !shelfPositionExists(shelf.configuracion, level, position)) return NextResponse.json({ error: "La ubicación seleccionada no es válida." }, { status: 400 });
      nextState = current.estado;
      patch = { codigo: code, nombre: name, categoria: clean(body.categoria, 100) || null, marca: clean(body.marca, 100) || null, descripcion: clean(body.descripcion, 500) || null, estanteria_id: shelfId, nivel: level, posicion: position };
      const locationChanged = current.estanteria_id !== shelfId || current.nivel !== level || current.posicion !== position;
      type = locationChanged ? "cambio_ubicacion" : null;
      if (locationChanged) body.detalle = `${current.estanteria_id} · nivel ${current.nivel} · ${current.posicion} → ${shelf.codigo} · nivel ${level} · ${position}`;
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
