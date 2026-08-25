"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import {
  AlertTriangle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Barcode,
  Check,
  Clipboard,
  Clock,
  Download,
  Edit3,
  Eye,
  Filter,
  LayoutDashboard,
  Loader2,
  Package,
  PackageSearch,
  PackageMinus,
  PackagePlus,
  Printer,
  RefreshCw,
  Save,
  SlidersHorizontal,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import Logo from "@/components/Logo";
import { createInternalEan13 } from "@/lib/barcodes";
import {
  getStockAlertStatus,
  getStockMinimum,
  isLowStock,
} from "@/lib/stock-alerts";
import {
  getAllMaterialsFromCache,
  loadAllMaterials,
  updateMaterialInCache,
} from "@/services/cache";
import { Material } from "@/types/material";

interface Adjustment {
  id: string;
  material_id: string;
  reference: string;
  name: string;
  quantity_before: number;
  quantity_after: number;
  difference: number;
  status?: "pending" | "completed" | "created" | string;
  created_at: string;
  barcode?: string;
  material_name?: string;
  deleted_from_tallergp?: boolean;
  product_snapshot?: ProductSnapshot;
}

interface ProductSnapshot {
  reference?: string;
  name?: string;
  description?: string;
  barcode?: string;
  quantity?: number;
  cost?: number;
  pvp?: number;
  tax_rate?: number;
  alert_threshold?: number;
  created_at?: string;
}

type AdminView =
  | "dashboard"
  | "materials"
  | "stock"
  | "products"
  | "labels"
  | "employees"
  | "exports";
type SortKey = "created_at" | "employee" | "reference" | "difference";
type MaterialStockFilter = "all" | "available" | "low" | "out" | "disabled";
type LabelSize = "62x29" | "62x32" | "62x42";
type LabelMode = "article-code" | "reference-code" | "code";

interface MaterialFormState {
  material_id: string;
  reference: string;
  name: string;
  barcode: string;
  quantity: string;
  unit: string;
  cost: string;
  pvp: string;
  tax_rate: string;
  alert_threshold: string;
}

interface TallerGpMaterialMovement {
  id: string;
  movement_date?: string;
  quantity?: number;
  entry_id?: string | null;
  sales_delivery_note_id?: string | null;
  invoice_id?: string | null;
  ticket_id?: string | null;
  purchase_delivery_note_id?: string | null;
  description?: string | null;
}

function getMaterialBarcode(material: Material) {
  return String(material.barcode || material.ean || material.serial_number || "").trim();
}

function getMaterialName(material: Material) {
  return material.name || material.description || material.reference || "";
}

function buildMaterialForm(
  material: Material,
  overrides: Partial<MaterialFormState> = {}
): MaterialFormState {
  return {
    material_id: material.material_id,
    reference: material.reference || "",
    name: getMaterialName(material),
    barcode: getMaterialBarcode(material),
    quantity: String(Number(material.quantity ?? 0)),
    unit: material.unit || "",
    cost: material.cost === undefined ? "" : String(material.cost),
    pvp: material.pvp === undefined ? "" : String(material.pvp),
    tax_rate: String(material.tax_rate ?? material.iva ?? 21),
    alert_threshold: String(material.alert_threshold ?? 2),
    ...overrides,
  };
}

interface LabelSettings {
  size: LabelSize;
  mode: LabelMode;
  articleFontSize: number;
  showReference: boolean;
}

interface ActivityTableProps {
  rows: Adjustment[];
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSort: (key: SortKey) => void;
  isProductCreated: (item: Adjustment) => boolean;
  getEmployeeName: (item: Adjustment) => string;
  getDisplayName: (item: Adjustment) => string;
  markAsCompleted: (id: string) => Promise<void>;
  printBarcodeLabel: (item: Adjustment) => Promise<void>;
  onOpenProduct: (item: Adjustment) => void;
  removeProductLocally?: (id: string) => Promise<void>;
  removingProducts?: Set<string>;
}

const PRODUCT_CREATED_PREFIX = "[PRODUCTO NUEVO] ";
const EMPLOYEE_PREFIX_PATTERN = /^\[EMPLEADO: ([^\]]+)\]\s*/;
const PRODUCT_BARCODE_SUFFIX_PATTERN = /\s*\[CODIGO: ([^\]]+)\]\s*$/;
const PRODUCT_SNAPSHOT_SUFFIX_PATTERN = /\s*\[FICHA: ([^\]]+)\]\s*$/;
const LABEL_SETTINGS_KEY = "cazapiezas_label_settings_v2";
const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  size: "62x42",
  mode: "article-code",
  articleFontSize: 11,
  showReference: false,
};

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanActivityName(value: string) {
  return value
    .replace(EMPLOYEE_PREFIX_PATTERN, "")
    .replace(PRODUCT_SNAPSHOT_SUFFIX_PATTERN, "")
    .replace(PRODUCT_BARCODE_SUFFIX_PATTERN, "");
}

const EAN13_LEFT_ODD: Record<string, string> = {
  "0": "0001101",
  "1": "0011001",
  "2": "0010011",
  "3": "0111101",
  "4": "0100011",
  "5": "0110001",
  "6": "0101111",
  "7": "0111011",
  "8": "0110111",
  "9": "0001011",
};
const EAN13_LEFT_EVEN: Record<string, string> = {
  "0": "0100111",
  "1": "0110011",
  "2": "0011011",
  "3": "0100001",
  "4": "0011101",
  "5": "0111001",
  "6": "0000101",
  "7": "0010001",
  "8": "0001001",
  "9": "0010111",
};
const EAN13_RIGHT: Record<string, string> = {
  "0": "1110010",
  "1": "1100110",
  "2": "1101100",
  "3": "1000010",
  "4": "1011100",
  "5": "1001110",
  "6": "1010000",
  "7": "1000100",
  "8": "1001000",
  "9": "1110100",
};
const EAN13_PARITY: Record<string, string> = {
  "0": "OOOOOO",
  "1": "OOEOEE",
  "2": "OOEEOE",
  "3": "OOEEEO",
  "4": "OEOOEE",
  "5": "OEEOOE",
  "6": "OEEEOO",
  "7": "OEOEOE",
  "8": "OEOEEO",
  "9": "OEEOEO",
};

function buildEan13Svg(barcode: string) {
  if (!/^\d{13}$/.test(barcode)) {
    return "";
  }

  const parity = EAN13_PARITY[barcode[0]];
  const leftBits = barcode
    .slice(1, 7)
    .split("")
    .map((digit, index) =>
      parity[index] === "O" ? EAN13_LEFT_ODD[digit] : EAN13_LEFT_EVEN[digit]
    )
    .join("");
  const rightBits = barcode
    .slice(7)
    .split("")
    .map((digit) => EAN13_RIGHT[digit])
    .join("");
  const bits = `101${leftBits}01010${rightBits}101`;
  const bars = bits
    .split("")
    .map((bit, index) =>
      bit === "1"
        ? `<rect x="${index * 2}" y="0" width="2" height="34" fill="#000" />`
        : ""
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="234" height="50" viewBox="-22 0 234 50" role="img" aria-label="${barcode}">
    <rect x="-22" width="234" height="50" fill="#fff" />
    <g transform="translate(0 1)">${bars}</g>
    <text x="95" y="48" text-anchor="middle" font-family="Arial, sans-serif" font-size="13" letter-spacing="2">${barcode}</text>
  </svg>`;
}

function isToday(value: string) {
  return new Date(value).toDateString() === new Date().toDateString();
}

function SortButton({
  id,
  label,
  sortKey,
  sortDirection,
  onSort,
}: {
  id: SortKey;
  label: string;
  sortKey: SortKey;
  sortDirection: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onSort(id)}
      className="inline-flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wider text-zinc-400 hover:text-white"
    >
      {label}
      {sortKey === id &&
        (sortDirection === "asc" ? <ArrowUp size={13} /> : <ArrowDown size={13} />)}
    </button>
  );
}

function ActivityTable({
  rows,
  sortKey,
  sortDirection,
  onSort,
  isProductCreated,
  getEmployeeName,
  getDisplayName,
  markAsCompleted,
  printBarcodeLabel,
  onOpenProduct,
  removeProductLocally,
  removingProducts = new Set(),
}: ActivityTableProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-800/50 border-b border-zinc-700">
              <th className="p-4">
                <SortButton
                  id="reference"
                  label="Referencia / Artículo"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>
              <th className="p-4">
                <SortButton
                  id="employee"
                  label="Empleado"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>
              <th className="p-4 text-center">Antes</th>
              <th className="p-4 text-center">Después</th>
              <th className="p-4 text-center">
                <SortButton
                  id="difference"
                  label="Movimiento"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>
              <th className="p-4">
                <SortButton
                  id="created_at"
                  label="Fecha"
                  sortKey={sortKey}
                  sortDirection={sortDirection}
                  onSort={onSort}
                />
              </th>
              <th className="p-4 text-right">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800 text-sm">
            {rows.map((item) => {
              const isCreated = isProductCreated(item);
              const isRemoving = removingProducts.has(item.id);

              return (
                <tr
                  key={item.id}
                  className={`hover:bg-zinc-800/30 transition-all ${
                    isRemoving ? "opacity-50 animate-pulse" : ""
                  }`}
                  style={{
                    animation: isRemoving ? "fadeOut 0.3s ease-out forwards" : "none",
                  }}
                >
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded text-cyan-400 font-bold border border-zinc-800 flex items-center gap-1">
                        {item.reference}
                        <button
                          onClick={() => navigator.clipboard.writeText(item.reference)}
                          className="hover:text-white p-0.5"
                          title="Copiar referencia"
                        >
                          <Clipboard size={12} />
                        </button>
                      </span>
                    </div>
                    <p className="text-white font-medium mt-1 line-clamp-1">
                      {getDisplayName(item)}
                    </p>
                    <button
                      type="button"
                      onClick={() => onOpenProduct(item)}
                      className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-zinc-400 transition-colors hover:text-white"
                    >
                      <Eye size={14} />
                      Ver ficha
                    </button>
                  </td>
                  <td className="p-4 text-zinc-300">
                    {isCreated ? "-" : getEmployeeName(item) || "-"}
                  </td>
                  <td className="p-4 text-center text-zinc-400 font-medium">
                    {isCreated ? "-" : `${item.quantity_before} u`}
                  </td>
                  <td className="p-4 text-center text-white font-bold">
                    {item.quantity_after} u
                  </td>
                  <td className="p-4 text-center">
                    <span
                      className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-xs ${
                        isCreated
                          ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                          : item.difference > 0
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-red-500/10 text-red-400 border border-red-500/20"
                      }`}
                    >
                      {isCreated && <PackagePlus size={14} />}
                      {isCreated
                        ? "Producto nuevo"
                        : item.difference > 0
                          ? `+${item.difference}`
                          : item.difference}
                    </span>
                  </td>
                  <td className="p-4 text-zinc-500">
                    {new Date(item.created_at).toLocaleString()}
                  </td>
                  <td className="p-4 text-right">
                    {isCreated ? (
                      item.barcode ? (
                        <div className="flex flex-col items-end gap-2">
                          {item.deleted_from_tallergp && removeProductLocally && (
                            <button
                              onClick={() => removeProductLocally(item.id)}
                              disabled={isRemoving}
                              className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 disabled:opacity-50 disabled:cursor-not-allowed text-red-300 font-semibold rounded-lg border border-red-800 transition-all flex items-center gap-1 ml-auto"
                            >
                              <Trash2 size={16} />
                              Eliminar
                            </button>
                          )}
                          {!item.deleted_from_tallergp && (
                            <>
                              {item.status === "completed" && (
                                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold">
                                  <Barcode size={14} />
                                  Etiqueta impresa
                                </span>
                              )}
                              <button
                                onClick={() => printBarcodeLabel(item)}
                                className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white font-semibold rounded-lg border border-cyan-500 transition-all flex items-center gap-1 ml-auto"
                              >
                                <Printer size={16} />
                                Imprimir
                              </button>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          {item.deleted_from_tallergp && removeProductLocally && (
                            <button
                              onClick={() => removeProductLocally(item.id)}
                              className="px-4 py-2 bg-red-900/40 hover:bg-red-900/60 text-red-300 font-semibold rounded-lg border border-red-800 transition-all flex items-center gap-1 ml-auto"
                            >
                              <Trash2 size={16} />
                              Eliminar
                            </button>
                          )}
                          {!item.deleted_from_tallergp && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20 text-xs font-bold">
                              <AlertTriangle size={14} />
                              Sin codigo
                            </span>
                          )}
                        </div>
                      )
                    ) : item.status === "pending" ? (
                      <button
                        onClick={() => markAsCompleted(item.id)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg border border-zinc-700 transition-all flex items-center gap-1 ml-auto"
                      >
                        <Clock size={16} />
                        Pendiente
                      </button>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold">
                        <Check size={14} />
                        Guardado
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminPanel() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [lowStockMaterials, setLowStockMaterials] = useState<Material[]>([]);
  const [ignoringStockId, setIgnoringStockId] = useState("");
  const [stockAlertError, setStockAlertError] = useState("");
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AdminView>("dashboard");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [employees, setEmployees] = useState<string[]>([]);
  const [newEmployee, setNewEmployee] = useState("");
  const [savingEmployees, setSavingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<Adjustment | null>(null);
  const [removingProducts, setRemovingProducts] = useState<Set<string>>(new Set());
  const [labelSettings, setLabelSettings] = useState<LabelSettings>(() => {
    if (typeof window === "undefined") {
      return DEFAULT_LABEL_SETTINGS;
    }

    try {
      return {
        ...DEFAULT_LABEL_SETTINGS,
        ...JSON.parse(localStorage.getItem(LABEL_SETTINGS_KEY) || "{}"),
      };
    } catch {
      return DEFAULT_LABEL_SETTINGS;
    }
  });

  const isProductCreated = useCallback(
    (item: Adjustment) =>
      item.status === "created" || item.name?.startsWith(PRODUCT_CREATED_PREFIX),
    []
  );

  const getEmployeeName = useCallback((item: Adjustment) => {
    const match = item.name?.match(EMPLOYEE_PREFIX_PATTERN);

    return match?.[1] || "";
  }, []);

  const getDisplayName = useCallback((item: Adjustment) => {
    if (item.material_name) {
      return item.material_name;
    }

    const withoutProductPrefix = item.name?.startsWith(PRODUCT_CREATED_PREFIX)
      ? item.name.slice(PRODUCT_CREATED_PREFIX.length)
      : item.name;

    return withoutProductPrefix ? cleanActivityName(withoutProductPrefix) : "";
  }, []);

  const stockMovements = useMemo(
    () => adjustments.filter((item) => !isProductCreated(item)),
    [adjustments, isProductCreated]
  );

  const productCreations = useMemo(
    () => adjustments.filter(isProductCreated),
    [adjustments, isProductCreated]
  );

  const dashboardTotals = useMemo(() => {
    const todayMovements = stockMovements.filter((item) => isToday(item.created_at));
    const todayProducts = productCreations.filter((item) => isToday(item.created_at));
    const stockUp = todayMovements
      .filter((item) => item.difference > 0)
      .reduce((total, item) => total + item.difference, 0);
    const stockDown = todayMovements
      .filter((item) => item.difference < 0)
      .reduce((total, item) => total + Math.abs(item.difference), 0);

    return {
      todayMovements: todayMovements.length,
      todayProducts: todayProducts.length,
      stockUp,
      stockDown,
    };
  }, [productCreations, stockMovements]);

  const getSortableValue = useCallback(
    (item: Adjustment, key: SortKey) => {
      if (key === "created_at") return new Date(item.created_at).getTime();
      if (key === "employee") return getEmployeeName(item).toLowerCase();
      if (key === "reference") return item.reference.toLowerCase();
      return item.difference;
    },
    [getEmployeeName]
  );

  const sortActivities = useCallback(
    (items: Adjustment[]) =>
      [...items].sort((a, b) => {
        const aValue = getSortableValue(a, sortKey);
        const bValue = getSortableValue(b, sortKey);

        if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
        if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
        return 0;
      }),
    [getSortableValue, sortDirection, sortKey]
  );

  const sortedStockMovements = useMemo(
    () => sortActivities(stockMovements),
    [sortActivities, stockMovements]
  );

  const sortedProductCreations = useMemo(
    () => sortActivities(productCreations),
    [productCreations, sortActivities]
  );

  const pendingLabelCreations = useMemo(
    () => sortedProductCreations.filter((item) => item.status === "pending"),
    [sortedProductCreations]
  );

  const updateLowStockMaterials = useCallback((materials: Material[]) => {
    const lowStock = materials
      .filter(isLowStock)
      .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
      .slice(0, 6);

    setLowStockMaterials(lowStock);
  }, []);

  const refreshLowStock = useCallback(async () => {
    try {
      const materials = await loadAllMaterials(false);
      updateLowStockMaterials(materials);
    } catch (error) {
      console.error("Error refreshing low stock:", error);
      updateLowStockMaterials(getAllMaterialsFromCache());
    }
  }, [updateLowStockMaterials]);

  const ignoreStockAlert = useCallback(async (material: Material) => {
    setIgnoringStockId(material.material_id);
    setStockAlertError("");

    try {
      const response = await axios.put("/api/materials", {
        material_id: material.material_id,
        alert_threshold: 0,
      });
      const updatedMaterial = response.data.material as Material;

      updateMaterialInCache(updatedMaterial);
      setLowStockMaterials((current) =>
        current.filter((item) => item.material_id !== material.material_id)
      );
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : error instanceof Error
          ? error.message
          : "Error desconocido";
      setStockAlertError(`No se pudo ignorar la alerta: ${message}`);
    } finally {
      setIgnoringStockId("");
    }
  }, []);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const [adjustmentsResult] = await Promise.allSettled([
        axios.get("/api/adjustments"),
        refreshLowStock(),
      ]);

      if (adjustmentsResult.status === "fulfilled") {
        setAdjustments(adjustmentsResult.value.data);
      } else {
        console.error("Error fetching data:", adjustmentsResult.reason);
      }
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, [refreshLowStock]);

  const fetchEmployees = useCallback(async () => {
    try {
      const response = await axios.get("/api/employees");
      setEmployees(Array.isArray(response.data.employees) ? response.data.employees : []);
    } catch (err) {
      console.error("Error fetching employees:", err);
    }
  }, []);

  const addEmployee = () => {
    const employee = newEmployee.trim();

    if (!employee) return;

    setEmployees((current) =>
      current.includes(employee) ? current : [...current, employee]
    );
    setNewEmployee("");
    setEmployeeError("");
  };

  const removeEmployee = (employee: string) => {
    setEmployees((current) => current.filter((item) => item !== employee));
    setEmployeeError("");
  };

  const saveEmployees = async () => {
    if (employees.length === 0) {
      setEmployeeError("Añade al menos un empleado.");
      return;
    }

    setSavingEmployees(true);
    setEmployeeError("");

    try {
      const response = await axios.post("/api/employees", { employees });
      setEmployees(response.data.employees);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : "Error desconocido";

      setEmployeeError(`No se pudieron guardar los empleados: ${message}`);
    } finally {
      setSavingEmployees(false);
    }
  };

  const markAsCompleted = async (id: string) => {
    try {
      await axios.put("/api/adjustments", { id, status: "completed" });
      setAdjustments((current) =>
        current.map((item) =>
          item.id === id ? { ...item, status: "completed" } : item
        )
      );
    } catch (err) {
      console.error("Error updating status:", err);
    }
  };

  const markLabelsAsCompleted = async (items: Adjustment[]) => {
    const pendingItems = items.filter((item) => item.status === "pending");

    if (pendingItems.length === 0) {
      return;
    }

    await Promise.all(pendingItems.map((item) => markAsCompleted(item.id)));
  };

  const removeProductLocally = async (id: string) => {
    if (!window.confirm("¿Estás seguro de que quieres eliminar este producto del listado local?")) {
      return;
    }
    
    // Marcar como eliminando para mostrar animación
    setRemovingProducts((current) => new Set([...current, id]));
    
    // Esperar a que termine la animación (300ms)
    await new Promise((resolve) => setTimeout(resolve, 300));
    
    // Remover del estado
    setAdjustments((current) => current.filter((item) => item.id !== id));
    setRemovingProducts((current) => {
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  };

  const buildLabelHtml = (items: Adjustment[]) => {
    const [labelWidth, labelHeight] = labelSettings.size
      .split("x")
      .map(Number);
    const showArticle = labelSettings.mode !== "code";
    const barcodeHeight = showArticle ? labelHeight - 13 : labelHeight - 6;
    const isProductLabel = labelSettings.size === "62x42";
    const labels = items
      .filter((item) => item.barcode)
      .map((item) => {
        const barcode = item.barcode || "";
        const primaryText =
          labelSettings.mode === "reference-code" ? item.reference : getDisplayName(item);
        const articleText =
          labelSettings.showReference && labelSettings.mode === "article-code"
            ? `${item.reference} - ${primaryText}`
            : primaryText;

        if (isProductLabel) {
          const snapshot = item.product_snapshot;
          const pvp = Number(snapshot?.pvp);
          const taxRate = Number(snapshot?.tax_rate);
          const hasPrice = Number.isFinite(pvp);
          const priceWithTax = hasPrice
            ? pvp * (1 + (Number.isFinite(taxRate) ? taxRate : 0) / 100)
            : undefined;
          const formattedPrice = priceWithTax?.toLocaleString("es-ES", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          });
          const description = snapshot?.description || "";

          return `<div class="label product-label">
    <header class="label-header">
      <div class="identity">
        <div class="brand">
          <span class="brand-mark"><img src="${window.location.origin}/logo.png" alt="" /></span>
          <strong>CAZAPIEZAS</strong>
        </div>
        <div class="reference"><span>REF:</span><strong>${escapeHtml(item.reference)}</strong></div>
      </div>
      <div class="price${formattedPrice ? "" : " price-empty"}">
        <small>PVP</small>
        <strong>${formattedPrice ? `${escapeHtml(formattedPrice)} €` : "—"}</strong>
        <small>IVA incl.</small>
      </div>
    </header>
    <div class="divider"></div>
    <div class="product-name">${escapeHtml(getDisplayName(item))}</div>
    <div class="description">${description ? escapeHtml(description) : "&nbsp;"}</div>
    <div class="barcode">${buildEan13Svg(barcode)}</div>
  </div>`;
        }

        return `<div class="label">
    ${
      showArticle
        ? `<div class="article">${escapeHtml(articleText)}</div>`
        : ""
    }
    ${buildEan13Svg(barcode)}
  </div>`;
      })
      .join("");

    return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Etiquetas Cazapiezas</title>
  <style>
    @page { size: ${labelWidth}mm ${labelHeight}mm; margin: 0; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    html, body { width: ${labelWidth}mm; height: ${labelHeight}mm; margin: 0; overflow: hidden; background: #fff; }
    body { font-family: Arial, sans-serif; color: #000; }
    .label {
      width: ${labelWidth}mm;
      height: ${labelHeight}mm;
      max-height: ${labelHeight}mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5mm;
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-after: always;
      overflow: hidden;
      padding: 3mm 2mm 1.2mm;
    }
    .label:last-child { page-break-after: auto; }
    .product-label {
      display: grid;
      grid-template-rows: 13mm 1mm 5.5mm 4.5mm 12mm;
      align-items: stretch;
      gap: 0;
      padding: 3mm 1.5mm;
      text-align: left;
    }
    .label-header { display: flex; align-items: stretch; justify-content: space-between; gap: 2mm; }
    .identity { min-width: 0; flex: 1; display: grid; grid-template-rows: 9mm 4mm; }
    .brand { min-width: 0; display: flex; align-items: center; gap: 0.8mm; overflow: hidden; }
    .brand-mark { width: 10mm; height: 9mm; flex: 0 0 auto; overflow: hidden; }
    .brand-mark img { width: 10.5mm; height: 10.5mm; object-fit: contain; transform: translate(-0.25mm, -0.35mm) scale(1.08); transform-origin: top center; }
    .brand > strong { font-size: 10px; font-weight: 900; letter-spacing: -0.45px; white-space: nowrap; }
    .price { width: 23.5mm; flex: 0 0 auto; border: 0.4mm solid #000; border-radius: 1mm; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden; }
    .price small { width: 100%; height: 3mm; display: flex; align-items: center; justify-content: center; background: #000; color: #fff; text-align: center; font-size: 6px; font-weight: 800; line-height: 1; }
    .price strong { width: 100%; height: 7mm; display: flex; align-items: center; justify-content: center; font-size: 17px; line-height: 1; letter-spacing: -0.55px; white-space: nowrap; }
    .price-empty strong { font-size: 12px; }
    .reference { display: flex; align-items: center; gap: 1.2mm; overflow: hidden; }
    .reference span { width: 8mm; padding: 0.65mm 1mm; background: #000; color: #fff; font-size: 6.5px; font-weight: 800; letter-spacing: 0.4px; }
    .reference strong { overflow: hidden; font-family: "Arial Narrow", Arial, sans-serif; font-size: 11px; font-weight: 800; letter-spacing: 0.8px; white-space: nowrap; text-overflow: ellipsis; }
    .divider { align-self: center; justify-self: center; width: 50mm; border-top: 0.35mm solid #000; }
    .product-name { align-self: end; overflow: hidden; font-size: 10px; line-height: 1.08; font-weight: 800; text-align: center; text-transform: uppercase; white-space: nowrap; text-overflow: ellipsis; }
    .description { align-self: center; overflow: hidden; color: #111; font-size: 7px; line-height: 1.1; text-align: center; white-space: nowrap; text-overflow: ellipsis; }
    .barcode { display: flex; align-items: flex-end; justify-content: center; overflow: hidden; }
    .product-label .barcode svg { width: 55mm; height: 12mm; }
    .article {
      width: ${labelWidth - 4}mm;
      height: ${showArticle ? 7 : 0}mm;
      overflow: hidden;
      white-space: normal;
      text-align: center;
      font-size: ${labelSettings.articleFontSize}px;
      line-height: 1.05;
      font-weight: 700;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    svg {
      width: ${labelWidth - 6}mm;
      height: ${barcodeHeight}mm;
      display: block;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @media print {
      html, body, .label { width: ${labelWidth}mm; height: ${labelHeight}mm; }
    }
  </style>
</head>
<body>
  ${labels}
  <script>
    window.addEventListener("load", () => {
      window.print();
      window.setTimeout(() => window.close(), 500);
    });
  </script>
</body>
</html>`;
  };

  const printBarcodeLabels = async (items: Adjustment[]) => {
    const printableItems = items.filter((item) => item.barcode);

    if (printableItems.length === 0) {
      return;
    }

    const labelWindow = window.open("", "_blank", "width=420,height=360");

    if (!labelWindow) {
      return;
    }

    labelWindow.document.write(buildLabelHtml(printableItems));
    labelWindow.document.close();
    await markLabelsAsCompleted(printableItems);
  };

  const printBarcodeLabel = async (item: Adjustment) => {
    await printBarcodeLabels([item]);
  };

  const printMaterialLabel = (material: Material) => {
    const barcode =
      String(material.barcode || material.ean || material.serial_number || "").trim();

    if (!barcode) {
      return;
    }

    const labelWindow = window.open("", "_blank", "width=420,height=360");

    if (!labelWindow) {
      return;
    }

    labelWindow.document.write(
      buildLabelHtml([
        {
          id: material.material_id,
          material_id: material.material_id,
          reference: material.reference,
          name: material.name || material.description || material.reference,
          material_name: material.name || material.description || material.reference,
          quantity_before: Number(material.quantity ?? 0),
          quantity_after: Number(material.quantity ?? 0),
          difference: 0,
          status: "completed",
          created_at: new Date().toISOString(),
          barcode,
          product_snapshot: {
            reference: material.reference,
            name: material.name || material.reference,
            description: material.description,
            barcode,
            pvp: Number(material.pvp),
            tax_rate: Number(material.tax_rate ?? material.iva ?? 0),
          },
        },
      ])
    );
    labelWindow.document.close();
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((current) => (current === "asc" ? "desc" : "asc"));
      return;
    }

    setSortKey(key);
    setSortDirection(key === "created_at" ? "desc" : "asc");
  };

  const downloadExcel = (rows: Adjustment[], label: string) => {
    const data = rows.map((item) => {
      const isCreated = isProductCreated(item);

      return {
        Fecha: new Date(item.created_at).toLocaleString(),
        Referencia: item.reference,
        Codigo: item.barcode || "",
        Artículo: getDisplayName(item),
        Empleado: isCreated ? "" : getEmployeeName(item),
        "Stock anterior": isCreated ? "" : item.quantity_before,
        "Stock después": item.quantity_after,
        Movimiento: isCreated
          ? "Producto nuevo"
          : item.difference > 0
            ? `+${item.difference}`
            : item.difference,
        Estado:
          item.status === "pending"
            ? "Pendiente"
            : isCreated
              ? "Registrado"
              : "Guardado",
      };
    });
    const headers = [
      "Fecha",
      "Referencia",
      "Codigo",
      "Artículo",
      "Empleado",
      "Stock anterior",
      "Stock después",
      "Movimiento",
      "Estado",
    ];
    const tableRows = data
      .map(
        (row) =>
          `<tr>${headers
            .map((header) => `<td>${escapeHtml(row[header as keyof typeof row])}</td>`)
            .join("")}</tr>`
      )
      .join("");
    const workbook = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; }
    th { background: #111827; color: #ffffff; font-weight: bold; }
    th, td { border: 1px solid #9ca3af; padding: 8px; }
    td { mso-number-format: "\\@"; }
  </style>
</head>
<body>
  <table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${tableRows}</tbody>
  </table>
</body>
</html>`;
    const blob = new Blob([workbook], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = URL.createObjectURL(blob);
    link.download = `cazapiezas-stock-${label}-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  type ExportRow = Record<string, string | number>;

  const getProductState = (item: Adjustment) => {
    if (item.deleted_from_tallergp) return "Borrado de TallerGP";
    if (!item.barcode) return "Sin codigo";
    if (item.status === "pending") return "Etiqueta pendiente";
    if (item.status === "completed") return "Etiqueta impresa";
    return item.status || "Registrado";
  };

  const buildBackupRows = (rows: Adjustment[]): ExportRow[] =>
    rows.map((item) => {
      const isCreated = isProductCreated(item);

      return {
        Fecha: new Date(item.created_at).toLocaleString(),
        Referencia: item.reference,
        Codigo: item.barcode || "",
        Articulo: getDisplayName(item),
        Empleado: isCreated ? "" : getEmployeeName(item),
        "Stock anterior": isCreated ? "" : item.quantity_before,
        "Stock despues": item.quantity_after,
        Movimiento: isCreated
          ? "Producto nuevo"
          : item.difference > 0
            ? `+${item.difference}`
            : item.difference,
        Estado: isCreated
          ? getProductState(item)
          : item.status === "pending"
            ? "Pendiente"
            : "Guardado",
        Coste: item.product_snapshot?.cost ?? "",
        PVP: item.product_snapshot?.pvp ?? "",
        IVA: item.product_snapshot?.tax_rate ?? "",
        "Alerta stock": item.product_snapshot?.alert_threshold ?? "",
      };
    });

  const buildCatalogRows = (): ExportRow[] =>
    getAllMaterialsFromCache().map((material) => ({
      Referencia: material.reference || "",
      Articulo: material.name || material.description || "",
      Codigo: material.barcode || material.ean || material.serial_number || "",
      Stock: Number(material.quantity ?? 0),
      Coste: Number(material.cost ?? 0),
      PVP: Number(material.pvp ?? 0),
      IVA: Number(material.tax_rate ?? material.iva ?? 0),
      "Alerta stock": Number(material.alert_threshold ?? 0),
      Estado: "Activo en catalogo local",
    }));

  const buildLabelRows = (rows: Adjustment[]): ExportRow[] =>
    rows.map((item) => ({
      Fecha: new Date(item.created_at).toLocaleString(),
      Referencia: item.reference,
      Articulo: getDisplayName(item),
      Codigo: item.barcode || "",
      Estado: getProductState(item),
    }));

  const buildBackupTable = (title: string, rows: ExportRow[]) => {
    const headers = [...new Set(rows.flatMap((row) => Object.keys(row)))];
    const body = rows
      .map(
        (row) =>
          `<tr>${headers
            .map((header) => `<td>${escapeHtml(row[header] ?? "")}</td>`)
            .join("")}</tr>`
      )
      .join("");

    return `<h2>${escapeHtml(title)}</h2>
  <table>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>${body}</tbody>
  </table>`;
  };

  const downloadBackupWorkbook = (
    sheets: Array<{ title: string; rows: ExportRow[] }>,
    label: string
  ) => {
    const tables = sheets
      .filter((sheet) => sheet.rows.length > 0)
      .map((sheet) => buildBackupTable(sheet.title, sheet.rows))
      .join("<br />");
    const workbook = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    h2 { font-family: Arial, sans-serif; margin: 18px 0 8px; }
    table { border-collapse: collapse; font-family: Arial, sans-serif; margin-bottom: 18px; }
    th { background: #111827; color: #ffffff; font-weight: bold; }
    th, td { border: 1px solid #9ca3af; padding: 8px; }
    td { mso-number-format: "\\@"; }
  </style>
</head>
<body>
  ${tables || "<p>Sin datos.</p>"}
</body>
</html>`;
    const blob = new Blob([workbook], {
      type: "application/vnd.ms-excel;charset=utf-8",
    });
    const link = document.createElement("a");
    const date = new Date().toISOString().slice(0, 10);

    link.href = URL.createObjectURL(blob);
    link.download = `cazapiezas-stock-${label}-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  const downloadCatalog = () => {
    downloadBackupWorkbook(
      [{ title: "Catalogo", rows: buildCatalogRows() }],
      "catalogo"
    );
  };

  const downloadCompleteBackup = () => {
    downloadBackupWorkbook(
      [
        { title: "Catalogo", rows: buildCatalogRows() },
        { title: "Movimientos", rows: buildBackupRows(sortedStockMovements) },
        { title: "Altas", rows: buildBackupRows(sortedProductCreations) },
        { title: "Etiquetas", rows: buildLabelRows(sortedProductCreations) },
      ],
      "backup-completo"
    );
  };

  useEffect(() => {
    void Promise.resolve().then(fetchAdjustments);
    void Promise.resolve().then(fetchEmployees);
  }, [fetchAdjustments, fetchEmployees]);

  useEffect(() => {
    localStorage.setItem(LABEL_SETTINGS_KEY, JSON.stringify(labelSettings));
  }, [labelSettings]);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "materials", label: "Materiales", icon: PackageSearch },
    { id: "stock", label: "Stock", icon: PackageMinus },
    { id: "products", label: "Altas", icon: PackagePlus },
    { id: "labels", label: "Etiquetas", icon: Barcode },
    { id: "employees", label: "Empleados", icon: Users },
    { id: "exports", label: "Exportaciones", icon: Download },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <style>{`
        @keyframes fadeOut {
          from {
            opacity: 1;
            transform: translateX(0);
          }
          to {
            opacity: 0;
            transform: translateX(20px);
          }
        }
      `}</style>
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
          <div className="flex items-center gap-4">
            <Logo iconOnly size={52} />
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">
                Panel admin
              </h1>
              <p className="text-sm text-zinc-400 mt-1">
                Actividad, empleados, alertas y exportaciones de Cazapiezas STOCK.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 self-start md:self-auto">
            <Link
              href="/"
              className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-semibold text-zinc-300 transition-all hover:bg-zinc-800 hover:text-white active:scale-95"
            >
              <ArrowLeft size={18} />
              Volver
            </Link>
            <button
              onClick={fetchAdjustments}
              className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 transition-all hover:bg-zinc-700"
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>

        <div className="mb-6 flex flex-wrap gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <button
                key={item.id}
                onClick={() => setView(item.id)}
                className={`px-4 py-3 rounded-xl border text-sm font-semibold transition-all flex items-center gap-2 ${
                  view === item.id
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </div>

        {view === "dashboard" && (
          <div className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-400">Movimientos hoy</p>
                <p className="mt-2 text-3xl font-black text-white">
                  {dashboardTotals.todayMovements}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-400">Productos nuevos hoy</p>
                <p className="mt-2 text-3xl font-black text-cyan-400">
                  {dashboardTotals.todayProducts}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-400">Stock subido hoy</p>
                <p className="mt-2 text-3xl font-black text-emerald-400">
                  +{dashboardTotals.stockUp}
                </p>
              </div>
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <p className="text-sm text-zinc-400">Stock bajado hoy</p>
                <p className="mt-2 text-3xl font-black text-red-400">
                  -{dashboardTotals.stockDown}
                </p>
              </div>
            </div>

            <div className="grid items-start gap-6 lg:grid-cols-[1fr_1.4fr]">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-white">Stock bajo</h2>
                    <p className="text-sm text-zinc-400">
                      Según el catálogo local y su umbral.
                    </p>
                  </div>
                  <TrendingDown className="text-red-400" />
                </div>
                {lowStockMaterials.length === 0 ? (
                  <p className="text-sm text-zinc-500">
                    No hay alertas o el catálogo local no está cargado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {stockAlertError && (
                      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                        {stockAlertError}
                      </div>
                    )}
                    {lowStockMaterials.map((material) => (
                      <div
                        key={material.material_id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2.5"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-mono text-xs font-bold text-cyan-400">
                            {material.reference}
                          </p>
                          <p className="truncate text-sm font-medium text-white">{material.name}</p>
                          <p className="text-xs text-zinc-500">
                            Mínimo {getStockMinimum(material)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-bold ${
                              Number(material.quantity ?? 0) <= 0
                                ? "border-red-500/20 bg-red-500/10 text-red-400"
                                : "border-amber-500/20 bg-amber-500/10 text-amber-300"
                            }`}
                          >
                            {material.quantity} u
                          </span>
                          <p className="sr-only">
                            {Number(material.quantity ?? 0) <= 0 ? "Agotado" : "Stock bajo"}
                          </p>
                          <button
                            type="button"
                            onClick={() => void ignoreStockAlert(material)}
                            disabled={ignoringStockId === material.material_id}
                            className="whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {ignoringStockId === material.material_id
                              ? "Guardando..."
                              : "No reponer"}
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="mb-3 flex items-center gap-2">
                  <TrendingUp className="text-emerald-400" />
                  <h2 className="text-lg font-bold text-white">Últimos movimientos</h2>
                </div>
                {loading ? (
                  <div className="flex justify-center py-20">
                    <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
                  </div>
                ) : sortedStockMovements.length === 0 ? (
                  <EmptyState text="No hay movimientos de stock." />
                ) : (
                  <ActivityTable
                    rows={sortedStockMovements.slice(0, 8)}
                    sortKey={sortKey}
                    sortDirection={sortDirection}
                    onSort={handleSort}
                    isProductCreated={isProductCreated}
                    getEmployeeName={getEmployeeName}
                    getDisplayName={getDisplayName}
                    markAsCompleted={markAsCompleted}
                    printBarcodeLabel={printBarcodeLabel}
                    onOpenProduct={setSelectedProduct}
                  />
                )}
              </div>
            </div>
          </div>
        )}

        {view === "materials" && (
          <ViewSection
            title="Materiales"
            description="Busca, filtra y modifica el catalogo guardado en TallerGP."
          >
            <MaterialsAdminPanel
              onCatalogChanged={refreshLowStock}
              onPrintMaterial={printMaterialLabel}
            />
          </ViewSection>
        )}

        {view === "stock" && (
          <ViewSection
            title="Movimientos de stock"
            description="Ordena por fecha, empleado, referencia o movimiento."
            action={
              <button
                onClick={() => downloadExcel(sortedStockMovements, "stock")}
                disabled={sortedStockMovements.length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center gap-2"
              >
                <Download size={16} />
                Descargar Excel
              </button>
            }
          >
            {loading ? (
              <Loader />
            ) : sortedStockMovements.length === 0 ? (
              <EmptyState text="No hay movimientos de stock." />
            ) : (
              <ActivityTable
                rows={sortedStockMovements}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                isProductCreated={isProductCreated}
                getEmployeeName={getEmployeeName}
                getDisplayName={getDisplayName}
                markAsCompleted={markAsCompleted}
                printBarcodeLabel={printBarcodeLabel}
                onOpenProduct={setSelectedProduct}
              />
            )}
          </ViewSection>
        )}

        {view === "products" && (
          <ViewSection
            title="Altas de producto"
            description="Productos registrados desde la app."
            action={
              <button
                onClick={() => downloadExcel(sortedProductCreations, "altas")}
                disabled={sortedProductCreations.length === 0}
                className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center gap-2"
              >
                <Download size={16} />
                Descargar Excel
              </button>
            }
          >
            {loading ? (
              <Loader />
            ) : sortedProductCreations.length === 0 ? (
              <EmptyState text="No hay altas de producto." />
            ) : (
              <ActivityTable
                rows={sortedProductCreations}
                sortKey={sortKey}
                sortDirection={sortDirection}
                onSort={handleSort}
                isProductCreated={isProductCreated}
                getEmployeeName={getEmployeeName}
                getDisplayName={getDisplayName}
                markAsCompleted={markAsCompleted}
                printBarcodeLabel={printBarcodeLabel}
                onOpenProduct={setSelectedProduct}
                removeProductLocally={removeProductLocally}
                removingProducts={removingProducts}
              />
            )}
          </ViewSection>
        )}

        {view === "labels" && (
          <ViewSection
            title="Etiquetas pendientes"
            description="Cola de productos nuevos que todavia no se han marcado como impresos."
            action={
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => printBarcodeLabels(pendingLabelCreations)}
                  disabled={
                    pendingLabelCreations.filter((item) => item.barcode).length === 0
                  }
                  className="px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center gap-2"
                >
                  <Printer size={16} />
                  Imprimir todas
                </button>
                <button
                  onClick={() => markLabelsAsCompleted(pendingLabelCreations)}
                  disabled={pendingLabelCreations.length === 0}
                  className="px-4 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-white text-sm font-semibold transition-all flex items-center gap-2 border border-zinc-700"
                >
                  <Check size={16} />
                  Marcar como impresas
                </button>
              </div>
            }
          >
            <div className="space-y-4">
              <LabelSettingsPanel
                settings={labelSettings}
                onChange={setLabelSettings}
              />

              {loading ? (
                <Loader />
              ) : pendingLabelCreations.length === 0 ? (
                <EmptyState text="No hay etiquetas pendientes." />
              ) : (
                <LabelQueue
                  rows={pendingLabelCreations}
                  getDisplayName={getDisplayName}
                  printBarcodeLabel={printBarcodeLabel}
                  markAsCompleted={markAsCompleted}
                  removeProductLocally={removeProductLocally}
                  removingProducts={removingProducts}
                />
              )}
            </div>
          </ViewSection>
        )}

        {view === "employees" && (
          <ViewSection
            title="Empleados"
            description="Estos nombres aparecen en el selector de la ficha de producto."
          >
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div className="flex gap-2">
                  <input
                    value={newEmployee}
                    onChange={(event) => setNewEmployee(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        addEmployee();
                      }
                    }}
                    placeholder="Nombre"
                    className="min-w-0 px-4 py-3 bg-zinc-950 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  />
                  <button
                    type="button"
                    onClick={addEmployee}
                    className="px-4 py-3 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-xl text-white flex items-center gap-2"
                  >
                    <UserPlus size={18} />
                    Añadir
                  </button>
                  <button
                    type="button"
                    onClick={saveEmployees}
                    disabled={savingEmployees}
                    className="px-4 py-3 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 rounded-xl text-white font-semibold flex items-center gap-2"
                  >
                    {savingEmployees ? (
                      <Loader2 size={18} className="animate-spin" />
                    ) : (
                      <Save size={18} />
                    )}
                    Guardar
                  </button>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {employees.map((employee) => (
                  <span
                    key={employee}
                    className="inline-flex items-center gap-2 rounded-full border border-zinc-700 bg-zinc-950 px-3 py-1 text-sm text-zinc-200"
                  >
                    {employee}
                    <button
                      type="button"
                      onClick={() => removeEmployee(employee)}
                      className="text-zinc-500 hover:text-red-400"
                      title="Eliminar empleado"
                    >
                      <Trash2 size={14} />
                    </button>
                  </span>
                ))}
              </div>

              {employeeError && (
                <p className="mt-3 text-sm text-red-300">{employeeError}</p>
              )}
            </div>
          </ViewSection>
        )}

        {view === "exports" && (
          <ViewSection
            title="Exportaciones"
            description="Descarga tablas listas para abrir en Excel."
          >
            <div className="grid gap-4 md:grid-cols-3">
              <ExportCard
                title="Todos los movimientos"
                count={adjustments.length}
                onClick={() => downloadExcel(sortActivities(adjustments), "todo")}
              />
              <ExportCard
                title="Solo stock"
                count={sortedStockMovements.length}
                onClick={() => downloadExcel(sortedStockMovements, "stock")}
              />
              <ExportCard
                title="Solo altas"
                count={sortedProductCreations.length}
                onClick={() => downloadExcel(sortedProductCreations, "altas")}
              />
              <ExportCard
                title="Catalogo completo"
                count={getAllMaterialsFromCache().length}
                onClick={downloadCatalog}
              />
              <ExportCard
                title="Backup completo"
                count={adjustments.length + getAllMaterialsFromCache().length}
                onClick={downloadCompleteBackup}
              />
            </div>
          </ViewSection>
        )}

        {selectedProduct && (
          <ProductQuickView
            item={selectedProduct}
            material={getAllMaterialsFromCache().find(
              (material) =>
                material.material_id === selectedProduct.material_id ||
                material.reference === selectedProduct.reference
            )}
            getDisplayName={getDisplayName}
            onClose={() => setSelectedProduct(null)}
            onPrint={printBarcodeLabel}
          />
        )}
      </div>
    </div>
  );
}

function MaterialsAdminPanel({
  onCatalogChanged,
  onPrintMaterial,
}: {
  onCatalogChanged: () => Promise<void>;
  onPrintMaterial: (material: Material) => void;
}) {
  const [query, setQuery] = useState("");
  const [stockFilter, setStockFilter] = useState<MaterialStockFilter>("all");
  const [minStock, setMinStock] = useState("");
  const [maxStock, setMaxStock] = useState("");
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [materialsPage, setMaterialsPage] = useState(1);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [materialsError, setMaterialsError] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [editingMaterial, setEditingMaterial] = useState<Material | null>(null);
  const [savingMaterial, setSavingMaterial] = useState(false);
  const [generatingBarcodeId, setGeneratingBarcodeId] = useState<string | null>(null);
  const [materialSavedMessage, setMaterialSavedMessage] = useState("");
  const perPage = 30;

  const loadMaterialsForAdmin = useCallback(
    async (forceRefresh = false) => {
      setLoadingMaterials(true);
      setMaterialsError("");

      try {
        const cachedMaterials = getAllMaterialsFromCache();
        const materials =
          forceRefresh || cachedMaterials.length === 0
            ? await loadAllMaterials(forceRefresh)
            : cachedMaterials;

        setAllMaterials(materials);
        setMaterialsPage(1);
      } catch (error) {
        const message =
          axios.isAxiosError(error) && error.response?.status === 429
            ? "TallerGP ha limitado temporalmente las peticiones. Espera un momento antes de actualizar de nuevo."
            : axios.isAxiosError(error)
              ? String(error.response?.data?.error || error.message)
              : "Error desconocido";

        const cachedMaterials = getAllMaterialsFromCache();

        if (cachedMaterials.length > 0) {
          setAllMaterials(cachedMaterials);
          setMaterialsError(
            `TallerGP ha limitado la actualizacion. Mostrando catalogo local: ${message}`
          );
        } else {
          setMaterialsError(`No se pudieron cargar los materiales: ${message}`);
        }
      } finally {
        setLoadingMaterials(false);
      }
    },
    []
  );

  useEffect(() => {
    void Promise.resolve().then(() => loadMaterialsForAdmin(false));
  }, [loadMaterialsForAdmin]);

  const filteredMaterials = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const minStockValue = toOptionalNumber(minStock);
    const maxStockValue = toOptionalNumber(maxStock);

    return allMaterials.filter((material) => {
      const quantity = Number(material.quantity ?? 0);
      const alertStatus = getStockAlertStatus(material);
      const searchText = [
        material.reference,
        material.name,
        material.description,
        material.barcode,
        material.ean,
        material.serial_number,
        material.material_id,
      ]
        .map((value) => String(value || "").toLowerCase())
        .join(" ");
      const matchesQuery = normalizedQuery
        ? searchText.includes(normalizedQuery)
        : true;
      const matchesStock =
        stockFilter === "out"
          ? alertStatus === "out"
          : stockFilter === "low"
            ? alertStatus === "low" || alertStatus === "out"
            : stockFilter === "disabled"
              ? alertStatus === "disabled"
            : stockFilter === "available"
              ? alertStatus === "ok"
              : true;
      const matchesMin = minStockValue === undefined || quantity >= minStockValue;
      const matchesMax = maxStockValue === undefined || quantity <= maxStockValue;

      return matchesQuery && matchesStock && matchesMin && matchesMax;
    });
  }, [allMaterials, maxStock, minStock, query, stockFilter]);

  const totalMaterials = filteredMaterials.length;
  const totalPages = Math.max(1, Math.ceil(totalMaterials / perPage));
  const safeMaterialsPage = Math.min(materialsPage, totalPages);
  const materials = useMemo(() => {
    const start = (safeMaterialsPage - 1) * perPage;

    return filteredMaterials.slice(start, start + perPage);
  }, [filteredMaterials, safeMaterialsPage]);

  const clearFilters = () => {
    setQuery("");
    setStockFilter("all");
    setMinStock("");
    setMaxStock("");
    setMaterialsPage(1);
  };

  const saveMaterial = async (
    form: MaterialFormState,
    successMessage = "Material guardado en TallerGP."
  ) => {
    setSavingMaterial(true);
    setMaterialsError("");
    setMaterialSavedMessage("");

    try {
      const response = await axios.put("/api/materials", {
        material_id: form.material_id,
        name: form.name,
        description: form.name,
        barcode: form.barcode,
        serial_number: form.barcode,
        quantity: Number(form.quantity || 0),
        cost: form.cost,
        pvp: form.pvp,
        tax_rate: form.tax_rate,
        alert_threshold: form.alert_threshold,
      });
      const updatedMaterial = response.data.material as Material;
      const stockFallbackUsed = Boolean(response.data.stock_fallback_used);

      updateMaterialInCache(updatedMaterial);
      setAllMaterials((current) =>
        current.map((material) =>
          material.material_id === updatedMaterial.material_id
            ? { ...material, ...updatedMaterial }
            : material
        )
      );
      setMaterialSavedMessage(
        stockFallbackUsed
          ? `${successMessage} Stock actualizado con movimiento de TallerGP.`
          : successMessage
      );

      try {
        await onCatalogChanged();
      } catch (refreshError) {
        console.error("Error refreshing catalog after material save:", refreshError);
      }
    } catch (error) {
      const message = axios.isAxiosError(error)
        ? error.response?.data?.error || error.message
        : "Error desconocido";

      setMaterialsError(`No se pudo guardar en TallerGP: ${message}`);
    } finally {
      setSavingMaterial(false);
      setEditingMaterial(null);
    }
  };

  const generateBarcodeForMaterial = async (material: Material) => {
    const barcode = createInternalEan13();

    setGeneratingBarcodeId(material.material_id);

    try {
      await saveMaterial(
        buildMaterialForm(material, { barcode }),
        `Codigo ${barcode} generado y guardado en TallerGP.`
      );
    } finally {
      setGeneratingBarcodeId(null);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="grid gap-3 lg:grid-cols-[1.3fr_0.7fr_0.5fr_0.5fr_auto]">
          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Buscar</span>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 focus-within:border-red-500">
              <Search size={18} className="text-zinc-500" />
              <input
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setMaterialsPage(1);
                }}
                placeholder="Referencia, articulo o codigo"
                className="min-w-0 flex-1 bg-transparent text-white placeholder-zinc-500 focus:outline-none"
              />
            </div>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Stock</span>
            <select
              value={stockFilter}
              onChange={(event) => {
                setStockFilter(event.target.value as MaterialStockFilter);
                setMaterialsPage(1);
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            >
              <option value="all">Todos</option>
              <option value="available">Con stock</option>
              <option value="low">Stock bajo</option>
              <option value="out">Sin stock</option>
              <option value="disabled">No reponer / Sin alerta</option>
            </select>
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Min</span>
            <input
              type="number"
              min="0"
              value={minStock}
              onChange={(event) => {
                setMinStock(event.target.value);
                setMaterialsPage(1);
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Max</span>
            <input
              type="number"
              min="0"
              value={maxStock}
              onChange={(event) => {
                setMaxStock(event.target.value);
                setMaterialsPage(1);
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </label>

          <div className="flex items-end gap-2">
            <button
              type="button"
              onClick={() => setMaterialsPage(1)}
              className="inline-flex items-center gap-2 rounded-xl bg-red-500 px-4 py-3 font-semibold text-white transition-all hover:bg-red-400"
            >
              <Filter size={18} />
              Filtrar
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-semibold text-zinc-200 transition-all hover:bg-zinc-700"
            >
              Limpiar
            </button>
            <button
              type="button"
              onClick={() => void loadMaterialsForAdmin(true)}
              disabled={loadingMaterials}
              className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-semibold text-zinc-200 transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <RefreshCw size={18} className={loadingMaterials ? "animate-spin" : ""} />
              Actualizar
            </button>
          </div>
        </div>
      </div>

      {materialsError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          {materialsError}
        </div>
      )}
      {materialSavedMessage && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-300">
          {materialSavedMessage}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 shadow-xl">
        <div className="flex flex-col gap-2 border-b border-zinc-800 p-4 md:flex-row md:items-center md:justify-between">
          <p className="text-sm font-semibold text-zinc-300">
            {totalMaterials} materiales encontrados
          </p>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setMaterialsPage((current) => Math.max(1, current - 1))
              }
              disabled={safeMaterialsPage <= 1 || loadingMaterials}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-50"
            >
              Anterior
            </button>
            <span className="text-sm text-zinc-400">
              {safeMaterialsPage} / {totalPages}
            </span>
            <button
              type="button"
              onClick={() =>
                setMaterialsPage((current) => Math.min(totalPages, current + 1))
              }
              disabled={safeMaterialsPage >= totalPages || loadingMaterials}
              className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm font-semibold text-zinc-200 disabled:opacity-50"
            >
              Siguiente
            </button>
          </div>
        </div>

        {loadingMaterials ? (
          <Loader />
        ) : materials.length === 0 ? (
          <EmptyState text="No hay materiales con esos filtros." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-sm">
              <thead className="border-b border-zinc-800 bg-zinc-800/50 text-xs uppercase tracking-wider text-zinc-400">
                <tr>
                  <th className="p-4">Referencia</th>
                  <th className="p-4">Articulo</th>
                  <th className="p-4">Codigo</th>
                  <th className="p-4 text-center">Stock</th>
                  <th className="p-4 text-right">PVP</th>
                  <th className="p-4 text-right">Accion</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800">
                {materials.map((material) => {
                  const barcode = getMaterialBarcode(material);
                  const name = getMaterialName(material);
                  const isGeneratingBarcode =
                    generatingBarcodeId === material.material_id;

                  return (
                    <tr
                      key={material.material_id}
                      onClick={() => setSelectedMaterial(material)}
                      className="cursor-pointer hover:bg-zinc-800/30"
                    >
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation();
                            setSelectedMaterial(material);
                          }}
                          className="font-mono font-bold text-cyan-400 underline-offset-4 transition-colors hover:text-cyan-300 hover:underline"
                        >
                          {material.reference}
                        </button>
                      </td>
                      <td className="max-w-md p-4">
                        <p className="line-clamp-2 font-semibold text-white">{name}</p>
                      </td>
                      <td className="p-4 font-mono text-zinc-300">
                        {barcode || "-"}
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-bold ${
                            getStockAlertStatus(material) === "disabled"
                              ? "bg-zinc-700/50 text-zinc-300"
                              : getStockAlertStatus(material) === "out"
                              ? "bg-red-500/10 text-red-300"
                              : getStockAlertStatus(material) === "low"
                                ? "bg-amber-500/10 text-amber-300"
                                : "bg-emerald-500/10 text-emerald-300"
                          }`}
                        >
                          {Number(material.quantity ?? 0)} u
                        </span>
                        <p className="mt-1 text-xs text-zinc-500">
                          {getStockAlertStatus(material) === "disabled"
                            ? "No reponer"
                            : `Mínimo ${getStockMinimum(material)}`}
                        </p>
                      </td>
                      <td className="p-4 text-right font-semibold text-zinc-200">
                        {formatMoney(material.pvp)}
                      </td>
                      <td className="p-4 text-right">
                        <div className="flex justify-end gap-2">
                          {barcode ? (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onPrintMaterial(material);
                              }}
                              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-3 py-2 font-semibold text-white transition-all hover:bg-cyan-500"
                            >
                              <Printer size={16} />
                              Imprimir
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                generateBarcodeForMaterial(material);
                              }}
                              disabled={isGeneratingBarcode || savingMaterial}
                              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 font-semibold text-cyan-200 transition-all hover:bg-cyan-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {isGeneratingBarcode ? (
                                <Loader2 size={16} className="animate-spin" />
                              ) : (
                                <Barcode size={16} />
                              )}
                              Generar codigo
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedMaterial(material);
                            }}
                            className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 font-semibold text-zinc-200 transition-all hover:bg-zinc-800"
                          >
                            <Eye size={16} />
                            Ver
                          </button>
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditingMaterial(material);
                              setMaterialSavedMessage("");
                              setMaterialsError("");
                            }}
                            className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 font-semibold text-white transition-all hover:bg-zinc-700"
                          >
                            <Edit3 size={16} />
                            Editar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedMaterial && (
        <MaterialDetailModal
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          onEdit={(materialToEdit) => {
            setSelectedMaterial(null);
            setEditingMaterial(materialToEdit);
            setMaterialSavedMessage("");
            setMaterialsError("");
          }}
          onPrint={onPrintMaterial}
        />
      )}

      {editingMaterial && (
        <MaterialEditorModal
          material={editingMaterial}
          saving={savingMaterial}
          onClose={() => setEditingMaterial(null)}
          onSave={saveMaterial}
        />
      )}
    </div>
  );
}

const MATERIAL_DETAIL_EXCLUDED_FIELDS = new Set([
  "material_id",
  "reference",
  "name",
  "description",
  "barcode",
  "ean",
  "serial_number",
  "quantity",
  "unit",
  "pvp",
  "cost",
  "iva",
  "tax_rate",
  "alert_threshold",
  "photos",
  "stock_movements",
  "created_at",
  "updated_at",
]);

function MaterialDetailModal({
  material,
  onClose,
  onEdit,
  onPrint,
}: {
  material: Material;
  onClose: () => void;
  onEdit: (material: Material) => void;
  onPrint: (material: Material) => void;
}) {
  const [details, setDetails] = useState<Material | null>(null);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [detailsError, setDetailsError] = useState("");
  const [movementRows, setMovementRows] = useState<Adjustment[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementsError, setMovementsError] = useState("");
  const [tallergpMovements, setTallergpMovements] = useState<
    TallerGpMaterialMovement[]
  >([]);
  const [loadingTallergpMovements, setLoadingTallergpMovements] = useState(false);
  const [tallergpMovementsError, setTallergpMovementsError] = useState("");
  const displayMaterial = details || material;
  const barcode = getMaterialBarcode(displayMaterial);
  const name = getMaterialName(displayMaterial);
  const taxRate = toOptionalNumber(displayMaterial.tax_rate ?? displayMaterial.iva);
  const pvp = toOptionalNumber(displayMaterial.pvp);
  const pvpWithTax =
    pvp !== undefined && taxRate !== undefined ? pvp * (1 + taxRate / 100) : undefined;
  const stockMovements = Array.isArray(displayMaterial.stock_movements)
    ? displayMaterial.stock_movements
    : [];
  const photos = Array.isArray(displayMaterial.photos) ? displayMaterial.photos : [];
  const extraFields = Object.entries(displayMaterial).filter(
    ([key, value]) =>
      !MATERIAL_DETAIL_EXCLUDED_FIELDS.has(key) &&
      value !== undefined &&
      value !== null &&
      value !== ""
  );

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(async () => {
      setLoadingDetails(true);
      setDetailsError("");

      try {
        const response = await axios.get<Material>("/api/materials", {
          params: { material_id: material.material_id },
        });

        if (isMounted) {
          setDetails(response.data);
        }
      } catch (error) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error || error.message
          : "Error desconocido";

        if (isMounted) {
          setDetailsError(`No se pudo cargar la ficha completa: ${message}`);
        }
      } finally {
        if (isMounted) {
          setLoadingDetails(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [material.material_id]);

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(async () => {
      setLoadingMovements(true);
      setMovementsError("");

      try {
        const response = await axios.get<Adjustment[]>("/api/adjustments", {
          params: {
            material_id: material.material_id,
            reference: material.reference,
          },
        });

        if (isMounted) {
          setMovementRows(response.data);
        }
      } catch (error) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error || error.message
          : "Error desconocido";

        if (isMounted) {
          setMovementsError(`No se pudieron cargar los movimientos locales: ${message}`);
        }
      } finally {
        if (isMounted) {
          setLoadingMovements(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [material.material_id, material.reference]);

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(async () => {
      setLoadingTallergpMovements(true);
      setTallergpMovementsError("");

      try {
        const response = await axios.get<TallerGpMaterialMovement[]>("/api/materials", {
          params: {
            material_id: material.material_id,
            movements: "true",
          },
        });

        if (isMounted) {
          setTallergpMovements(response.data);
        }
      } catch (error) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error || error.message
          : "Error desconocido";

        if (isMounted) {
          setTallergpMovementsError(
            `No se pudieron cargar los movimientos de TallerGP: ${message}`
          );
        }
      } finally {
        if (isMounted) {
          setLoadingTallergpMovements(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [material.material_id]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/80 p-4 backdrop-blur-sm md:items-center md:justify-center">
      <div className="max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 p-4">
          <div className="min-w-0">
            <p className="font-mono text-sm font-bold text-cyan-400">
              {displayMaterial.reference}
            </p>
            <h2 className="truncate text-xl font-bold text-white">{name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          {detailsError && (
            <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200">
              {detailsError}
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-300">
              {loadingDetails ? "Actualizando ficha..." : "Ficha de material"}
            </span>
            {barcode && (
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 font-mono text-sm font-bold text-cyan-300">
                {barcode}
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <InfoBox label="Stock" value={`${Number(displayMaterial.quantity ?? 0)} u`} />
            <InfoBox label="Alerta" value={displayMaterial.alert_threshold ?? "-"} />
            <InfoBox label="Coste" value={formatMoney(displayMaterial.cost)} />
            <InfoBox label="PVP con IVA" value={formatMoney(pvpWithTax)} />
          </div>

          <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 font-bold text-white">Detalles del producto</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <InfoLine label="ID TallerGP" value={displayMaterial.material_id} />
                <InfoLine label="Referencia" value={displayMaterial.reference || "-"} />
                <InfoLine label="Articulo" value={name || "-"} />
                <InfoLine label="Descripcion" value={displayMaterial.description || "-"} />
                <InfoLine label="Codigo" value={barcode || "-"} />
                <InfoLine label="EAN" value={displayMaterial.ean || "-"} />
                <InfoLine
                  label="Numero de serie"
                  value={displayMaterial.serial_number || "-"}
                />
                <InfoLine label="Unidad" value={displayMaterial.unit || "-"} />
                <InfoLine label="Stock" value={displayMaterial.quantity ?? "-"} />
                <InfoLine label="Coste" value={formatMoney(displayMaterial.cost)} />
                <InfoLine label="PVP sin IVA" value={formatMoney(pvp)} />
                <InfoLine label="IVA" value={formatPercent(taxRate)} />
                <InfoLine label="PVP con IVA" value={formatMoney(pvpWithTax)} />
                <InfoLine
                  label="Alerta stock"
                  value={displayMaterial.alert_threshold ?? "-"}
                />
                <InfoLine label="Creado" value={formatDate(displayMaterial.created_at)} />
                <InfoLine
                  label="Actualizado"
                  value={formatDate(displayMaterial.updated_at)}
                />
              </div>
            </div>

            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 font-bold text-white">Fotos y campos extra</h3>
              {photos.length > 0 ? (
                <div className="mb-4 grid grid-cols-2 gap-3">
                  {photos.slice(0, 4).map((photo) => (
                    <a
                      key={photo.id || photo.url}
                      href={photo.url}
                      target="_blank"
                      rel="noreferrer"
                      className="block overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={photo.thumbnail || photo.url}
                        alt={name}
                        className="aspect-square w-full object-cover"
                      />
                    </a>
                  ))}
                </div>
              ) : (
                <p className="mb-4 text-sm text-zinc-500">No hay fotos en la ficha.</p>
              )}

              {extraFields.length === 0 ? (
                <p className="text-sm text-zinc-500">No hay otros campos devueltos.</p>
              ) : (
                <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
                  {extraFields.map(([key, value]) => (
                    <InfoLine
                      key={key}
                      label={key}
                      value={formatDetailValue(value)}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">Movimientos en TallerGP</h3>
                <p className="text-sm text-zinc-500">
                  Historial completo devuelto para este material.
                </p>
              </div>
              {loadingTallergpMovements && (
                <Loader2 size={18} className="animate-spin text-cyan-400" />
              )}
            </div>
            <TallergpMovementsTable
              rows={tallergpMovements}
              loading={loadingTallergpMovements}
              error={tallergpMovementsError}
            />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">Movimientos en Cazapiezas</h3>
                <p className="text-sm text-zinc-500">
                  Ajustes, salidas y altas guardadas por la app.
                </p>
              </div>
              {loadingMovements && (
                <Loader2 size={18} className="animate-spin text-cyan-400" />
              )}
            </div>
            <LocalMovementsTable
              rows={movementRows}
              loading={loadingMovements}
              error={movementsError}
            />
          </div>

          {stockMovements.length > 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
              <h3 className="mb-3 font-bold text-white">Movimientos incluidos en ficha</h3>
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Tipo</th>
                      <th className="py-2 pr-3 text-right">Cantidad</th>
                      <th className="py-2">Notas</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {stockMovements.map((movement) => (
                      <tr key={movement.id || `${movement.date}-${movement.quantity}`}>
                        <td className="py-2 pr-3 text-zinc-400">
                          {formatDate(movement.date)}
                        </td>
                        <td className="py-2 pr-3 text-zinc-300">{movement.type}</td>
                        <td className="py-2 pr-3 text-right font-bold text-white">
                          {movement.quantity}
                        </td>
                        <td className="py-2 text-zinc-400">
                          {movement.reason || movement.notes || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onEdit(displayMaterial)}
              className="inline-flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 font-semibold text-white transition-colors hover:bg-zinc-700"
            >
              <Edit3 size={16} />
              Editar
            </button>
            <button
              type="button"
              onClick={() => onPrint(displayMaterial)}
              disabled={!barcode}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
            >
              <Printer size={16} />
              Imprimir etiqueta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function MaterialEditorModal({
  material,
  saving,
  onClose,
  onSave,
}: {
  material: Material;
  saving: boolean;
  onClose: () => void;
  onSave: (form: MaterialFormState) => Promise<void>;
}) {
  const [form, setForm] = useState<MaterialFormState>(() => buildMaterialForm(material));
  const [movementRows, setMovementRows] = useState<Adjustment[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [movementsError, setMovementsError] = useState("");

  const updateField = <Key extends keyof MaterialFormState>(
    key: Key,
    value: MaterialFormState[Key]
  ) => {
    setForm((current) => ({ ...current, [key]: value }));
  };
  const currentPvp = toOptionalNumber(form.pvp) ?? 0;
  const currentTaxRate = toOptionalNumber(form.tax_rate) ?? 0;
  const hasBarcode = form.barcode.trim().length > 0;

  const generateBarcode = () => {
    updateField("barcode", createInternalEan13());
  };

  useEffect(() => {
    let isMounted = true;

    void Promise.resolve().then(async () => {
      setLoadingMovements(true);
      setMovementsError("");

      try {
        const response = await axios.get<Adjustment[]>("/api/adjustments", {
          params: {
            material_id: material.material_id,
            reference: material.reference,
          },
        });

        if (isMounted) {
          setMovementRows(response.data);
        }
      } catch (error) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error || error.message
          : "Error desconocido";

        if (isMounted) {
          setMovementsError(`No se pudieron cargar los movimientos: ${message}`);
        }
      } finally {
        if (isMounted) {
          setLoadingMovements(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [material.material_id, material.reference]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/80 p-4 backdrop-blur-sm md:items-center md:justify-center">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 p-4">
          <div>
            <p className="font-mono text-sm font-bold text-cyan-400">
              {material.material_id}
            </p>
            <h2 className="text-xl font-bold text-white">Editar material</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white disabled:opacity-50"
          >
            <X size={20} />
          </button>
        </div>

        <div className="grid gap-4 p-5 md:grid-cols-2">
          <div className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Referencia</span>
            <input
              value={form.reference}
              readOnly
              className="w-full rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-3 text-zinc-400"
            />
          </div>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Codigo</span>
            <div className="flex gap-2">
              <input
                value={form.barcode}
                onChange={(event) => updateField("barcode", event.target.value)}
                className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 font-mono text-white focus:outline-none focus:border-red-500"
              />
              {!hasBarcode && (
                <button
                  type="button"
                  onClick={generateBarcode}
                  className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-3 text-sm font-semibold text-cyan-200 transition-all hover:bg-cyan-500/20"
                >
                  <Barcode size={18} />
                  Generar
                </button>
              )}
            </div>
          </label>

          <label className="space-y-2 md:col-span-2">
            <span className="text-sm font-medium text-zinc-300">Articulo</span>
            <input
              value={form.name}
              onChange={(event) => updateField("name", event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Stock directo</span>
            <input
              type="number"
              min="0"
              value={form.quantity}
              onChange={(event) => {
                const value = event.target.value;

                if (value === "" || /^\d+$/.test(value)) {
                  updateField("quantity", value);
                }
              }}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Unidad</span>
            <input
              value={form.unit}
              onChange={(event) => updateField("unit", event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Coste</span>
            <input
              type="number"
              step="0.01"
              value={form.cost}
              onChange={(event) => updateField("cost", event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">PVP sin IVA</span>
            <input
              type="number"
              step="0.01"
              value={form.pvp}
              onChange={(event) => updateField("pvp", event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">IVA</span>
            <input
              type="number"
              step="0.01"
              value={form.tax_rate}
              onChange={(event) => updateField("tax_rate", event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
          </label>

          <label className="space-y-2">
            <span className="text-sm font-medium text-zinc-300">Stock mínimo</span>
            <input
              type="number"
              min="0"
              value={form.alert_threshold}
              onChange={(event) => updateField("alert_threshold", event.target.value)}
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white focus:outline-none focus:border-red-500"
            />
            <span className="block text-xs text-zinc-500">
              Usa 0 para marcar «No reponer / Sin alerta».
            </span>
          </label>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:col-span-2">
            <p className="text-sm text-zinc-400">PVP con IVA</p>
            <p className="mt-1 text-2xl font-bold text-amber-300">
              {formatMoney(currentPvp * (1 + currentTaxRate / 100))}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:col-span-2">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">Movimientos de este material</h3>
                <p className="text-sm text-zinc-500">
                  Historial guardado en Cazapiezas STOCK.
                </p>
              </div>
              {loadingMovements && (
                <Loader2 size={18} className="animate-spin text-cyan-400" />
              )}
            </div>

            {movementsError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {movementsError}
              </div>
            ) : loadingMovements ? (
              <p className="text-sm text-zinc-500">Cargando movimientos...</p>
            ) : movementRows.length === 0 ? (
              <p className="text-sm text-zinc-500">No hay movimientos guardados.</p>
            ) : (
              <div className="max-h-72 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3">Empleado</th>
                      <th className="py-2 pr-3 text-center">Antes</th>
                      <th className="py-2 pr-3 text-center">Despues</th>
                      <th className="py-2 text-right">Mov.</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {movementRows.map((movement) => {
                      const employee =
                        movement.name?.startsWith("[ADMIN]")
                          ? "Admin"
                          : movement.name?.match(EMPLOYEE_PREFIX_PATTERN)?.[1] || "-";
                      const isCreation =
                        movement.status === "created" ||
                        movement.name?.startsWith(PRODUCT_CREATED_PREFIX);

                      return (
                        <tr key={movement.id || `${movement.created_at}-${movement.difference}`}>
                          <td className="py-2 pr-3 text-zinc-400">
                            {formatDate(movement.created_at)}
                          </td>
                          <td className="py-2 pr-3 text-zinc-300">
                            {isCreation ? "Alta" : employee}
                          </td>
                          <td className="py-2 pr-3 text-center text-zinc-500">
                            {isCreation ? "-" : movement.quantity_before}
                          </td>
                          <td className="py-2 pr-3 text-center font-semibold text-white">
                            {movement.quantity_after}
                          </td>
                          <td
                            className={`py-2 text-right font-bold ${
                              movement.difference >= 0
                                ? "text-emerald-300"
                                : "text-red-300"
                            }`}
                          >
                            {movement.difference > 0
                              ? `+${movement.difference}`
                              : movement.difference}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="sticky bottom-0 flex flex-col gap-2 border-t border-zinc-800 bg-zinc-900 p-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-3 font-semibold text-white transition-all hover:bg-zinc-700 disabled:opacity-50"
          >
            Cerrar
          </button>
          <button
            type="button"
            onClick={() => onSave(form)}
            disabled={
              saving ||
              !form.reference.trim() ||
              !form.name.trim() ||
              form.quantity === ""
            }
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white transition-all hover:bg-emerald-500 disabled:opacity-50"
          >
            {saving ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
            Guardar en TallerGP
          </button>
        </div>
      </div>
    </div>
  );
}

function Loader() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="text-center py-16 bg-zinc-900 rounded-2xl border border-zinc-800">
      <Package size={48} className="text-zinc-600 mx-auto mb-3" />
      <p className="text-zinc-400 font-medium">{text}</p>
    </div>
  );
}

function LabelQueue({
  rows,
  getDisplayName,
  printBarcodeLabel,
  markAsCompleted,
  removeProductLocally,
  removingProducts = new Set(),
}: {
  rows: Adjustment[];
  getDisplayName: (item: Adjustment) => string;
  printBarcodeLabel: (item: Adjustment) => Promise<void>;
  markAsCompleted: (id: string) => Promise<void>;
  removeProductLocally: (id: string) => Promise<void>;
  removingProducts?: Set<string>;
}) {
  return (
    <div className="grid gap-3">
      {rows.map((item) => {
        const isRemoving = removingProducts?.has(item.id);
        return (
        <div
          key={item.id}
          className={`flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:flex-row md:items-center md:justify-between transition-all ${
            isRemoving ? "opacity-50" : ""
          }`}
          style={{
            animation: isRemoving ? "fadeOut 0.3s ease-out forwards" : "none",
          }}
        >
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="font-mono rounded border border-zinc-800 bg-zinc-950 px-2 py-0.5 text-sm font-bold text-cyan-400">
                {item.reference}
              </span>
              {item.deleted_from_tallergp && (
                <span className="inline-flex items-center gap-1 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-300">
                  <AlertTriangle size={14} />
                  Borrado de TallerGP
                </span>
              )}
              {!item.barcode && (
                <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-300">
                  <AlertTriangle size={14} />
                  Sin codigo
                </span>
              )}
            </div>
            <p className="truncate font-semibold text-white">{getDisplayName(item)}</p>
            <p className="mt-1 font-mono text-sm text-zinc-400">
              {item.barcode || "Sin codigo guardado"}
            </p>
          </div>

          <div className="flex flex-wrap gap-2 md:justify-end">
            {item.deleted_from_tallergp && (
              <button
                type="button"
                onClick={() => removeProductLocally(item.id)}
                disabled={isRemoving}
                className="inline-flex items-center gap-2 rounded-lg bg-red-900/40 border border-red-800 px-4 py-2 text-sm font-semibold text-red-300 transition-all hover:bg-red-900/60 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Trash2 size={16} />
                Eliminar
              </button>
            )}
            {!item.deleted_from_tallergp && (
              <>
                <button
                  type="button"
                  onClick={() => printBarcodeLabel(item)}
                  disabled={!item.barcode}
                  className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-cyan-500 disabled:opacity-50"
                >
                  <Printer size={16} />
                  Imprimir
                </button>
                <button
                  type="button"
                  onClick={() => markAsCompleted(item.id)}
                  className="inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-2 text-sm font-semibold text-white transition-all hover:bg-zinc-700"
                >
                  <Check size={16} />
                  Marcar como impresa
                </button>
              </>
            )}
          </div>
        </div>
      );
    })}
    </div>
  );
}

function LabelSettingsPanel({
  settings,
  onChange,
}: {
  settings: LabelSettings;
  onChange: (settings: LabelSettings) => void;
}) {
  const update = <Key extends keyof LabelSettings>(
    key: Key,
    value: LabelSettings[Key]
  ) => {
    onChange({ ...settings, [key]: value });
  };

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
      <div className="mb-4 flex items-center gap-2">
        <SlidersHorizontal className="text-cyan-400" size={20} />
        <h3 className="font-bold text-white">Configuracion de etiqueta</h3>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-300">Tamano</span>
          <select
            value={settings.size}
            onChange={(event) => update("size", event.target.value as LabelSize)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white focus:outline-none focus:border-red-500"
          >
            <option value="62x29">62 x 29 mm</option>
            <option value="62x32">62 x 32 mm</option>
            <option value="62x42">62 x 42 mm · nueva</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-300">Contenido</span>
          <select
            value={settings.mode}
            onChange={(event) => update("mode", event.target.value as LabelMode)}
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white focus:outline-none focus:border-red-500"
          >
            <option value="article-code">Articulo + codigo</option>
            <option value="reference-code">Referencia + codigo</option>
            <option value="code">Solo codigo</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-sm font-medium text-zinc-300">Texto</span>
          <input
            type="number"
            min="8"
            max="16"
            value={settings.articleFontSize}
            onChange={(event) =>
              update("articleFontSize", Number(event.target.value || 11))
            }
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-white focus:outline-none focus:border-red-500"
          />
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-200">
          <input
            type="checkbox"
            checked={settings.showReference}
            onChange={(event) => update("showReference", event.target.checked)}
            className="h-4 w-4 accent-red-500"
            disabled={settings.mode !== "article-code"}
          />
          Mostrar referencia
        </label>
      </div>
    </div>
  );
}

function ProductQuickView({
  item,
  material,
  getDisplayName,
  onClose,
  onPrint,
}: {
  item: Adjustment;
  material?: Material;
  getDisplayName: (item: Adjustment) => string;
  onClose: () => void;
  onPrint: (item: Adjustment) => Promise<void>;
}) {
  const snapshot = item.product_snapshot;
  const [tallergpMovements, setTallergpMovements] = useState<
    TallerGpMaterialMovement[]
  >([]);
  const [loadingTallergpMovements, setLoadingTallergpMovements] = useState(false);
  const [tallergpMovementsError, setTallergpMovementsError] = useState("");
  const currentBarcode =
    item.barcode || material?.barcode || material?.ean || material?.serial_number || "";
  const currentTaxRate = toOptionalNumber(material?.tax_rate ?? material?.iva);
  const currentPvp = toOptionalNumber(material?.pvp);
  const currentPvpWithTax =
    currentPvp !== undefined && currentTaxRate !== undefined
      ? currentPvp * (1 + currentTaxRate / 100)
      : undefined;
  const materialId = material?.material_id || item.material_id;

  useEffect(() => {
    if (!materialId) {
      return;
    }

    let isMounted = true;

    void Promise.resolve().then(async () => {
      setLoadingTallergpMovements(true);
      setTallergpMovementsError("");

      try {
        const response = await axios.get<TallerGpMaterialMovement[]>("/api/materials", {
          params: {
            material_id: materialId,
            movements: "true",
          },
        });

        if (isMounted) {
          setTallergpMovements(response.data);
        }
      } catch (error) {
        const message = axios.isAxiosError(error)
          ? error.response?.data?.error || error.message
          : "Error desconocido";

        if (isMounted) {
          setTallergpMovementsError(
            `No se pudieron cargar los movimientos de TallerGP: ${message}`
          );
        }
      } finally {
        if (isMounted) {
          setLoadingTallergpMovements(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [materialId]);

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/80 p-4 backdrop-blur-sm md:items-center md:justify-center">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-900 shadow-2xl">
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-zinc-800 bg-zinc-900 p-4">
          <div>
            <p className="font-mono text-sm font-bold text-cyan-400">
              {item.reference}
            </p>
            <h2 className="text-xl font-bold text-white">{getDisplayName(item)}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        <div className="space-y-5 p-5">
          <div className="flex flex-wrap gap-2">
            {item.deleted_from_tallergp ? (
              <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-sm font-bold text-red-300">
                Borrado de TallerGP
              </span>
            ) : material ? (
              <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-300">
                Activo en catalogo local
              </span>
            ) : (
              <span className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-sm font-bold text-amber-300">
                Sin datos actuales en cache
              </span>
            )}
            {currentBarcode && (
              <span className="rounded-full border border-cyan-500/20 bg-cyan-500/10 px-3 py-1 font-mono text-sm font-bold text-cyan-300">
                {currentBarcode}
              </span>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <InfoBox label="Stock actual" value={material?.quantity ?? "-"} />
            <InfoBox label="Coste actual" value={formatMoney(material?.cost)} />
            <InfoBox label="PVP actual" value={formatMoney(material?.pvp)} />
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-bold text-white">Datos actuales del catalogo</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <InfoLine label="ID TallerGP" value={material?.material_id || item.material_id} />
              <InfoLine label="Referencia" value={material?.reference || item.reference} />
              <InfoLine
                label="Articulo"
                value={material?.name || material?.description || getDisplayName(item)}
              />
              <InfoLine label="Codigo" value={currentBarcode || "-"} />
              <InfoLine label="Stock" value={material?.quantity ?? "-"} />
              <InfoLine label="Unidad" value={material?.unit || "-"} />
              <InfoLine label="Coste" value={formatMoney(material?.cost)} />
              <InfoLine label="PVP sin IVA" value={formatMoney(currentPvp)} />
              <InfoLine label="IVA" value={formatPercent(currentTaxRate)} />
              <InfoLine label="PVP con IVA" value={formatMoney(currentPvpWithTax)} />
              <InfoLine
                label="Alerta stock"
                value={material?.alert_threshold ?? "-"}
              />
              <InfoLine label="Creado" value={formatDate(material?.created_at)} />
              <InfoLine label="Actualizado" value={formatDate(material?.updated_at)} />
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <h3 className="mb-3 font-bold text-white">Ficha historica guardada</h3>
            {snapshot ? (
              <div className="grid gap-3 md:grid-cols-2">
                <InfoLine label="Referencia" value={snapshot.reference || item.reference} />
                <InfoLine label="Articulo" value={snapshot.name || getDisplayName(item)} />
                <InfoLine label="Codigo" value={snapshot.barcode || currentBarcode || "-"} />
                <InfoLine label="Stock inicial" value={snapshot.quantity ?? item.quantity_after} />
                <InfoLine label="Coste" value={formatMoney(snapshot.cost)} />
                <InfoLine label="PVP sin IVA" value={formatMoney(snapshot.pvp)} />
                <InfoLine label="IVA" value={formatPercent(snapshot.tax_rate)} />
                <InfoLine
                  label="PVP con IVA"
                  value={
                    snapshot.pvp !== undefined && snapshot.tax_rate !== undefined
                      ? formatMoney(snapshot.pvp * (1 + snapshot.tax_rate / 100))
                      : "-"
                  }
                />
                <InfoLine
                  label="Alerta stock"
                  value={snapshot.alert_threshold ?? "-"}
                />
                <InfoLine label="Fecha alta" value={formatDate(snapshot.created_at)} />
              </div>
            ) : (
              <p className="text-sm text-zinc-400">
                Este registro es anterior a la ficha historica completa o es un
                movimiento de stock. Arriba se muestran los datos actuales del catalogo.
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-white">Movimientos en TallerGP</h3>
                <p className="text-sm text-zinc-500">
                  Historial completo devuelto por TallerGP.
                </p>
              </div>
              {loadingTallergpMovements && (
                <Loader2 size={18} className="animate-spin text-cyan-400" />
              )}
            </div>

            {tallergpMovementsError ? (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
                {tallergpMovementsError}
              </div>
            ) : loadingTallergpMovements ? (
              <p className="text-sm text-zinc-500">Cargando movimientos...</p>
            ) : tallergpMovements.length === 0 ? (
              <p className="text-sm text-zinc-500">TallerGP no devolvio movimientos.</p>
            ) : (
              <div className="max-h-80 overflow-y-auto">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
                    <tr>
                      <th className="py-2 pr-3">Fecha</th>
                      <th className="py-2 pr-3 text-right">Cantidad</th>
                      <th className="py-2 pr-3">Origen</th>
                      <th className="py-2">Descripcion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800">
                    {tallergpMovements.map((movement) => (
                      <tr key={movement.id}>
                        <td className="py-2 pr-3 text-zinc-400">
                          {formatDate(movement.movement_date)}
                        </td>
                        <td
                          className={`py-2 pr-3 text-right font-bold ${
                            Number(movement.quantity ?? 0) >= 0
                              ? "text-emerald-300"
                              : "text-red-300"
                          }`}
                        >
                          {Number(movement.quantity ?? 0) > 0
                            ? `+${movement.quantity}`
                            : movement.quantity ?? "-"}
                        </td>
                        <td className="py-2 pr-3 text-zinc-300">
                          {getMovementSource(movement)}
                        </td>
                        <td className="py-2 text-zinc-400">
                          {movement.description || "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPrint({ ...item, barcode: currentBarcode })}
              disabled={!currentBarcode}
              className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 font-semibold text-white transition-colors hover:bg-cyan-500 disabled:opacity-50"
            >
              <Printer size={16} />
              Imprimir etiqueta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function TallergpMovementsTable({
  rows,
  loading,
  error,
}: {
  rows: TallerGpMaterialMovement[];
  loading: boolean;
  error: string;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando movimientos...</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">TallerGP no devolvio movimientos.</p>;
  }

  return (
    <div className="max-h-80 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="py-2 pr-3">Fecha</th>
            <th className="py-2 pr-3 text-right">Cantidad</th>
            <th className="py-2 pr-3">Origen</th>
            <th className="py-2">Descripcion</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((movement) => (
            <tr key={movement.id}>
              <td className="py-2 pr-3 text-zinc-400">
                {formatDate(movement.movement_date)}
              </td>
              <td
                className={`py-2 pr-3 text-right font-bold ${
                  Number(movement.quantity ?? 0) >= 0
                    ? "text-emerald-300"
                    : "text-red-300"
                }`}
              >
                {Number(movement.quantity ?? 0) > 0
                  ? `+${movement.quantity}`
                  : movement.quantity ?? "-"}
              </td>
              <td className="py-2 pr-3 text-zinc-300">
                {getMovementSource(movement)}
              </td>
              <td className="py-2 text-zinc-400">{movement.description || "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function LocalMovementsTable({
  rows,
  loading,
  error,
}: {
  rows: Adjustment[];
  loading: boolean;
  error: string;
}) {
  if (error) {
    return (
      <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
        {error}
      </div>
    );
  }

  if (loading) {
    return <p className="text-sm text-zinc-500">Cargando movimientos...</p>;
  }

  if (rows.length === 0) {
    return <p className="text-sm text-zinc-500">No hay movimientos guardados.</p>;
  }

  return (
    <div className="max-h-80 overflow-y-auto">
      <table className="w-full text-left text-sm">
        <thead className="sticky top-0 bg-zinc-950 text-xs uppercase tracking-wider text-zinc-500">
          <tr>
            <th className="py-2 pr-3">Fecha</th>
            <th className="py-2 pr-3">Origen</th>
            <th className="py-2 pr-3 text-center">Antes</th>
            <th className="py-2 pr-3 text-center">Despues</th>
            <th className="py-2 text-right">Mov.</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800">
          {rows.map((movement) => {
            const employee =
              movement.name?.startsWith("[ADMIN]")
                ? "Admin"
                : movement.name?.match(EMPLOYEE_PREFIX_PATTERN)?.[1] || "-";
            const isCreation =
              movement.status === "created" ||
              movement.name?.startsWith(PRODUCT_CREATED_PREFIX);

            return (
              <tr key={movement.id || `${movement.created_at}-${movement.difference}`}>
                <td className="py-2 pr-3 text-zinc-400">
                  {formatDate(movement.created_at)}
                </td>
                <td className="py-2 pr-3 text-zinc-300">
                  {isCreation ? "Alta" : employee}
                </td>
                <td className="py-2 pr-3 text-center text-zinc-500">
                  {isCreation ? "-" : movement.quantity_before}
                </td>
                <td className="py-2 pr-3 text-center font-semibold text-white">
                  {movement.quantity_after}
                </td>
                <td
                  className={`py-2 text-right font-bold ${
                    movement.difference >= 0 ? "text-emerald-300" : "text-red-300"
                  }`}
                >
                  {movement.difference > 0 ? `+${movement.difference}` : movement.difference}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function formatDetailValue(value: unknown) {
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `${value.length} registros`;
  }

  return JSON.stringify(value);
}

function formatMoney(value?: unknown) {
  const numberValue = toOptionalNumber(value);

  return numberValue !== undefined ? `${numberValue.toFixed(2)} EUR` : "-";
}

function formatPercent(value?: unknown) {
  const numberValue = toOptionalNumber(value);

  return numberValue !== undefined ? `${numberValue}%` : "-";
}

function formatDate(value?: string) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);

  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getMovementSource(movement: TallerGpMaterialMovement) {
  if (movement.entry_id) return "Entrada";
  if (movement.sales_delivery_note_id) return "Albaran venta";
  if (movement.invoice_id) return "Factura";
  if (movement.ticket_id) return "Ticket";
  if (movement.purchase_delivery_note_id) return "Albaran compra";

  return "Ajuste";
}

function toOptionalNumber(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function InfoBox({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-white">{value}</p>
    </div>
  );
}

function InfoLine({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div>
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="text-sm font-semibold text-zinc-100">{value}</p>
    </div>
  );
}

function ViewSection({
  title,
  description,
  action,
  children,
}: {
  title: string;
  description: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section>
      <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">{title}</h2>
          <p className="text-sm text-zinc-400">{description}</p>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function ExportCard({
  title,
  count,
  onClick,
}: {
  title: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={count === 0}
      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 text-left transition-all hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed"
    >
      <Download className="mb-4 text-emerald-400" />
      <p className="text-lg font-bold text-white">{title}</p>
      <p className="mt-1 text-sm text-zinc-400">{count} registros</p>
    </button>
  );
}
