import { getRecambioFacilConfig } from "@/lib/recambio-facil-api";
import { protectApiOrPostmanRequest } from "@/lib/request-security";

function positiveInteger(value: string | null) {
  if (!value) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request) {
  const guard = await protectApiOrPostmanRequest(request, {
    keyPrefix: "desguace:rf-label",
    limit: 30,
    windowMs: 60_000,
  });
  if (guard) return guard;

  try {
    const incoming = new URL(request.url);
    const idPedido = positiveInteger(incoming.searchParams.get("idPedido"));
    const idEnvio = positiveInteger(incoming.searchParams.get("idEnvio"));
    if (!idPedido && !idEnvio) {
      return Response.json({ error: "Indica un idPedido o un idEnvio válido." }, { status: 400 });
    }

    const config = getRecambioFacilConfig();
    if (!config.apiKey) {
      return Response.json({ error: "Falta configurar RECAMBIO_FACIL_API_KEY." }, { status: 500 });
    }
    const endpoint = new URL(`${config.baseUrl}/API/etiqueta`);
    endpoint.searchParams.set("idCliente", String(config.idcliente));
    if (idEnvio) endpoint.searchParams.set("idEnvio", String(idEnvio));
    else if (idPedido) endpoint.searchParams.set("idPedido", String(idPedido));

    const external = await fetch(endpoint, {
      method: "GET",
      headers: { Accept: "application/json", "x-api-key": config.apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });
    const body = await external.arrayBuffer();
    const headers = new Headers({
      "Content-Type": external.headers.get("content-type") || "application/json",
      "Cache-Control": "no-store",
    });
    return new Response(body, { status: external.status, headers });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : "No se pudo consultar la etiqueta en Recambio Fácil.",
    }, { status: 500 });
  }
}
