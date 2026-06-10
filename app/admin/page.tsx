"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import axios from "axios";
import {
  ArrowDown,
  ArrowUp,
  Check,
  Clipboard,
  Clock,
  Download,
  LayoutDashboard,
  Loader2,
  Package,
  PackageMinus,
  PackagePlus,
  RefreshCw,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import Logo from "@/components/Logo";
import { getAllMaterialsFromCache } from "@/services/cache";
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
}

type AdminView = "dashboard" | "stock" | "products" | "employees" | "exports";
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
}

const PRODUCT_CREATED_PREFIX = "[PRODUCTO NUEVO] ";
const EMPLOYEE_PREFIX_PATTERN = /^\[EMPLEADO: ([^\]]+)\]\s*/;

function escapeHtml(value: string | number) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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
                    {item.status === "pending" ? (
                      <button
                        onClick={() => markAsCompleted(item.id)}
                        className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white font-semibold rounded-lg border border-zinc-700 transition-all flex items-center gap-1 ml-auto"
                      >
                        <Clock size={16} />
                        Pendiente
                      </button>
                    ) : isCreated ? (
                      <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-xs font-bold">
                        <PackagePlus size={14} />
                        Registrado
                      </span>
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
    const withoutProductPrefix = item.name?.startsWith(PRODUCT_CREATED_PREFIX)
      ? item.name.slice(PRODUCT_CREATED_PREFIX.length)
      : item.name;

    return withoutProductPrefix?.replace(EMPLOYEE_PREFIX_PATTERN, "") || "";
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

  const refreshLowStock = useCallback(() => {
    const materials = getAllMaterialsFromCache();
    const lowStock = materials
      .filter((material) => {
        const threshold = Number(material.alert_threshold ?? 2);
        return Number(material.quantity ?? 0) <= threshold;
      })
      .sort((a, b) => Number(a.quantity ?? 0) - Number(b.quantity ?? 0))
      .slice(0, 12);

    setLowStockMaterials(lowStock);
  }, []);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/adjustments");
      setAdjustments(response.data);
      refreshLowStock();
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

  useEffect(() => {
    void Promise.resolve().then(fetchAdjustments);
    void Promise.resolve().then(fetchEmployees);
  }, [fetchAdjustments, fetchEmployees]);

  const navItems = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "stock", label: "Stock", icon: PackageMinus },
    { id: "products", label: "Altas", icon: PackagePlus },
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
