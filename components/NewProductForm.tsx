"use client";

import { FormEvent, useMemo, useState } from "react";
import axios from "axios";
import { AlertCircle, Camera, Loader2, PackagePlus, Save, X } from "lucide-react";
import {
  getAllMaterialsFromCache,
  loadAllMaterials,
} from "@/services/cache";
import Scanner from "./Scanner";

interface NewProductFormProps {
  onClose: () => void;
  onProductCreated: (count: number) => void;
}

interface ProductFormState {
  reference: string;
  description: string;
  serial_number: string;
  quantity: string;
  cost: string;
  pvp: string;
  alert_threshold: string;
  tax_rate: string;
}

const initialFormState: ProductFormState = {
  reference: "",
  description: "",
  serial_number: "",
  quantity: "0",
  cost: "",
  pvp: "",
  alert_threshold: "2",
  tax_rate: "21",
};

export default function NewProductForm({
  onClose,
  onProductCreated,
}: NewProductFormProps) {
  const [form, setForm] = useState<ProductFormState>(initialFormState);
  const [saving, setSaving] = useState(false);
  const [showScanner, setShowScanner] = useState(false);
  const [error, setError] = useState("");
  const validation = useMemo(() => {
    const materials = getAllMaterialsFromCache();
    const reference = form.reference.trim().toUpperCase();
    const barcode = form.serial_number.trim();
    const description = form.description.trim();
    const quantity = Number(form.quantity || 0);
    const cost = form.cost === "" ? undefined : Number(form.cost);
    const pvp = form.pvp === "" ? undefined : Number(form.pvp);
    const taxRate = Number(form.tax_rate || 0);
    const blocking: string[] = [];
    const warnings: string[] = [];

    if (
      reference &&
      materials.some((material) => material.reference?.toUpperCase() === reference)
    ) {
      blocking.push("La referencia ya existe en el catalogo.");
    }

    if (
      barcode &&
      materials.some(
        (material) =>
          material.barcode === barcode ||
          material.ean === barcode ||
          material.serial_number === barcode
      )
    ) {
      blocking.push("El codigo de barras ya existe en otro producto.");
    }

    if (description && description.length < 3) {
      warnings.push("El nombre parece demasiado corto.");
    }

    if (!Number.isFinite(quantity) || quantity < 0) {
      blocking.push("El stock no puede ser negativo.");
    }

    if (cost !== undefined && (!Number.isFinite(cost) || cost < 0)) {
      blocking.push("El coste no puede ser negativo.");
    }

    if (pvp !== undefined && (!Number.isFinite(pvp) || pvp < 0)) {
      blocking.push("El PVP no puede ser negativo.");
    }

    if (
      cost !== undefined &&
      pvp !== undefined &&
      Number.isFinite(cost) &&
      Number.isFinite(pvp) &&
      pvp > 0 &&
      cost > pvp
    ) {
      warnings.push("El coste es mayor que el PVP.");
    }

    if (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 30) {
      warnings.push("El IVA parece raro. Revisa el porcentaje.");
    }

    return { blocking, warnings };
  }, [form]);

  const updateField = (field: keyof ProductFormState, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setError("");
  };

  const handleBarcodeScan = (code: string) => {
    updateField("serial_number", code);
    setShowScanner(false);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.reference.trim() || !form.description.trim()) {
      setError("Referencia y descripción son obligatorias.");
      return;
    }

    if (validation.blocking.length > 0) {
      setError(validation.blocking.join(" "));
      return;
    }

    setSaving(true);
    setError("");

    try {
      await axios.post("/api/materials", {
        reference: form.reference,
        description: form.description,
        serial_number: form.serial_number.trim() || undefined,
        quantity: Number(form.quantity || 0),
        cost: form.cost === "" ? undefined : Number(form.cost),
        pvp: form.pvp === "" ? undefined : Number(form.pvp),
        alert_threshold: Number(form.alert_threshold || 2),
        tax_rate: Number(form.tax_rate || 21),
      });

      try {
        const materials = await loadAllMaterials(true);
        onProductCreated(materials.length);
      } catch {
        onProductCreated(getAllMaterialsFromCache().length);
      }
      onClose();
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : "Error desconocido";

      setError(`No se pudo registrar el producto: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center md:justify-center p-4">
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-3xl w-full md:max-w-xl max-h-[90vh] overflow-y-auto border border-zinc-700 shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-zinc-800 to-zinc-900 p-4 border-b border-zinc-700 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <PackagePlus className="h-6 w-6 text-red-400" />
            <div>
              <h2 className="text-lg font-bold text-white">Registrar producto</h2>
              <p className="text-xs text-zinc-400">Alta directa en TallerGP</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={saving}
            className="p-2 hover:bg-zinc-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">Referencia</span>
              <input
                value={form.reference}
                onChange={(event) => updateField("reference", event.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                placeholder="109562"
                required
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">
                Código de barras
              </span>
              <div className="flex gap-2">
                <input
                  value={form.serial_number}
                  onChange={(event) =>
                    updateField("serial_number", event.target.value)
                  }
                  className="min-w-0 flex-1 px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
                  placeholder="3374650294490"
                />
                <button
                  type="button"
                  onClick={() => setShowScanner((current) => !current)}
                  className={`px-4 py-3 rounded-xl border transition-all flex items-center justify-center ${
                    showScanner
                      ? "bg-red-500 text-white border-red-500"
                      : "bg-zinc-900 text-zinc-300 border-zinc-700 hover:bg-zinc-800 hover:text-white"
                  }`}
                  title="Escanear código de barras"
                >
                  <Camera className="h-5 w-5" />
                </button>
              </div>
            </label>
          </div>

          {showScanner && (
            <div className="rounded-2xl border border-zinc-700 bg-zinc-950/50 p-4">
              <div className="mb-3 flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-zinc-300">
                  Escanear código de barras
                </p>
                <button
                  type="button"
                  onClick={() => setShowScanner(false)}
                  className="text-sm text-zinc-400 hover:text-white"
                >
                  Cerrar
                </button>
              </div>
              <Scanner onScan={handleBarcodeScan} />
            </div>
          )}

          <label className="space-y-2 block">
              <span className="text-sm font-medium text-zinc-300">
              Nombre o descripción
            </span>
            <input
              value={form.description}
              onChange={(event) => updateField("description", event.target.value)}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              placeholder="ACEITE C.CAMBIOS AUTO/HIBRIDA"
              required
            />
          </label>

          <div className="grid gap-4 md:grid-cols-3">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">Stock</span>
              <input
                type="number"
                min="0"
                value={form.quantity}
                onChange={(event) => updateField("quantity", event.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-red-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">
                Alerta stock
              </span>
              <input
                type="number"
                min="0"
                value={form.alert_threshold}
                onChange={(event) =>
                  updateField("alert_threshold", event.target.value)
                }
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-red-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">IVA %</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.tax_rate}
                onChange={(event) => updateField("tax_rate", event.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-red-500"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">Coste</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.cost}
                onChange={(event) => updateField("cost", event.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-red-500"
              />
            </label>

            <label className="space-y-2">
              <span className="text-sm font-medium text-zinc-300">PVP sin IVA</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={form.pvp}
                onChange={(event) => updateField("pvp", event.target.value)}
                className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-red-500"
              />
            </label>
          </div>

          {(validation.blocking.length > 0 || validation.warnings.length > 0) && (
            <div className="space-y-2">
              {validation.blocking.map((message) => (
                <div
                  key={message}
                  className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex gap-2"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              ))}
              {validation.warnings.map((message) => (
                <div
                  key={message}
                  className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200 flex gap-2"
                >
                  <AlertCircle className="h-5 w-5 flex-shrink-0" />
                  <span>{message}</span>
                </div>
              ))}
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex gap-2">
              <AlertCircle className="h-5 w-5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="sticky bottom-0 -mx-6 -mb-6 mt-6 bg-gradient-to-t from-zinc-900 to-zinc-900 p-4 border-t border-zinc-700">
            <button
              type="submit"
              disabled={saving || validation.blocking.length > 0}
              className="w-full py-3 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-semibold shadow-lg shadow-emerald-500/20 transition-all active:scale-95 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {saving ? (
                <Loader2 className="h-5 w-5 animate-spin" />
              ) : (
                <Save className="h-5 w-5" />
              )}
              {saving ? "Registrando..." : "Registrar producto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
