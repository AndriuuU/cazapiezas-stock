import { NextResponse } from "next/server";
import {
  createSessionToken,
  getSessionCookieOptions,
  isAuthConfigured,
  isValidLoginPassword,
  sessionCookieName,
} from "@/lib/auth";
import { protectPublicAuthRequest } from "@/lib/request-security";

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
