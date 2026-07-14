const SESSION_COOKIE_NAME = "cazapiezas_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;
const SESSION_VERSION = "v1";

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

export async function createSessionToken(now = Date.now()) {
  const expiresAt = now + SESSION_MAX_AGE_SECONDS * 1000;
  const payload = `${SESSION_VERSION}.${expiresAt}`;
  const signature = await sign(payload);

  if (!signature) {
    return "";
  }

  return `${payload}.${signature}`;
}

export async function verifySessionToken(token?: string) {
  if (!token || !isAuthConfigured()) {
    return false;
  }

  const [version, expiresAtValue, signature] = token.split(".");
  const expiresAt = Number(expiresAtValue);

  if (version !== SESSION_VERSION || !Number.isFinite(expiresAt) || !signature) {
    return false;
  }

  if (Date.now() > expiresAt) {
    return false;
  }

  const expectedSignature = await sign(`${version}.${expiresAtValue}`);

  return safeEquals(signature, expectedSignature);
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

