import { NextRequest, NextResponse } from "next/server";
import {
  getSessionCookieOptions,
  getSessionFromToken,
  sessionCookieName,
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
  const user = await getSessionFromToken(token);

  if (!user) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json(
        { error: "Inicia sesion para continuar." },
        { status: 401 }
      );
    }

    return redirectToLogin(request);
  }

  if (pathname.startsWith("/admin") && user.rol !== "administrador") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const warehouseAdminPage = pathname === "/almacen-desguace/importar-iam"
    || pathname === "/almacen-desguace/papelera"
    || pathname === "/almacen-desguace/estanterias"
    || /^\/almacen-desguace\/\d+\/editar$/.test(pathname);
  if (warehouseAdminPage && user.rol !== "administrador") {
    return NextResponse.redirect(new URL("/almacen-desguace", request.url));
  }

  const response = NextResponse.next();

  if (token) {
    response.cookies.set(sessionCookieName, token, getSessionCookieOptions(user.rol));
  }

  return response;
}

export const config = {
  matcher: ["/", "/mi-cuenta", "/admin/:path*", "/almacen-desguace/:path*", "/herramientas-comunes/:path*", "/api/:path*"],
};
