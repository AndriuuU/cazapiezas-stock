"use client";

import { useEffect, useState } from "react";
import axios from "axios";
import { Check, Clipboard, Loader2, Package, RefreshCw, Bell } from "lucide-react";

interface Adjustment {
  id: string;
  material_id: string;
  reference: string;
  name: string;
  quantity_before: number;
  quantity_after: number;
  difference: number;
  created_at: string;
}

export default function AdminPanel() {
  const [adjustments, setAdjustments] = useState<Adjustment[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estado para la notificación flotante (Toast)
  const [notification, setNotification] = useState<string | null>(null);

  const triggerNotification = (message: string) => {
    setNotification(message);
    setTimeout(() => {
      setNotification(null);
    }, 3000); // Desaparece a los 3 segundos
  };

  const fetchAdjustments = async () => {
    setLoading(true);
    try {
      const response = await axios.get("/api/adjustments");
      setAdjustments(response.data);
    } catch (err) {
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const markAsCompleted = async (id: string, articleName: string) => {
    try {
      await axios.put("/api/adjustments", { id, status: "completed" });
      setAdjustments(adjustments.filter((item) => item.id !== id));
      triggerNotification(`✓ "${articleName}" marcado como procesado con éxito.`);
    } catch (err) {
      console.error("Error updating status:", err);
      triggerNotification("❌ Error al procesar el ajuste.");
    }
  };

  const handleCopyReference = (reference: string) => {
    navigator.clipboard.writeText(reference);
    triggerNotification(`📋 Referencia "${reference}" copiada al portapapeles.`);
  };

  useEffect(() => {
    fetchAdjustments();
  }, []);

  return (
    <div className="min-screen bg-zinc-950 text-zinc-100 p-6 md:p-12 relative">
      
      {/* NOTIFICACIÓN FLOTANTE (TOAST) */}
      {notification && (
        <div className="fixed top-6 right-6 z-50 bg-zinc-900 border border-zinc-700 text-white px-5 py-3 rounded-xl shadow-2xl transition-all duration-300 transform translate-y-0 flex items-center gap-3 animate-fade-in animate-pulse-slow">
          <Bell size={18} className="text-red-500" />
          <span className="text-sm font-medium">{notification}</span>
        </div>
      )}

      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white">
              Ajustes de Stock Pendientes
            </h1>
            <p className="text-sm text-zinc-400 mt-1">
              Modificaciones hechas por los empleados desde el móvil. Introdúcelas en TallerGP.
            </p>
          </div>
          <button
            onClick={fetchAdjustments}
            className="p-3 bg-zinc-800 hover:bg-zinc-700 rounded-xl transition-all border border-zinc-700 flex items-center gap-2"
          >
            <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            Actualizar
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-10 h-10 text-red-500 animate-spin" />
          </div>
        ) : adjustments.length === 0 ? (
          <div className="text-center py-16 bg-zinc-900 rounded-2xl border border-zinc-800">
            <Package size={48} className="text-zinc-600 mx-auto mb-3" />
            <p className="text-zinc-400 font-medium">Al día. No hay ajustes pendientes de guardar.</p>
          </div>
        ) : (
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-zinc-800/50 border-b border-zinc-700 text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                    <th className="p-4">Referencia / Artículo</th>
                    <th className="p-4 text-center">Stock Anterior</th>
                    <th className="p-4 text-center">Stock Escaneado</th>
                    <th className="p-4 text-center">Ajuste Manual</th>
                    <th className="p-4 text-right">Acción</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800 text-sm">
                  {adjustments.map((item) => (
                    <tr key={item.id} className="hover:bg-zinc-800/30 transition-colors">
                      <td className="p-4">
                        <div className="flex items-center gap-2">
                          <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded text-red-400 font-bold border border-zinc-800 flex items-center gap-1">
                            {item.reference}
                            <button 
                              onClick={() => handleCopyReference(item.reference)}
                              className="hover:text-white p-0.5 transition-colors" 
                              title="Copiar Referencia"
                            >
                              <Clipboard size={12} />
                            </button>
                          </span>
                        </div>
                        <p className="text-white font-medium mt-1 line-clamp-1">{item.name}</p>
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
                          {item.difference > 0 ? `Sumar +${item.difference}` : `Restar ${Math.abs(item.difference)}`}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          onClick={() => markAsCompleted(item.id, item.name)}
                          className="px-4 py-2 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-semibold rounded-lg shadow-md transition-all flex items-center gap-1 ml-auto active:scale-95"
                        >
                          <Check size={16} />
                          Procesado
                        </button>
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