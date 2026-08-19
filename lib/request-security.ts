import { NextResponse } from "next/server";
import {
  getRequestUser,
  sessionCookieName,
  verifySessionToken,
} from "@/lib/auth";

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyPrefix: string;
}

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const rateLimitStore = new Map<string, RateLimitEntry>();
const DEFAULT_RATE_LIMIT: RateLimitOptions = {
  keyPrefix: "api",
  limit: 80,
  windowMs: 60 * 1000,
};

function getCookieValue(header: string | null, name: string) {
  if (!header) {
    return undefined;
  }

  const cookies = header.split(";").map((cookie) => cookie.trim());
  const prefix = `${name}=`;
  const cookie = cookies.find((item) => item.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : undefined;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const realIp = request.headers.get("x-real-ip")?.trim();

  return forwardedFor || realIp || "local";
}

function getAllowedIps() {
  return (process.env.CAZAPIEZAS_ALLOWED_IPS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isIpAllowed(request: Request) {
  const allowedIps = getAllowedIps();

  if (allowedIps.length === 0) {
    return true;
  }

  return allowedIps.includes(getClientIp(request));
}

function pruneExpiredRateLimitEntries(now: number) {
  if (rateLimitStore.size < 1000) {
    return;
  }

  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt <= now) {
      rateLimitStore.delete(key);
    }
  }
}

export function checkRateLimit(request: Request, options = DEFAULT_RATE_LIMIT) {
  const now = Date.now();
  const ip = getClientIp(request);
  const key = `${options.keyPrefix}:${ip}`;
  const entry = rateLimitStore.get(key);

  pruneExpiredRateLimitEntries(now);

  if (!entry || entry.resetAt <= now) {
    rateLimitStore.set(key, {
      count: 1,
      resetAt: now + options.windowMs,
    });

    return { allowed: true, remaining: options.limit - 1, retryAfter: 0 };
  }

  if (entry.count >= options.limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)),
    };
  }

  entry.count += 1;

  return {
    allowed: true,
    remaining: Math.max(0, options.limit - entry.count),
    retryAfter: 0,
  };
}

function securityError(message: string, status: number, retryAfter?: number) {
  const response = NextResponse.json({ error: message }, { status });

  if (retryAfter) {
    response.headers.set("Retry-After", String(retryAfter));
  }

  return response;
}

function safeTokenEquals(left: string, right: string) {
  if (!left || left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index++) mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return mismatch === 0;
}

function hasValidPostmanToken(request: Request) {
  const configured = process.env.CAZAPIEZAS_POSTMAN_TOKEN?.trim() || "";
  const authorization = request.headers.get("authorization")?.trim() || "";
  const supplied = authorization.toLowerCase().startsWith("bearer ") ? authorization.slice(7).trim() : "";
  return Boolean(configured) && safeTokenEquals(supplied, configured);
}

export async function protectApiRequest(
  request: Request,
  rateLimitOptions?: RateLimitOptions
) {
  if (!isIpAllowed(request)) {
    return securityError("Esta red no tiene acceso a Cazapiezas Stock.", 403);
  }

  const rateLimit = checkRateLimit(request, rateLimitOptions || DEFAULT_RATE_LIMIT);

  if (!rateLimit.allowed) {
    return securityError(
      `Demasiadas peticiones. Espera ${rateLimit.retryAfter} segundos y vuelve a intentarlo.`,
      429,
      rateLimit.retryAfter
    );
  }

  const token = getCookieValue(request.headers.get("cookie"), sessionCookieName);

  if (!(await verifySessionToken(token))) {
    return securityError("Inicia sesion para continuar.", 401);
  }

  return undefined;
}

export async function protectAdminApiRequest(request: Request, rateLimitOptions?: RateLimitOptions) {
  const guard = await protectApiRequest(request, rateLimitOptions);
  if (guard) return guard;
  const user = await getRequestUser(request);
  if (user?.rol !== "administrador") return securityError("Esta acción necesita permisos de administrador.", 403);
  return undefined;
}

export async function protectApiOrPostmanRequest(
  request: Request,
  rateLimitOptions?: RateLimitOptions
) {
  if (!hasValidPostmanToken(request)) return protectApiRequest(request, rateLimitOptions);
  if (!isIpAllowed(request)) return securityError("Esta red no tiene acceso a Cazapiezas Stock.", 403);
  const rateLimit = checkRateLimit(request, rateLimitOptions || DEFAULT_RATE_LIMIT);
  if (!rateLimit.allowed) {
    return securityError(
      `Demasiadas peticiones. Espera ${rateLimit.retryAfter} segundos y vuelve a intentarlo.`,
      429,
      rateLimit.retryAfter
    );
  }
  return undefined;
}

export async function protectAdminApiOrPostmanRequest(request: Request, rateLimitOptions?: RateLimitOptions) {
  if (hasValidPostmanToken(request)) return protectApiOrPostmanRequest(request, rateLimitOptions);
  return protectAdminApiRequest(request, rateLimitOptions);
}

export function protectPublicAuthRequest(
  request: Request,
  rateLimitOptions?: RateLimitOptions
) {
  if (!isIpAllowed(request)) {
    return securityError("Esta red no tiene acceso a Cazapiezas Stock.", 403);
  }

  const rateLimit = checkRateLimit(request, rateLimitOptions || DEFAULT_RATE_LIMIT);

  if (!rateLimit.allowed) {
    return securityError(
      `Demasiados intentos. Espera ${rateLimit.retryAfter} segundos y vuelve a intentarlo.`,
      429,
      rateLimit.retryAfter
    );
  }

  return undefined;
}
