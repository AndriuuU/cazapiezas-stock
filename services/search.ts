import { Material } from "@/types/material";
import {
  searchByBarcodeInCache,
  searchByReferenceInCache,
  searchByNameInCache,
  getMaterialDetailsFromCache,
} from "./cache";

/**
 * Búsqueda inteligente: intenta barcode → referencia → nombre
 * TODO ocurre en el caché local (sin peticiones a API)
 */
export async function searchMaterial(
  query: string
): Promise<Material | null> {
  if (!query.trim()) {
    throw new Error("La búsqueda no puede estar vacía");
  }

  // 1. Intenta por código de barras (búsqueda exacta)
  let material = searchByBarcodeInCache(query);
  if (material) {
    return material;
  }

  // 2. Intenta por referencia (búsqueda exacta)
  material = searchByReferenceInCache(query);
  if (material) {
    return material;
  }

  // 3. Intenta por nombre/descripción (búsqueda parcial)
  const results = searchByNameInCache(query);
  if (results.length > 0) {
    return results[0]; // Retorna el primero que coincida
  }

  // No encontrado
  return null;
}

/**
 * Busca específicamente por código de barras
 */
export async function searchByBarcode(barcode: string): Promise<Material | null> {
  if (!barcode.trim()) {
    throw new Error("El código de barras no puede estar vacío");
  }

  return searchByBarcodeInCache(barcode.trim());
}

/**
 * Busca específicamente por referencia
 */
export async function searchByReference(
  reference: string
): Promise<Material | null> {
  if (!reference.trim()) {
    throw new Error("La referencia no puede estar vacía");
  }

  return searchByReferenceInCache(reference.trim());
}

/**
 * Búsqueda de texto libre (por nombre, descripción, etc)
 */
export async function searchByText(query: string): Promise<Material[]> {
  if (!query.trim()) {
    return [];
  }

  return searchByNameInCache(query.trim());
}

/**
 * Obtiene un material específico por ID
 */
export async function getMaterial(materialId: string): Promise<Material | null> {
  if (!materialId.trim()) {
    throw new Error("El ID del material no puede estar vacío");
  }

  return getMaterialDetailsFromCache(materialId);
}

/**
 * Valida que el código sea un código de barras válido
 * (Opcional: agrega validaciones más estrictas según tu caso)
 */
export function isValidBarcode(code: string): boolean {
  // Aceptar cualquier código que sea numérico de 8-15 caracteres
  // (EAN-8, EAN-13, UPC-A, UPC-E, etc)
  return /^\d{8,15}$/.test(code);
}

/**
 * Valida que el formato de referencia sea correcto
 * (Opcional: ajusta según el formato de referencias de tu API)
 */
export function isValidReference(ref: string): boolean {
  // Aceptar referencias que contengan letras, números, guiones
  return /^[A-Za-z0-9\-_]{2,}$/.test(ref);
}