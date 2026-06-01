"use client";

import { Material } from "@/types/material";
import { X, Package, DollarSign, Tag, TrendingUp } from "lucide-react";

interface ProductCardProps {
  material: Material;
  onClose: () => void;
  localQuantity: number;
}

export default function ProductCard({
  material,
  onClose,
  localQuantity,
}: ProductCardProps) {
  const quantityDifference = localQuantity - material.quantity;
  const hasChanged = quantityDifference !== 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center md:justify-center p-4">
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-700 shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-zinc-800 to-zinc-900 p-4 border-b border-zinc-700 flex items-center justify-between">
          <div className="flex-1">
            <div className="text-xs font-medium text-zinc-500 mb-1">
              REF: {material.reference}
            </div>
            <h2 className="text-lg font-bold text-white line-clamp-2">
              {material.name}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="ml-4 p-2 hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Código de barras */}
          {material.serial_number && (
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700">
              <p className="text-xs text-zinc-500 mb-2">Código de barras</p>
              <p className="text-lg font-mono font-bold text-cyan-400 break-all">
                {material.serial_number}
              </p>
            </div>
          )}

          {/* Stock Status - Prominent */}
          <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 rounded-xl p-4 border border-cyan-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Package
                size={20}
                className="text-cyan-400"
              />
              <span className="text-sm font-medium text-zinc-300">Stock Actual</span>
            </div>
            <div className="text-4xl font-bold text-cyan-400 mb-2">
              {material.quantity}
            </div>
            {hasChanged && (
              <div
                className={`text-sm font-medium flex items-center gap-2 ${
                  quantityDifference > 0
                    ? "text-green-400"
                    : "text-red-400"
                }`}
              >
                <TrendingUp size={16} />
                <span>
                  {quantityDifference > 0 ? "+" : ""}
                  {quantityDifference} (Cambio local)
                </span>
              </div>
            )}
          </div>

          {/* Pricing */}
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-xl p-4 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={16} className="text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">Precios</span>
            </div>
            
            <div className="space-y-3">
              {/* PVP sin IVA */}
              <div>
                <p className="text-xs text-zinc-400 mb-1">Precio sin IVA</p>
                <p className="text-xl font-bold text-white">
                  €{material.pvp.toFixed(2)}
                </p>
              </div>
              
              {/* PVP con IVA */}
              <div className="pt-3 border-t border-amber-500/20">
                <p className="text-xs text-zinc-400 mb-1">Precio con IVA ({material.tax_rate}%)</p>
                <p className="text-2xl font-bold text-amber-400">
                  €{(material.pvp * (1 + material.tax_rate / 100)).toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-700">
              <p className="text-zinc-500 text-xs mb-1">Material ID</p>
              <p className="text-zinc-300 font-mono text-xs break-all">
                {material.material_id}
              </p>
            </div>
            <div className="bg-zinc-900/50 rounded-lg p-3 border border-zinc-700">
              <p className="text-zinc-500 text-xs mb-1">Coste</p>
              <p className="text-zinc-300 font-semibold">
                €{material.cost.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Stock Movements History */}
          {material.stock_movements && material.stock_movements.length > 0 && (
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700">
              <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                <TrendingUp size={16} className="text-cyan-400" />
                Historial de Movimientos
              </h3>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {material.stock_movements.map((movement) => (
                  <div
                    key={movement.id}
                    className="flex items-center justify-between text-xs bg-zinc-800/50 p-3 rounded-lg"
                  >
                    <div>
                      <p className="text-zinc-300 font-medium">
                        {movement.movement_date}
                      </p>
                      <p className="text-zinc-500 text-xs">
                        {movement.description || "Sin descripción"}
                      </p>
                    </div>
                    <div
                      className={`font-bold ${
                        movement.quantity > 0
                          ? "text-green-400"
                          : "text-red-400"
                      }`}
                    >
                      {movement.quantity > 0 ? "+" : ""}
                      {movement.quantity}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-gradient-to-t from-zinc-900 to-transparent p-4 border-t border-zinc-700">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gradient-to-r from-cyan-500 to-cyan-600 text-white font-semibold rounded-xl hover:from-cyan-600 hover:to-cyan-700 transition-all active:scale-95"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}