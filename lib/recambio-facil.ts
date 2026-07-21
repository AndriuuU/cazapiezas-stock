import type { PiezaDesguace } from "@/types/almacen-desguace";

type PiezaRecambioFacil = Pick<PiezaDesguace, "publicado_online" | "procedencia" | "descripcion" | "referencia_principal" | "referencia_oem">;

function hasRecambioFacilLabel(value: string | null | undefined) {
  return /(^|[\s,;|[(])(r\s*\/?\s*f|recambio\s*f[aá]cil)(?=$|[\s,;|)\]])/i.test(value || "");
}

export function getRecambioFacilReference(piece: PiezaRecambioFacil) {
  return (piece.referencia_principal || piece.referencia_oem || "").trim() || null;
}

export function isRecambioFacilPiece(piece: PiezaRecambioFacil) {
  return piece.publicado_online || hasRecambioFacilLabel(piece.procedencia) || hasRecambioFacilLabel(piece.descripcion);
}

export function getRecambioFacilUrl(piece: PiezaRecambioFacil) {
  const reference = getRecambioFacilReference(piece);
  if (!reference || !isRecambioFacilPiece(piece)) return null;

  const params = new URLSearchParams({
    paginacion: "1|1|1|1|1|1|1",
    "orden-original": "1",
    "orden-equivalente": "1",
    "orden-desguace": "1",
    bac: "",
    idmarcabuscador: "",
    idmarcaoem: "",
    idmarcaiam: "",
    active: "0",
    ref: reference,
    referencia: "1",
    search: "search",
  });

  return `https://www.recambiofacil.com/login/buscador?${params.toString()}`;
}
