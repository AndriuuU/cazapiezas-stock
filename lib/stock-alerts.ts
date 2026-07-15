import type { Material } from "@/types/material";

export function getStockMinimum(material: Material) {
  const value = Number(material.alert_threshold ?? 2);
  return Number.isFinite(value) ? Math.max(0, value) : 0;
}

export function hasStockAlertEnabled(material: Material) {
  return getStockMinimum(material) > 0;
}

export function isLowStock(material: Material) {
  return (
    hasStockAlertEnabled(material) &&
    Number(material.quantity ?? 0) <= getStockMinimum(material)
  );
}

export function isOutOfStock(material: Material) {
  return Number(material.quantity ?? 0) <= 0;
}

export function getStockAlertStatus(material: Material) {
  if (!hasStockAlertEnabled(material)) return "disabled" as const;
  if (isOutOfStock(material)) return "out" as const;
  if (isLowStock(material)) return "low" as const;
  return "ok" as const;
}
