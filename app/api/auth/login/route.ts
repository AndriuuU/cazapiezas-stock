import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
  isAuthConfigured,
  isValidLoginPassword,
  sessionCookieName,
} from "@/lib/auth";
import { protectPublicAuthRequest } from "@/lib/request-security";
import { verifyPin, type AppUserRow } from "@/lib/app-users";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";

export async function POST(request: Request) {
  const guard = protectPublicAuthRequest(request, {
    keyPrefix: "login",
    limit: 8,
    windowMs: 15 * 60 * 1000,
  });

  if (guard) {
    return guard;
  }

  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Falta configurar CAZAPIEZAS_LOGIN_PASSWORD." },
      { status: 503 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = String(body.password || "");
  const userId = String(body.user_id || "");
  const pin = String(body.pin || "");

  if (userId && pin) {
    try {
      const { url, key } = getSupabaseApiConfig();
      const params = new URLSearchParams({ select: "*", id: `eq.${userId}`, activo: "eq.true", limit: "1" });
      const userResponse = await fetch(`${url}/rest/v1/cazapiezas_usuarios?${params}`, { headers: supabaseHeaders(key), cache: "no-store" });
      const user = (await parseSupabaseResponse<AppUserRow[]>(userResponse))[0];
      if (!user) return NextResponse.json({ error: "Usuario o PIN incorrecto." }, { status: 401 });
      if (user.bloqueado) return NextResponse.json({ error: "Este usuario está bloqueado. Pide acceso a un administrador." }, { status: 423 });
      const pinIsValid = await verifyPin(pin, user.pin_hash);
      const attemptResponse = await fetch(`${url}/rest/v1/rpc/cazapiezas_registrar_intento_pin`, {
        method: "POST",
        headers: supabaseHeaders(key),
        body: JSON.stringify({ p_user_id: user.id, p_correcto: pinIsValid }),
      });
      const attempt = (await parseSupabaseResponse<Array<{ bloqueado: boolean; intentos: number }>>(attemptResponse))[0];
      if (!pinIsValid) {
        const error = attempt?.bloqueado
          ? "Has fallado el PIN 4 veces. Tu usuario ha quedado bloqueado hasta que un administrador te dé acceso."
          : `Usuario o PIN incorrecto. Quedan ${Math.max(0, 4 - Number(attempt?.intentos || 0))} intentos.`;
        return NextResponse.json({ error }, { status: attempt?.bloqueado ? 423 : 401 });
      }
      const token = await createSessionToken({ id: user.id, nombre: user.nombre, rol: user.rol });
      const response = NextResponse.json({ ok: true, user: { id: user.id, nombre: user.nombre, rol: user.rol } });
      response.cookies.set(sessionCookieName, token, getSessionCookieOptions());
      return response;
    } catch { return NextResponse.json({ error: "No se pudo comprobar el usuario." }, { status: 503 }); }
  }

  if (!isValidLoginPassword(password)) {
    return NextResponse.json(
      { error: "Contrasena incorrecta." },
      { status: 401 }
    );
  }

  const token = await createSessionToken();
  const response = NextResponse.json({ ok: true });

  response.cookies.set(sessionCookieName, token, getSessionCookieOptions());

  return response;
}
