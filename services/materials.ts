// src/services/materials.ts

import { Material } from "@/types/material";
import { tallergp } from "./tallergp";

export async function searchMaterialByBarcode(barcode: string): Promise<Material | null> {
  try {
    const response = await tallergp.get("/materials", {
      params: {
        material_ref: barcode,
      },
    });

    // La API devuelve un array de resultados
    if (response.data && response.data.data && response.data.data.length > 0) {
      const material = response.data.data[0];
      
      // Si necesitamos detalles completos, obtén del material_id
      if (material.material_id) {
        return getMaterialDetails(material.material_id);
      }
      
      return material;
    }

    return null;
  } catch (error) {
    console.error("Error searching material by barcode:", error);
    throw error;
  }
}

export async function getMaterialDetails(materialId: string): Promise<Material> {
  try {
    const response = await tallergp.get(`/materials/${materialId}`);
    return response.data;
  } catch (error) {
    console.error("Error fetching material details:", error);
    throw error;
  }
}

export async function getAllMaterials(page: number = 1): Promise<{
  materials: Material[];
  pagination: {
    current_page: number;
    per_page: number;
    total_count: number;
    total_pages: number;
  };
}> {
  try {
    const response = await tallergp.get("/materials", {
      params: { page },
    });
    return {
      materials: response.data.data,
      pagination: response.data.pagination,
    };
  } catch (error) {
    console.error("Error fetching materials:", error);
    throw error;
  }
}