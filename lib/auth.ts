import type { AppUser } from "@/lib/app-users";

const SESSION_COOKIE_NAME = "cazapiezas_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 12;
const SESSION_VERSION = "v3";

export const sessionCookieName = SESSION_COOKIE_NAME;

function getLoginPassword() {
  return process.env.CAZAPIEZAS_LOGIN_PASSWORD?.trim() || "";
}

function getSessionSecret() {
  return (
    process.env.CAZAPIEZAS_SESSION_SECRET?.trim() ||
    process.env.CAZAPIEZAS_LOGIN_PASSWORD?.trim() ||
    ""
  );
}

function encodeBase64Url(buffer: ArrayBuffer) {
  const bytes = new Uint8Array(buffer);
  let value = "";

  for (const byte of bytes) {
    value += String.fromCharCode(byte);
  }

  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function sign(value: string) {
  const secret = getSessionSecret();

  if (!secret) {
    return "";
  }

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    key,
    new TextEncoder().encode(value)
  );

  return encodeBase64Url(signature);
}

function safeEquals(left: string, right: string) {
  if (left.length !== right.length) {
    return false;
  }

  let mismatch = 0;

  for (let index = 0; index < left.length; index++) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }

  return mismatch === 0;
}

export function isAuthConfigured() {
  return Boolean(getLoginPassword() && getSessionSecret());
}

export function isValidLoginPassword(password: string) {
  const configuredPassword = getLoginPassword();

  return Boolean(configuredPassword) && safeEquals(password, configuredPassword);
}

export async function createSessionToken(user: AppUser = { id: "legacy-admin", nombre: "Administrador", rol: "administrador" }, now = Date.now()) {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const encodedPayload = encodeText(JSON.stringify({ exp: expiresAt, uid: user.id, name: user.nombre, role: user.rol }));
  const payload = `${SESSION_VERSION}.${encodedPayload}`;
  const signature = await sign(payload);

  if (!signature) {
    return "";
  }

  return `${payload}.${signature}`;
}

export async function verifySessionToken(token?: string) {
  return Boolean(await getSessionFromToken(token));
}

export async function getSessionFromToken(token?: string): Promise<AppUser | null> {
  if (!token || !isAuthConfigured()) return null;

  const [version, payloadValue, signature] = token.split(".");
  if (!signature) return null;

  if (version !== SESSION_VERSION) return null;
  const expectedSignature = await sign(`${version}.${payloadValue}`);
  if (!safeEquals(signature, expectedSignature)) return null;

  try {
    const payload = JSON.parse(decodeText(payloadValue)) as { exp?: number; uid?: string; name?: string; role?: string };
    if (!payload.exp || Date.now() > payload.exp || !payload.uid || !payload.name || (payload.role !== "administrador" && payload.role !== "empleado")) return null;
    return { id: payload.uid, nombre: payload.name, rol: payload.role };
  } catch { return null; }
}

export function getSessionCookieFromRequest(request: Request) {
  const header = request.headers.get("cookie") || "";
  const prefix = `${SESSION_COOKIE_NAME}=`;
  const item = header.split(";").map((value) => value.trim()).find((value) => value.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : undefined;
}

export async function getRequestUser(request: Request) {
  return getSessionFromToken(getSessionCookieFromRequest(request));
}

function encodeText(value: string) {
  return encodeBase64Url(new TextEncoder().encode(value).buffer);
}

function decodeText(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return new TextDecoder().decode(Uint8Array.from(atob(normalized + "=".repeat((4 - normalized.length % 4) % 4)), (character) => character.charCodeAt(0)));
}

export function getSessionCookieOptions() {
  return {
    httpOnly: true,
    maxAge: SESSION_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
  };
}
