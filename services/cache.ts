import axios from "axios";
import { Material } from "@/types/material";

const CACHE_KEY = "cazapiezas_materials_cache";
const CACHE_TIMESTAMP_KEY = "cazapiezas_cache_timestamp";
const CACHE_EXPIRY_HOURS = 24;

const tallergpClient = axios.create({
  baseURL: process.env.NEXT_PUBLIC_TALLERGP_URL,
  headers: {
    Authorization: `Bearer ${process.env.NEXT_PUBLIC_TALLERGP_TOKEN}`,
    "Content-Type": "application/json",
  },
});

/**
 * Comprueba si estamos en navegador
 */
function isBrowser(): boolean {
  return typeof window !== "undefined";
}

/**
 * Obtiene todos los materiales de la API con paginación
 */
async function fetchAllMaterialsFromAPI(): Promise<Material[]> {
  try {
    let allMaterials: Material[] = [];
    let page = 1;
    let hasMorePages = true;

    while (hasMorePages) {
      const response = await tallergpClient.get("/materials", {
        params: {
          page,
          per_page: 100,
        },
      });

      const materials = response.data.data || response.data || [];

      allMaterials = [...allMaterials, ...materials];

      if (response.data.pagination) {
        hasMorePages = page < response.data.pagination.total_pages;
      } else {
        hasMorePages = materials.length === 100;
      }

      page++;
    }

    return allMaterials;
  } catch (error) {
    console.error("Error fetching materials from API:", error);
    throw error;
  }
}

/**
 * Guarda materiales en cache
 */
function saveMaterialsToCache(materials: Material[]): void {
  if (!isBrowser()) return;

  try {
    const now = Date.now();

    localStorage.setItem(CACHE_KEY, JSON.stringify(materials));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, now.toString());
  } catch (error) {
    console.error("Error saving to localStorage:", error);

    try {
      localStorage.removeItem(CACHE_KEY);
      localStorage.setItem(CACHE_KEY, JSON.stringify(materials));
    } catch (e) {
      console.error("Unable to recover cache:", e);
    }
  }
}

/**
 * Lee materiales desde cache
 */
function getMaterialsFromCache(): Material[] | null {
  if (!isBrowser()) return null;

  try {
    const cached = localStorage.getItem(CACHE_KEY);

    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  } catch (error) {
    console.error("Error reading from localStorage:", error);
    return null;
  }
}

/**
 * Comprueba expiración del cache
 */
function isCacheExpired(): boolean {
  if (!isBrowser()) return true;

  try {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);

    if (!timestamp) {
      return true;
    }

    const cachedTime = Number(timestamp);

    if (Number.isNaN(cachedTime)) {
      return true;
    }

    const hoursElapsed =
      (Date.now() - cachedTime) / (1000 * 60 * 60);

    return hoursElapsed > CACHE_EXPIRY_HOURS;
  } catch (error) {
    console.error("Error checking cache expiry:", error);
    return true;
  }
}

/**
 * Carga materiales
 */
export async function loadAllMaterials(
  forceRefresh = false
): Promise<Material[]> {
  if (!forceRefresh) {
    const cached = getMaterialsFromCache();

    if (
      cached &&
      cached.length > 0 &&
      !isCacheExpired()
    ) {
      console.log(
        `✓ Materiales cargados del caché (${cached.length} items)`
      );

      return cached;
    }
  }

  console.log("↓ Cargando materiales desde API...");

  const materials = await fetchAllMaterialsFromAPI();

  saveMaterialsToCache(materials);

  console.log(
    `✓ ${materials.length} materiales guardados en caché`
  );

  return materials;
}

/**
 * Buscar por código de barras
 */
export function searchByBarcodeInCache(
  barcode: string
): Material | null {
  const materials = getMaterialsFromCache();

  if (!materials) {
    return null;
  }

  return (
    materials.find(
      (m) =>
        m.barcode === barcode ||
        m.ean === barcode ||
        m.serial_number === barcode
    ) || null
  );
}

/**
 * Buscar por referencia
 */
export function searchByReferenceInCache(
  reference: string
): Material | null {
  const materials = getMaterialsFromCache();

  if (!materials) {
    return null;
  }

  return (
    materials.find(
      (m) => m.reference === reference
    ) || null
  );
}

/**
 * Buscar por nombre
 */
export function searchByNameInCache(
  query: string
): Material[] {
  const materials = getMaterialsFromCache();

  if (!materials) {
    return [];
  }

  const lowerQuery = query.toLowerCase();

  return materials.filter(
    (m) =>
      m.name?.toLowerCase().includes(lowerQuery) ||
      m.description?.toLowerCase().includes(lowerQuery) ||
      m.reference?.toLowerCase().includes(lowerQuery)
  );
}

/**
 * Todos los materiales cacheados
 */
export function getAllMaterialsFromCache(): Material[] {
  return getMaterialsFromCache() || [];
}

/**
 * Actualiza el stock de un material en el cache local.
 */
export function updateMaterialQuantityInCache(
  materialId: string,
  quantity: number
): void {
  const materials = getMaterialsFromCache();

  if (!materials) {
    return;
  }

  const updatedMaterials = materials.map((material) =>
    material.material_id === materialId
      ? { ...material, quantity }
      : material
  );

  saveMaterialsToCache(updatedMaterials);
}

/**
 * Detalle material cacheado
 */
export function getMaterialDetailsFromCache(
  materialId: string
): Material | null {
  const materials = getMaterialsFromCache();

  if (!materials) {
    return null;
  }

  return (
    materials.find(
      (m) => m.material_id === materialId
    ) || null
  );
}

/**
 * Limpiar cache
 */
export function clearCache(): void {
  if (!isBrowser()) return;

  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);

    console.log("✓ Caché limpiado");
  } catch (error) {
    console.error("Error clearing cache:", error);
  }
}

/**
 * Información cache
 */
export function getCacheInfo(): {
  itemCount: number;
  sizeKB: number;
  lastUpdated: string | null;
  isExpired: boolean;
} {
  if (!isBrowser()) {
    return {
      itemCount: 0,
      sizeKB: 0,
      lastUpdated: null,
      isExpired: true,
    };
  }

  try {
    const materials = getMaterialsFromCache();
    const timestamp = localStorage.getItem(
      CACHE_TIMESTAMP_KEY
    );

    let sizeKB = 0;

    const cached = localStorage.getItem(CACHE_KEY);

    if (cached) {
      sizeKB = new Blob([cached]).size / 1024;
    }

    return {
      itemCount: materials?.length || 0,
      sizeKB: Math.round(sizeKB * 100) / 100,
      lastUpdated: timestamp
        ? new Date(Number(timestamp)).toLocaleString()
        : null,
      isExpired: isCacheExpired(),
    };
  } catch (error) {
    console.error("Error getting cache info:", error);

    return {
      itemCount: 0,
      sizeKB: 0,
      lastUpdated: null,
      isExpired: true,
    };
  }
}

/**
 * Obtener detalle completo desde API
 */
export async function getMaterialDetails(
  materialId: string
): Promise<Material> {
  try {
    const response = await tallergpClient.get(
      `/materials/${materialId}`
    );

    return response.data;
  } catch (error) {
    console.error(
      `Error fetching material ${materialId}:`,
      error
    );

    throw error;
  }
}
