"use client";

import { Material } from "@/types/material";
import { X, Package, DollarSign, Filter } from "lucide-react";
import { useState } from "react";

interface MaterialsListProps {
  materials: Material[];
  onSelectMaterial: (material: Material) => void;
  onClose: () => void;
}

export default function MaterialsList({
  materials,
  onSelectMaterial,
  onClose,
}: MaterialsListProps) {
  // Los estados siempre deben ir dentro de la función del componente
  const [searchTerm, setSearchTerm] = useState("");
  const [stockFilter, setStockFilter] = useState("all"); // "all", "zero", "low", "available"

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
    if (stockFilter === "zero") {
      matchesStock = material.quantity === 0;
    } else if (stockFilter === "low") {
      matchesStock = material.quantity > 0 && material.quantity <= 5;
    } else if (stockFilter === "available") {
      matchesStock = material.quantity > 5;
    }

    // Debe cumplir ambas condiciones para aparecer en la lista
    return matchesText && matchesStock;
  });

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
              Disponibles (+5)
            </button>
            <button
              onClick={() => setStockFilter("low")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                stockFilter === "low" ? "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30" : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              Stock Bajo (1-5)
            </button>
            <button
              onClick={() => setStockFilter("zero")}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                stockFilter === "zero" ? "bg-red-500/20 text-red-400 border border-red-500/30" : "bg-zinc-800/50 text-zinc-400 hover:bg-zinc-800"
              }`}
            >
              Sin Stock (0)
            </button>
          </div>
        </div>

        {/* Lista de materiales (Scrolleable) */}
        <div className="overflow-y-auto flex-1 divide-y divide-zinc-700/50 min-h-[300px]">
          {filteredMaterials.length > 0 ? (
            filteredMaterials.map((material) => (
              <button
                key={material.material_id}
                onClick={() => onSelectMaterial(material)}
                className="w-full text-left px-4 py-4 hover:bg-zinc-800/50 transition-colors active:bg-red-500/10 group"
              >
                <div className="flex items-start gap-3">
                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm line-clamp-2 group-hover:text-red-400 transition-colors">
                      {material.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-zinc-400">
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
                  <div className="text-right flex-shrink-0 flex flex-col items-end justify-center">
                    <div
                      className={`text-sm font-bold px-2 py-1 rounded-md ${
                        material.quantity === 0
                          ? "bg-red-500/10 text-red-400"
                          : material.quantity <= 5
                            ? "bg-yellow-500/10 text-yellow-400"
                            : "bg-green-500/10 text-green-400"
                      }`}
                    >
                      {material.quantity} und.
                    </div>
                    {material.pvp !== undefined && (
                      <div className="flex items-center gap-0.5 text-zinc-500 font-medium text-xs mt-1.5">
                        <DollarSign size={12} />
                        {material.pvp.toFixed(2)}
                      </div>
                    )}
                  </div>
                </div>
              </button>
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