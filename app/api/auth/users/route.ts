import { NextResponse } from "next/server";
import { protectPublicAuthRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { AppUser } from "@/lib/app-users";

export async function GET(request: Request) {
  const guard = protectPublicAuthRequest(request, { keyPrefix: "login-users", limit: 40, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/cazapiezas_usuarios?select=id,nombre,rol&activo=eq.true&order=nombre.asc`, { headers: supabaseHeaders(key), cache: "no-store" });
    if (response.status === 404) return NextResponse.json({ users: [], setupRequired: true });
    const users = await parseSupabaseResponse<AppUser[]>(response);
    return NextResponse.json({ users });
  } catch { return NextResponse.json({ users: [], setupRequired: true }); }
}
