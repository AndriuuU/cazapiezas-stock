"use client";

import { Minus, Plus } from "lucide-react";

interface QuantityPanelProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  maxQuantity?: number;
}

export default function QuantityPanel({
  quantity,
  onQuantityChange,
  maxQuantity,
}: QuantityPanelProps) {
  const handleDecrease = () => {
    if (quantity > 0) {
      onQuantityChange(quantity - 1);
    }
  };

  const handleIncrease = () => {
    if (!maxQuantity || quantity < maxQuantity) {
      onQuantityChange(quantity + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value) || 0;
    if (!maxQuantity || value <= maxQuantity) {
      onQuantityChange(Math.max(0, value));
    }
  };

  const isAtMax = maxQuantity !== undefined && quantity >= maxQuantity;
  const isAtMin = quantity <= 0;

  return (
    <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-2xl p-6 border border-zinc-700">
      <div className="flex items-center justify-between mb-6">
        <label className="text-sm font-medium text-zinc-300">Cantidad</label>
        {maxQuantity && (
          <span className="text-xs text-zinc-500">
            Máx: {maxQuantity}
          </span>
        )}
      </div>

      {/* Main quantity display and controls */}
      <div className="flex items-center justify-center gap-4 mb-6">
        {/* Decrease Button */}
        <button
          onClick={handleDecrease}
          disabled={isAtMin}
          className={`
            p-3 rounded-xl border-2 transition-all duration-200
            ${
              isAtMin
                ? "border-zinc-700 bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                : "border-red-500/50 bg-red-500/10 text-red-400 hover:border-red-500 hover:bg-red-500/20 active:scale-95"
            }
          `}
          aria-label="Decrease quantity"
        >
          <Minus size={20} />
        </button>

        {/* Quantity Input */}
        <input
          type="number"
          value={quantity}
          onChange={handleInputChange}
          className={`
            w-24 text-center text-3xl font-bold bg-zinc-900 border-2 border-cyan-500/50
            rounded-xl text-white outline-none transition-all duration-200
            focus:border-cyan-400 focus:shadow-lg focus:shadow-cyan-400/20
            [&::-webkit-outer-spin-button]:appearance-none
            [&::-webkit-inner-spin-button]:appearance-none
            [-moz-appearance:textfield]
          `}
          min="0"
          max={maxQuantity}
        />

        {/* Increase Button */}
        <button
          onClick={handleIncrease}
          disabled={isAtMax}
          className={`
            p-3 rounded-xl border-2 transition-all duration-200
            ${
              isAtMax
                ? "border-zinc-700 bg-zinc-800/50 text-zinc-600 cursor-not-allowed"
                : "border-green-500/50 bg-green-500/10 text-green-400 hover:border-green-500 hover:bg-green-500/20 active:scale-95"
            }
          `}
          aria-label="Increase quantity"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Stock status indicator */}
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        <div
          className={`
            h-2 w-2 rounded-full
            ${
              quantity === 0
                ? "bg-red-500"
                : quantity <= 5
                  ? "bg-yellow-500"
                  : "bg-green-500"
            }
          `}
        />
        <span>
          {quantity === 0
            ? "Sin stock"
            : quantity <= 5
              ? "Stock bajo"
              : "Stock disponible"}
        </span>
      </div>

      {/* Info text */}
      <p className="text-xs text-zinc-500 mt-4 text-center">
        Nota: Los cambios de cantidad no se guardan en tallergp
      </p>
    </div>
  );
}
