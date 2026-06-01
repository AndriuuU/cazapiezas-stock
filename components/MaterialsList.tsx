"use client";

import { Material } from "@/types/material";
import { X, Package, DollarSign } from "lucide-react";
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
  const [searchTerm, setSearchTerm] = useState("");

  // Filtrar materiales por nombre, referencia o código
  const filteredMaterials = materials.filter((material) => {
    const search = searchTerm.toLowerCase();
    return (
      material.name.toLowerCase().includes(search) ||
      material.reference.toLowerCase().includes(search) ||
      (material.serial_number && material.serial_number.includes(search))
    );
  });

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center md:justify-center p-4">
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-700 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-zinc-800 to-zinc-900 p-4 border-b border-zinc-700 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-white">
              Todos los Materiales
            </h2>
            <p className="text-xs text-zinc-500">
              {filteredMaterials.length} de {materials.length}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Search Input */}
        <div className="sticky top-[60px] bg-zinc-900/95 backdrop-blur p-4 border-b border-zinc-700 z-40">
          <input
            type="text"
            placeholder="Buscar por nombre, referencia o código..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-4 py-2 rounded-lg bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-600 focus:border-cyan-500 focus:outline-none transition-colors text-sm"
          />
        </div>

        {/* Materials List */}
        <div className="divide-y divide-zinc-700">
          {filteredMaterials.length > 0 ? (
            filteredMaterials.map((material) => (
              <button
                key={material.material_id}
                onClick={() => onSelectMaterial(material)}
                className="w-full text-left px-4 py-4 hover:bg-zinc-800/50 transition-colors active:bg-cyan-500/20"
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className="mt-1">
                    <Package
                      size={16}
                      className="text-cyan-400"
                    />
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-white text-sm line-clamp-2">
                      {material.name}
                    </h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-zinc-400">
                      <span className="font-mono bg-zinc-900 px-2 py-0.5 rounded">
                        {material.reference}
                      </span>
                      {material.serial_number && (
                        <span className="truncate">
                          {material.serial_number}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Price and Stock */}
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 text-amber-400 font-semibold text-sm">
                      <DollarSign size={14} />
                      {material.pvp.toFixed(2)}
                    </div>
                    <div
                      className={`text-xs font-bold mt-1 ${
                        material.quantity === 0
                          ? "text-red-400"
                          : material.quantity <= 5
                            ? "text-yellow-400"
                            : "text-green-400"
                      }`}
                    >
                      {material.quantity} u
                    </div>
                  </div>
                </div>
              </button>
            ))
          ) : (
            <div className="p-8 text-center">
              <Package size={32} className="text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">
                No se encontraron materiales
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-t from-zinc-900 to-transparent p-4 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-zinc-700 to-zinc-600 text-white font-semibold rounded-xl hover:from-zinc-600 hover:to-zinc-500 transition-all active:scale-95"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}