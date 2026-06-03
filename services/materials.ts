import axios from "axios";
import { Material } from "@/types/material";

const tallergpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_TALLERGP_URL,
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_TALLERGP_TOKEN}`,
    "Content-Type": "application/json",
  },
});

/**
 * Busca un material por código de barras O referencia
 * Primero intenta buscar por código de barras, luego por referencia
 */
export async function searchMaterial(
  query: string
): Promise<Material | null> {
  try {
    // Primero, intenta buscar por código de barras en la lista de materiales
    const allMaterials = await fetchAllMaterials();
    
    // Busca por código de barras exacto
    let material = allMaterials.find(
      (m) =>
        m.barcode === query ||
        m.serial_number === query ||
        m.ean === query
    );

    if (material) {
      // Si encontramos el material por código de barras, obtén los detalles completos
      return await getMaterialDetails(material.material_id);
    }

    // Si no encontramos por código de barras, intenta por referencia
    material = allMaterials.find((m) => m.reference === query);

    if (material) {
      return await getMaterialDetails(material.material_id);
    }

    // Si aún no encontramos nada, intenta buscar por nombre o descripción
    material = allMaterials.find(
      (m) =>
        m.name?.toLowerCase().includes(query.toLowerCase()) ||
        m.description?.toLowerCase().includes(query.toLowerCase())
    );

    if (material) {
      return await getMaterialDetails(material.material_id);
    }

    return null;
  } catch (error) {
    console.error("Error searching material:", error);
    throw error;
  }
}

/**
 * Busca específicamente por código de barras
 * Útil si quieres manejar el flujo manualmente
 */
export async function searchByBarcode(
  barcode: string
): Promise<Material | null> {
  try {
    const allMaterials = await fetchAllMaterials();
    const material = allMaterials.find(
      (m) =>
        m.barcode === barcode ||
        m.serial_number === barcode ||
        m.ean === barcode
    );

    if (material) {
      return await getMaterialDetails(material.material_id);
    }

    return null;
  } catch (error) {
    console.error("Error searching by barcode:", error);
    throw error;
  }
}

/**
 * Busca específicamente por referencia
 */
export async function searchByReference(
  reference: string
): Promise<Material | null> {
  try {
    const allMaterials = await fetchAllMaterials();
    const material = allMaterials.find((m) => m.reference === reference);

    if (material) {
      return await getMaterialDetails(material.material_id);
    }

    return null;
  } catch (error) {
    console.error("Error searching by reference:", error);
    throw error;
  }
}

/**
 * Obtiene todos los materiales con paginación
 */
async function fetchAllMaterials(): Promise<Material[]> {
  try {
    const response = await tallergpClient.get("/materials", {
      params: {
        per_page: 1000, // Obtén más materiales por página
      },
    });

    // Maneja paginación si es necesario
    let materials = response.data.data || response.data;

    // Si hay paginación, obtén todas las páginas
    if (response.data.pagination && response.data.pagination.total_pages > 1) {
      for (let page = 2; page <= response.data.pagination.total_pages; page++) {
        const pageResponse = await tallergpClient.get("/materials", {
          params: {
            page,
            per_page: 1000,
          },
        });
        materials = [...materials, ...(pageResponse.data.data || pageResponse.data)];
      }
    }

    return materials;
  } catch (error) {
    console.error("Error fetching all materials:", error);
    throw error;
  }
}

/**
 * Obtiene los detalles completos de un material
 */
export async function getMaterialDetails(
  materialId: string
): Promise<Material> {
  try {
    const response = await tallergpClient.get(`/materials/${materialId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching material ${materialId}:`, error);
    throw error;
  }
}

/**
 * Obtiene el listado inicial de materiales (para búsqueda)
 */
export async function getMaterials(page: number = 1, perPage: number = 10) {
  try {
    const response = await tallergpClient.get("/materials", {
      params: {
        page,
        per_page: perPage,
      },
    });
    return response.data;
  } catch (error) {
    console.error("Error fetching materials:", error);
    throw error;
  }
}