"use client";

import { useCallback, useEffect, useState } from "react";
import axios from "axios";
import {
  Check,
  Clipboard,
  Clock,
  Loader2,
  Package,
  RefreshCw,
} from "lucide-react";

interface Adjustment {
  id: string;
  material_id: string;
  reference: string;
  name: string;
  quantity_before: number;
  quantity_after: number;
  difference: number;
  status?: "pending" | "completed" | string;
  created_at: string;
}

export default function AdminPanel() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);

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

  useEffect(() => {
    void Promise.resolve().then(fetchAdjustments);
  }, [fetchAdjustments]);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 md:p-12">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col gap-4 md:flex-row md:justify-between md:items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Ultimos movimientos de stock
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Cambios guardados desde la app y aplicados en TallerGP.
            </p>
          </div>
          <button
            onClick={fetchAdjustments}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all border border-zinc-700 flex items-center gap-2 self-start md:self-auto"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
          </div>
        ) : adjustments.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 rounded-2xl border border-zinc-800">
            <Package size={48} className="text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">
              Todavia no hay movimientos guardados.
            </p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-800/50 border-b border-zinc-700 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="p-4">Referencia / Articulo</th>
                    <th className="p-4 text-center">Antes</th>
                    <th className="p-4 text-center">Despues</th>
                    <th className="p-4 text-center">Movimiento</th>
                    <th className="p-4 text-right">Estado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-sm">
                  {adjustments.map((item) => (
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
                          {item.name}
                        </p>
                        <span className="text-[10px] text-zinc-500">
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                      </td>
                      <td className="p-4 text-center text-zinc-400 font-medium">
                        {item.quantity_before} u
                      </td>
                      <td className="p-4 text-center text-white font-bold">
                        {item.quantity_after} u
                      </td>
                      <td className="p-4 text-center">
                        <span
                          className={`inline-block px-3 py-1 rounded-full font-bold text-xs ${
                            item.difference > 0
                              ? "bg-green-500/10 text-green-400 border border-green-500/20"
                              : "bg-red-500/10 text-red-400 border border-red-500/20"
                          }`}
                        >
                          {item.difference > 0
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
