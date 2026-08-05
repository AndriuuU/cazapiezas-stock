const PRINT_BRIDGE_URL_KEY = "cazapiezas_print_bridge_url";
const DEFAULT_PRINT_BRIDGE_URL = "http://192.168.1.36:8765";

export function openBrotherPrint(html: string) {
  const bridgeUrl = window.localStorage.getItem(PRINT_BRIDGE_URL_KEY) || DEFAULT_PRINT_BRIDGE_URL;
  const bytes = new TextEncoder().encode(html);
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  const payload = window.btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
  const popup = window.open(`${bridgeUrl.replace(/\/$/, "")}/#job=${payload}`, "_blank");
  if (!popup) throw new Error("El navegador ha bloqueado la ventana del puente de impresión.");
}
