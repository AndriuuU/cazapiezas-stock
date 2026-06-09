"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Check,
  Clipboard,
  Clock,
  Download,
  Loader2,
  Package,
  PackagePlus,
  Save,
  RefreshCw,
  Trash2,
  UserPlus,
} from "lucide-react";
import Logo from "@/components/Logo";

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

type ActivityFilter = "all" | "stock" | "products" | "pending";

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

export default function AdminPanel() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<ActivityFilter>("all");
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

  const filteredAdjustments = useMemo(() => {
    if (filter === "products") {
      return adjustments.filter(isProductCreated);
    }

    if (filter === "stock") {
      return adjustments.filter((item) => !isProductCreated(item));
    }

    if (filter === "pending") {
      return adjustments.filter((item) => item.status === "pending");
    }

    return adjustments;
  }, [adjustments, filter, isProductCreated]);

  const fetchAdjustments = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/adjustments");
      setAdjustments(response.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

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

    if (!employee) {
      return;
    }

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

  const downloadExcel = () => {
    const rows = filteredAdjustments.map((item) => {
      const isCreated = isProductCreated(item);

      return {
        Fecha: new Date(item.created_at).toLocaleString(),
        Referencia: item.reference,
        Artículo: getDisplayName(item),
        Empleado: isCreated ? "" : getEmployeeName(item),
        "Stock anterior": isCreated ? "" : item.quantity_before,
        "Stock despues": item.quantity_after,
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
      "Stock despues",
      "Movimiento",
      "Estado",
    ];
    const tableRows = rows
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
    <thead>
      <tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr>
    </thead>
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
    link.download = `cazapiezas-stock-${filter}-${date}.xls`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(link.href);
  };

  useEffect(() => {
    void Promise.resolve().then(fetchAdjustments);
    void Promise.resolve().then(fetchEmployees);
  }, [fetchAdjustments, fetchEmployees]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
          <div className="flex items-center gap-4">
            <Logo iconOnly size={52} />
            <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Última actividad
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Cambios de stock y productos registrados desde la app.
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

        <div className="mb-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">Empleados</h2>
              <p className="text-sm text-zinc-400">
                Estos nombres aparecen en el selector de la ficha de producto.
              </p>
            </div>
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

        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {[
              { id: "all", label: "Todo" },
              { id: "stock", label: "Stock" },
              { id: "products", label: "Productos nuevos" },
              { id: "pending", label: "Pendientes" },
            ].map((item) => (
              <button
                key={item.id}
                onClick={() => setFilter(item.id as ActivityFilter)}
                className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-all ${
                  filter === item.id
                    ? "bg-red-500 text-white border-red-500"
                    : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={downloadExcel}
            disabled={filteredAdjustments.length === 0}
            className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-all flex items-center justify-center gap-2"
          >
            <Download size={16} />
            Descargar Excel
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
        ) : filteredAdjustments.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 rounded-2xl border border-zinc-800">
            <Package size={48} className="text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">
              No hay actividad para este filtro.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-800/50 border-b border-zinc-700 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="p-4">Referencia / Artículo</th>
                    <th className="p-4">Empleado</th>
                    <th className="p-4 text-center">Antes</th>
                    <th className="p-4 text-center">Después</th>
                    <th className="p-4 text-center">Actividad</th>
                    <th className="p-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-sm">
                  {filteredAdjustments.map((item) => (
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
                        <span className="text-[10px] text-zinc-500">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4 text-zinc-300">
                        {isProductCreated(item) ? "-" : getEmployeeName(item) || "-"}
                      </td>
                      <td className="p-4 text-center text-zinc-400 font-medium">
                        {isProductCreated(item) ? "-" : `${item.quantity_before} u`}
                      </td>
                      <td className="p-4 text-center text-white font-bold">
                        {item.quantity_after} u
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full font-bold text-xs ${
                            isProductCreated(item)
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              : item.difference > 0
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {isProductCreated(item) && <PackagePlus size={14} />}
                          {isProductCreated(item)
                            ? "Producto nuevo"
                            : item.difference > 0
                              ? `+${item.difference}`
                              : item.difference}
                        </span>
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
                        ) : isProductCreated(item) ? (
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
