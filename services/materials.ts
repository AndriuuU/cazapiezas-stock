// src/services/materials.ts

import { tallergp } from "./tallergp";

export async function searchMaterial(barcode: string) {
  const response = await tallergp.get("/materials");

  const material = response.data.data.find(
    (item: any) => item.serial_number === barcode
  );

  return material;
}