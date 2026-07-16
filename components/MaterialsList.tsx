"use client";

import { Material } from "@/types/material";
import { X, Package, DollarSign, Download, Filter } from "lucide-react";
import { useState } from "react";
import {
  getStockAlertStatus,
} from "@/lib/stock-alerts";

interface MaterialsListProps {
  materials: Material[];
  onSelectMaterial: (material: Material) => void;
  onClose: () => void;
  initialStockFilter?: "all" | "alerts";
  onIgnoreStockAlert?: (material: Material) => Promise<void>;
  onExportStockAlerts?: () => void;
}

export default function MaterialsList({
  materials,
  onSelectMaterial,
  onClose,
  initialStockFilter = "all",
  onIgnoreStockAlert,
  onExportStockAlerts,
}: MaterialsListProps) {
  // Los estados siempre deben ir dentro de la función del componente
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState<
    "all" | "alerts" | "available" | "disabled"
  >(initialStockFilter);
  const [ignoringMaterialId, setIgnoringMaterialId] = useState("");
  const [actionError, setActionError] = useState("");

  // Filtrado combinado: Texto + Cantidad
  const filteredMaterials = materials.filter((material) => {
    // 1. Filtro por nombre, referencia o código (con validación de seguridad por si algún campo es nulo)
    const search = searchTerm.toLowerCase();
    const matchesText =
      (material.name && material.name.toLowerCase().includes(search)) ||
      (material.reference && material.reference.toLowerCase().includes(search)) ||
      (material.serial_number && material.serial_number.toLowerCase().includes(search));

    // 2. Filtro por nivel de stock
    let matchesStock = true;
    const alertStatus = getStockAlertStatus(material);
    if (stockFilter === "alerts") {
      matchesStock = alertStatus === "out" || alertStatus === "low";
    } else if (stockFilter === "disabled") {
      matchesStock = alertStatus === "disabled";
    } else if (stockFilter === "available") {
      matchesStock = alertStatus === "ok";
    }

    // Debe cumplir ambas condiciones para aparecer en la lista
    return matchesText && matchesStock;
  }).sort(
    (a, b) =>
      Number(a.quantity ?? 0) - Number(b.quantity ?? 0) ||
      String(a.reference || "").localeCompare(String(b.reference || ""))
  );

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center md:justify-center p-4">
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-hidden flex flex-col border border-zinc-700 shadow-2xl">
        
        {/* Header estático */}
        <div className="bg-gradient-to-r from-zinc-800 to-zinc-900 p-4 border-b border-zinc-700 flex items-center justify-between flex-shrink-0">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Package size={20} className="text-red-500" />
              Catálogo de Materiales
            </h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Mostrando {filteredMaterials.length} de {materials.length} artículos
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Zona de Filtros estática */}
        <div className="bg-zinc-900/95 backdrop-blur p-4 border-b border-zinc-700 flex-shrink-0 z-10 space-y-3">
          {/* Buscador de texto */}
          <input
            type="text"
            placeholder="Buscar por nombre, referencia o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-red-500 focus:ring-1 focus:ring-red-500 focus:outline-none transition-all text-sm"
          />

          {/* Botones de filtro de stock */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
            <Filter size={14} className="text-zinc-500 flex-shrink-0 mr-1" />
            
            <button
              onClick={() => setStockFilter("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                stockFilter === "all" ? "bg-zinc-700 text-white" : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setStockFilter("available")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                stockFilter === "available" ? "bg-green-500/20 text-green-400 border border-green-500/30" : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              Stock correcto
            </button>
            <button
              onClick={() => setStockFilter("alerts")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                stockFilter === "alerts" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              Alertas
            </button>
            <button
              onClick={() => setStockFilter("disabled")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                stockFilter === "disabled" ? "bg-zinc-600/30 text-zinc-300 border border-zinc-500/30" : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              No reponer
            </button>
          </div>

          {stockFilter === "alerts" && onExportStockAlerts && (
            <button
              type="button"
              onClick={onExportStockAlerts}
              className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-300 transition-colors hover:bg-amber-500/20"
            >
              <Download size={16} />
              Exportar pedido de reposición
            </button>
          )}
          {actionError && (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 p-2 text-xs text-red-300">
              {actionError}
            </p>
          )}
        </div>

        {/* Lista de materiales (Scrolleable) */}
        <div className="overflow-y-auto flex-1 divide-y divide-zinc-700/50 min-h-[300px]">
          {filteredMaterials.length > 0 ? (
            filteredMaterials.map((material) => (
              <div
                key={material.material_id}
                role="button"
                tabIndex={0}
                onClick={() => onSelectMaterial(material)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    onSelectMaterial(material);
                  }
                }}
                className="group w-full px-4 py-3 text-left transition-colors hover:bg-zinc-800/50 active:bg-red-500/10"
              >
                <div className="flex items-center gap-3">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="truncate text-sm font-semibold text-white transition-colors group-hover:text-red-400">
                      {material.name}
                    </h3>
                    <div className="mt-1 flex items-center gap-2 text-xs text-zinc-400">
                      <span className="font-mono bg-zinc-950 px-2 py-0.5 rounded border border-zinc-800">
                        {material.reference}
                      </span>
                      {material.serial_number && (
                        <span className="truncate opacity-75">
                          {material.serial_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price and Stock */}
                  <div className="flex flex-shrink-0 items-center justify-end gap-2 text-right">
                    <div
                      className={`text-sm font-bold px-2 py-1 rounded-md ${
                        getStockAlertStatus(material) === "disabled"
                          ? "bg-zinc-700/50 text-zinc-300"
                          : getStockAlertStatus(material) === "out"
                          ? "bg-red-500/10 text-red-400"
                          : getStockAlertStatus(material) === "low"
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-green-500/10 text-green-400"
                      }`}
                    >
                      {material.quantity} und.
                    </div>
                    <span className="hidden whitespace-nowrap text-[11px] text-zinc-500 sm:inline">
                      {getStockAlertStatus(material) === "disabled"
                        ? "No reponer"
                        : ""}
                    </span>
                    {(getStockAlertStatus(material) === "out" ||
                      getStockAlertStatus(material) === "low") &&
                      onIgnoreStockAlert && (
                        <button
                          type="button"
                          onClick={async (event) => {
                            event.stopPropagation();
                            setIgnoringMaterialId(material.material_id);
                            setActionError("");
                            try {
                              await onIgnoreStockAlert(material);
                            } catch (error) {
                              setActionError(
                                error instanceof Error
                                  ? error.message
                                  : "No se pudo ignorar la alerta."
                              );
                            } finally {
                              setIgnoringMaterialId("");
                            }
                          }}
                          disabled={ignoringMaterialId === material.material_id}
                          className="whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-300 hover:bg-zinc-700 disabled:opacity-50"
                        >
                          {ignoringMaterialId === material.material_id
                            ? "Guardando..."
                            : "No reponer"}
                        </button>
                      )}
                    {material.pvp !== undefined && (
                      <div className="hidden items-center gap-0.5 text-xs font-medium text-zinc-500 md:flex">
                        <DollarSign size={12} />
                        {material.pvp.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center h-full p-8 text-center">
              <Package size={48} className="text-zinc-800 mb-4" />
              <p className="text-zinc-300 font-medium">No hay coincidencias</p>
              <p className="text-zinc-500 text-sm mt-1">
                Prueba a cambiar los filtros o el texto de búsqueda
              </p>
            </div>
          )}
        </div>

        {/* Footer estático */}
        <div className="bg-gradient-to-t from-zinc-900 to-zinc-900 p-4 border-t border-zinc-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-zinc-800 text-white font-semibold rounded-xl hover:bg-zinc-700 transition-all active:scale-95 border border-zinc-600"
          >
            Cerrar Catálogo
          </button>
        </div>
        
      </div>
    </div>
  );
}
