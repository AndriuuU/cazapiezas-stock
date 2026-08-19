export type AppRole = "administrador" | "empleado";

export interface AppUser {
  id: string;
  nombre: string;
  rol: AppRole;
}

export interface AppUserRow extends AppUser {
  pin_hash: string;
  activo: boolean;
  bloqueado: boolean;
  intentos_pin_fallidos: number;
  bloqueado_at: string | null;
  created_at: string;
  updated_at: string;
}

const PIN_ITERATIONS = 160_000;

export function isValidPin(pin: string) {
  return /^\d{4,6}$/.test(pin);
}

export async function hashPin(pin: string) {
  if (!isValidPin(pin)) throw new Error("El PIN debe tener entre 4 y 6 números.");
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await derivePin(pin, salt, PIN_ITERATIONS);
  return `v1.${PIN_ITERATIONS}.${toBase64Url(salt)}.${toBase64Url(derived)}`;
}

export async function verifyPin(pin: string, encoded: string) {
  if (!isValidPin(pin)) return false;
  const [version, iterationsValue, saltValue, expectedValue] = encoded.split(".");
  const iterations = Number(iterationsValue);
  if (version !== "v1" || !Number.isInteger(iterations) || iterations < 100_000 || !saltValue || !expectedValue) return false;
  try {
    const actual = await derivePin(pin, fromBase64Url(saltValue), iterations);
    const expected = fromBase64Url(expectedValue);
    return safeBytesEqual(actual, expected);
  } catch { return false; }
}

async function derivePin(pin: string, salt: Uint8Array, iterations: number) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: salt as BufferSource, iterations }, key, 256);
  return new Uint8Array(bits);
}

function safeBytesEqual(left: Uint8Array, right: Uint8Array) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left[index] ^ right[index];
  return mismatch === 0;
}

function toBase64Url(bytes: Uint8Array) {
  let value = "";
  for (const byte of bytes) value += String.fromCharCode(byte);
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function fromBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const decoded = atob(normalized + "=".repeat((4 - normalized.length % 4) % 4));
  return Uint8Array.from(decoded, (character) => character.charCodeAt(0));
}
