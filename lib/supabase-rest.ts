import { getSupabaseRestConfig } from "@/lib/supabase";

export function getSupabaseApiConfig() {
  const { url, anonKey } = getSupabaseRestConfig();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || anonKey;
  return { url, key };
}

export function supabaseHeaders(key: string, extra?: Record<string, string>) {
  return {
    apikey: key,
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

export async function parseSupabaseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(body?.message || body?.error || `Supabase error ${response.status}`);
  }
  return response.json() as Promise<T>;
}
