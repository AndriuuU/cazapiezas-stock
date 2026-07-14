import { NextRequest, NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  sessionCookieName,
  verifySessionToken,
} from "@/lib/auth";
import { isIpAllowed } from "@/lib/request-security";

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL("/login", request.url);

  loginUrl.searchParams.set("next", request.nextUrl.pathname + request.nextUrl.search);

  return NextResponse.redirect(loginUrl);
}

export async function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isAuthRoute = pathname.startsWith("/api/auth/");
  const isLoginPage = pathname === "/login";

  if (!isIpAllowed(request)) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Esta red no tiene acceso a Cazapiezas Stock." },
        { status: 403 }
      );
    }

    return NextResponse.rewrite(new URL("/login", request.url));
  }

  if (isAuthRoute || isLoginPage) {
    return NextResponse.next();
  }

  const token = request.cookies.get(sessionCookieName)?.value;
  const isAuthenticated = await verifySessionToken(token);

  if (!isAuthenticated) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Inicia sesion para continuar." },
        { status: 401 }
      );
    }

    return redirectToLogin(request);
  }

  const response = NextResponse.next();

  if (token) {
    response.cookies.set(sessionCookieName, token, getSessionCookieOptions());
  }

  return response;
}

export const config = {
  matcher: ["/", "/admin/:path*", "/api/:path*"],
};
