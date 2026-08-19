import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { hashPin, isValidPin, verifyPin } from "@/lib/app-users";
import { protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

export async function PATCH(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "auth-change-pin", limit: 10, windowMs: 15 * 60_000 });
  if (guard) return guard;

  try {
    const user = await getRequestUser(request);
    if (!user) return NextResponse.json({ error: "Inicia sesión para continuar." }, { status: 401 });
    if (user.id === "legacy-admin") {
      return NextResponse.json({ error: "El acceso general de administrador no tiene un PIN personal. Cámbialo desde Usuarios y permisos." }, { status: 400 });
    }

    const body = await request.json().catch(() => ({})) as { current_pin?: unknown; new_pin?: unknown };
    const currentPin = String(body.current_pin || "");
    const newPin = String(body.new_pin || "");
    if (!isValidPin(currentPin) || !isValidPin(newPin)) {
      return NextResponse.json({ error: "Los PIN deben tener entre 4 y 6 números." }, { status: 400 });
    }

    const { url, key } = getSupabaseApiConfig();
    const params = new URLSearchParams({ select: "id,pin_hash", id: `eq.${user.id}`, activo: "eq.true", limit: "1" });
    const lookup = await fetch(`${url}/rest/v1/cazapiezas_usuarios?${params}`, { headers: supabaseHeaders(key), cache: "no-store" });
    const row = (await parseSupabaseResponse<Array<{ id: string; pin_hash: string }>>(lookup))[0];
    if (!row) return NextResponse.json({ error: "Tu usuario ya no está activo." }, { status: 403 });
    if (!(await verifyPin(currentPin, row.pin_hash))) {
      return NextResponse.json({ error: "El PIN actual no es correcto." }, { status: 401 });
    }
    if (await verifyPin(newPin, row.pin_hash)) {
      return NextResponse.json({ error: "El nuevo PIN debe ser diferente del actual." }, { status: 400 });
    }

    const update = await fetch(`${url}/rest/v1/cazapiezas_usuarios?id=eq.${user.id}`, {
      method: "PATCH",
      headers: supabaseHeaders(key, { Prefer: "return=minimal" }),
      body: JSON.stringify({ pin_hash: await hashPin(newPin) }),
    });
    if (!update.ok) throw new Error("No se pudo guardar el nuevo PIN.");
    return NextResponse.json({ ok: true, message: "Tu PIN se ha cambiado correctamente." });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo cambiar el PIN." }, { status: 500 });
  }
}
