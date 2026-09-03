import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { protectAdminApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, supabaseHeaders } from "@/lib/supabase-rest";

type Context = { params: Promise<{ id: string }> };
const SETUP_ERROR = "Falta aplicar la actualización 202609020002_herramientas_inventarios.sql.";

export async function PATCH(request: Request, context: Context) {
  const guard = await protectAdminApiRequest(request, { keyPrefix: "common-tools:inventories:update", limit: 180, windowMs: 60_000 });
  if (guard) return guard;
  try {
    const { id } = await context.params;
    if (!/^\d+$/.test(id)) return NextResponse.json({ error: "Inventario no válido." }, { status: 400 });
    const body = await request.json() as { action?: "scan" | "finish" | "cancel"; herramienta_id?: unknown; markMissing?: unknown };
    const user = await getRequestUser(request);
    const { url, key } = getSupabaseApiConfig();
    let rpc = "";
    let payload: Record<string, unknown>;
    if (body.action === "scan") {
      const toolId = Number(body.herramienta_id);
      if (!Number.isInteger(toolId) || toolId < 1) return NextResponse.json({ error: "Herramienta no válida." }, { status: 400 });
      rpc = "herramientas_comunes_comprobar_inventario";
      payload = { p_inventario_id: Number(id), p_herramienta_id: toolId, p_empleado: user?.nombre || "Administrador" };
    } else if (body.action === "finish") {
      rpc = "herramientas_comunes_finalizar_inventario";
      payload = { p_inventario_id: Number(id), p_empleado: user?.nombre || "Administrador", p_marcar_no_encontradas: body.markMissing !== false };
    } else if (body.action === "cancel") {
      rpc = "herramientas_comunes_cancelar_inventario";
      payload = { p_inventario_id: Number(id), p_empleado: user?.nombre || "Administrador" };
    } else return NextResponse.json({ error: "Acción no válida." }, { status: 400 });

    const response = await fetch(`${url}/rest/v1/rpc/${rpc}`, { method: "POST", headers: supabaseHeaders(key), body: JSON.stringify(payload) });
    if (!response.ok) {
      const responseBody = await response.json().catch(() => null) as { message?: string; error?: string; code?: string } | null;
      const missingUpdate = response.status === 404 || responseBody?.code === "PGRST202";
      return NextResponse.json({ error: missingUpdate ? SETUP_ERROR : responseBody?.message || responseBody?.error || "No se pudo actualizar el inventario." }, { status: missingUpdate ? 503 : 409 });
    }
    return NextResponse.json(await response.json());
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "No se pudo actualizar el inventario." }, { status: 500 });
  }
}
