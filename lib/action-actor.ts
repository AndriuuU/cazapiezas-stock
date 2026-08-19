import "server-only";

import { getRequestUser } from "@/lib/auth";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { AppUser } from "@/lib/app-users";

export async function resolveActionActor(request: Request, requestedUserId: unknown): Promise<AppUser | null> {
  const signedUser = await getRequestUser(request);
  if (!signedUser) return null;
  if (signedUser.rol !== "administrador") return signedUser;
  const id = String(requestedUserId || "").trim();
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const { url, key } = getSupabaseApiConfig();
  const params = new URLSearchParams({ select: "id,nombre,rol", id: `eq.${id}`, activo: "eq.true", limit: "1" });
  const response = await fetch(`${url}/rest/v1/cazapiezas_usuarios?${params}`, { headers: supabaseHeaders(key), cache: "no-store" });
  if (!response.ok) return null;
  return (await parseSupabaseResponse<AppUser[]>(response))[0] || null;
}
