"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  Barcode,
  Check,
  Clipboard,
  Clock,
  Download,
  LayoutDashboard,
  Loader2,
  Package,
  PackageMinus,
  PackagePlus,
  Printer,
  RefreshCw,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Logo from "@/components/Logo";
import { getAllMaterialsFromCache, loadAllMaterials } from "@/services/cache";
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
  | "stock"
  | "products"
  | "labels"
  | "employees"
  | "exports";
type SortKey = "created_at" | "employee" | "reference" | "difference";

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
}

const PRODUCT_CREATED_PREFIX = "[PRODUCTO NUEVO] ";
const EMPLOYEE_PREFIX_PATTERN = /^\[EMPLEADO: ([^\]]+)\]\s*/;
const PRODUCT_BARCODE_SUFFIX_PATTERN = /\s*\[CODIGO: ([^\]]+)\]\s*$/;
const PRODUCT_SNAPSHOT_SUFFIX_PATTERN = /\s*\[FICHA: ([^\]]+)\]\s*$/;

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

  return `<svg xmlns="http://www.w3.org/2000/svg" width="190" height="50" viewBox="0 0 190 50" role="img" aria-label="${barcode}">
    <rect width="190" height="50" fill="#fff" />
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

              return (
                <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
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
                          {item.deleted_from_tallergp && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 text-xs font-bold">
                              <AlertTriangle size={14} />
                              Borrado de TallerGP
                            </span>
                          )}
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
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-2">
                          {item.deleted_from_tallergp && (
                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/10 text-red-300 border border-red-500/20 text-xs font-bold">
                              <AlertTriangle size={14} />
                              Borrado de TallerGP
                            </span>
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
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<AdminView>("dashboard");
  const [sortKey, setSortKey] = useState<SortKey>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  const [employees, setEmployees] = useState<string[]>([]);
  const [newEmployee, setNewEmployee] = useState("");
  const [savingEmployees, setSavingEmployees] = useState(false);
  const [employeeError, setEmployeeError] = useState("");

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
      .filter((material) => {
        const threshold = Number(material.alert_threshold ?? 2);
        return Number(material.quantity ?? 0) <= threshold;
      })
      .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
      .slice(0, 12);

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

  const buildLabelHtml = (items: Adjustment[]) => {
    const labels = items
      .filter((item) => item.barcode)
      .map((item) => {
        const barcode = item.barcode || "";

        return `<div class="label">
    <div class="article">${escapeHtml(getDisplayName(item))}</div>
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
    @page { size: 62mm 29mm; margin: 0; }
    * { box-sizing: border-box; }
    html, body { width: 62mm; height: 29mm; margin: 0; overflow: hidden; background: #fff; }
    body { font-family: Arial, sans-serif; color: #000; }
    .label {
      width: 62mm;
      height: 29mm;
      max-height: 29mm;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      gap: 0.5mm;
      break-inside: avoid;
      page-break-inside: avoid;
      page-break-after: always;
      overflow: hidden;
      padding: 2mm 2mm 1.8mm;
    }
    .label:last-child { page-break-after: auto; }
    .article {
      width: 58mm;
      height: 8mm;
      overflow: hidden;
      white-space: normal;
      text-align: center;
      font-size: 11px;
      line-height: 1.05;
      font-weight: 700;
      display: -webkit-box;
      -webkit-box-orient: vertical;
      -webkit-line-clamp: 2;
    }
    svg {
      width: 56mm;
      height: 16.5mm;
      display: block;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    @media print {
      html, body, .label { width: 62mm; height: 29mm; }
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

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "stock", label: "Stock", icon: PackageMinus },
    { id: "products", label: "Altas", icon: PackagePlus },
    { id: "labels", label: "Etiquetas", icon: Barcode },
    { id: "employees", label: "Empleados", icon: Users },
    { id: "exports", label: "Exportaciones", icon: Download },
  ] as const;

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
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
          <button
            onClick={fetchAdjustments}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all border border-zinc-700 flex items-center gap-2 self-start md:self-auto"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
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

            <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr]">
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
                  <div className="space-y-3">
                    {lowStockMaterials.map((material) => (
                      <div
                        key={material.material_id}
                        className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950 p-3"
                      >
                        <div>
                          <p className="font-mono text-sm font-bold text-cyan-400">
                            {material.reference}
                          </p>
                          <p className="text-sm text-white line-clamp-1">{material.name}</p>
                        </div>
                        <span className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-sm font-bold text-red-400">
                          {material.quantity} u
                        </span>
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
                  />
                )}
              </div>
            </div>
          </div>
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
              />
            )}
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
}: {
  rows: Adjustment[];
  getDisplayName: (item: Adjustment) => string;
  printBarcodeLabel: (item: Adjustment) => Promise<void>;
  markAsCompleted: (id: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-3">
      {rows.map((item) => (
        <div
          key={item.id}
          className="flex flex-col gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 md:flex-row md:items-center md:justify-between"
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
          </div>
        </div>
      ))}
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
