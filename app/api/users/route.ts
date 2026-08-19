import { NextResponse } from "next/server";
import { hashPin, isValidPin, type AppRole, type AppUserRow } from "@/lib/app-users";
import { protectAdminApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

const cleanName = (value: unknown) => String(value ?? "").trim().replace(/\s+/g, " ").slice(0, 100);
const validRole = (value: unknown): value is AppRole => value === "administrador" || value === "empleado";

export async function GET(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "users-list", limit: 60, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/cazapiezas_usuarios?select=id,nombre,rol,activo,bloqueado,intentos_pin_fallidos,bloqueado_at,created_at,updated_at&order=nombre.asc`, { headers: supabaseHeaders(key), cache: "no-store" });
    return NextResponse.json({ users: await parseSupabaseResponse<Omit<AppUserRow, "pin_hash">[]>(response) });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudieron cargar los usuarios." }, { status: 500 }); }
}

export async function POST(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "users-create", limit: 20, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const body = await request.json(); const nombre = cleanName(body.nombre); const pin = String(body.pin || ""); const rol = body.rol;
    if (!nombre || !isValidPin(pin) || !validRole(rol)) return NextResponse.json({ error: "Indica nombre, rol y un PIN de 4 a 6 números." }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/cazapiezas_usuarios?select=id,nombre,rol,activo,created_at,updated_at`, { method: "POST", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify({ nombre, pin_hash: await hashPin(pin), rol, activo: true }) });
    return NextResponse.json((await parseSupabaseResponse<Omit<AppUserRow, "pin_hash">[]>(response))[0], { status: 201 });
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo crear el usuario." }, { status: 500 }); }
}

export async function PATCH(request: Request) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "users-update", limit: 30, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const body = await request.json(); const id = String(body.id || ""); const nombre = cleanName(body.nombre); const rol = body.rol; const activo = Boolean(body.activo); const pin = String(body.pin || ""); const unlock = body.desbloquear === true;
    if (!/^[0-9a-f-]{36}$/i.test(id) || !nombre || !validRole(rol) || (pin && !isValidPin(pin))) return NextResponse.json({ error: "Revisa los datos del usuario." }, { status: 400 });
    const { url, key } = getSupabaseApiConfig();
    const currentResponse = await fetch(`${url}/rest/v1/cazapiezas_usuarios?select=id,rol,activo&id=eq.${id}&limit=1`, { headers: supabaseHeaders(key) });
    const current = (await parseSupabaseResponse<Array<{ id: string; rol: AppRole; activo: boolean }>>(currentResponse))[0];
    if (!current) return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    if (current.rol === "administrador" && current.activo && (rol !== "administrador" || !activo)) {
      const adminsResponse = await fetch(`${url}/rest/v1/cazapiezas_usuarios?select=id&rol=eq.administrador&activo=eq.true`, { headers: supabaseHeaders(key) });
      if ((await parseSupabaseResponse<Array<{ id: string }>>(adminsResponse)).length <= 1) return NextResponse.json({ error: "Debe quedar al menos un administrador activo." }, { status: 409 });
    }
    const patch = { nombre, rol, activo, ...(pin && { pin_hash: await hashPin(pin) }), ...(unlock && { bloqueado: false, intentos_pin_fallidos: 0, bloqueado_at: null }) };
    const response = await fetch(`${url}/rest/v1/cazapiezas_usuarios?id=eq.${id}&select=id,nombre,rol,activo,bloqueado,intentos_pin_fallidos,bloqueado_at,created_at,updated_at`, { method: "PATCH", headers: supabaseHeaders(key, { Prefer: "return=representation" }), body: JSON.stringify(patch) });
    return NextResponse.json((await parseSupabaseResponse<Omit<AppUserRow, "pin_hash">[]>(response))[0]);
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el usuario." }, { status: 500 }); }
}
