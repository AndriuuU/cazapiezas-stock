import axios from "axios";
import { Material } from "@/types/material";

async function fetchAllMaterials(): Promise<Material[]> {
  const response = await axios.get<Material[]>("/api/materials", {
    params: {
      all: "true",
    },
  });

  return response.data;
}

export async function searchMaterial(query: string): Promise<Material | null> {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return null;
  }

  const allMaterials = await fetchAllMaterials();
  const material = allMaterials.find(
    (item) =>
      item.barcode === query ||
      item.serial_number === query ||
      item.ean === query ||
      item.reference === query ||
      item.name?.toLowerCase().includes(normalizedQuery) ||
      item.description?.toLowerCase().includes(normalizedQuery)
  );

  return material ? getMaterialDetails(material.material_id) : null;
}

export async function searchByBarcode(barcode: string): Promise<Material | null> {
  const allMaterials = await fetchAllMaterials();
  const material = allMaterials.find(
    (item) =>
      item.barcode === barcode ||
      item.serial_number === barcode ||
      item.ean === barcode
  );

  return material ? getMaterialDetails(material.material_id) : null;
}

export async function searchByReference(
  reference: string
): Promise<Material | null> {
  const allMaterials = await fetchAllMaterials();
  const material = allMaterials.find((item) => item.reference === reference);

  return material ? getMaterialDetails(material.material_id) : null;
}

export async function getMaterialDetails(materialId: string): Promise<Material> {
  const response = await axios.get<Material>("/api/materials", {
    params: {
      material_id: materialId,
    },
  });

  return response.data;
}

export async function getMaterials(page: number = 1, perPage: number = 10) {
  const response = await axios.get("/api/materials", {
    params: {
      page,
      per_page: perPage,
    },
  });

  return response.data;
}
