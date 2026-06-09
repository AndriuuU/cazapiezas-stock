"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import axios from "axios";
import {
  DollarSign,
  Eye,
  EyeOff,
  ImageIcon,
  Loader2,
  Package,
  TrendingUp,
  X,
} from "lucide-react";
import {
  getMaterialDetails,
  updateMaterialQuantityInCache,
} from "@/services/cache";
import { Material } from "@/types/material";
import QuantityPanel from "./QuantityPanel";

interface ProductCardProps {
  material: Material;
  onClose: () => void;
  onSaved?: (message: string) => void;
}

export default function ProductCard({ material, onClose, onSaved }: ProductCardProps) {
  const [editedQuantity, setEditedQuantity] = useState(material.quantity);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [showImage, setShowImage] = useState(false);
  const [imageUrl, setImageUrl] = useState(material.photos?.[0]?.url || "");
  const [imageLoading, setImageLoading] = useState(false);
  const [imageError, setImageError] = useState("");
  const [employees, setEmployees] = useState<string[]>([]);
  const [selectedEmployee, setSelectedEmployee] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const quantityDifference = editedQuantity - material.quantity;
  const hasChanged = quantityDifference !== 0;

  useEffect(() => {
    let isMounted = true;

    const fetchEmployees = async () => {
      try {
        const response = await axios.get("/api/employees");
        const nextEmployees = Array.isArray(response.data.employees)
          ? response.data.employees
          : [];

        if (!isMounted) {
          return;
        }

        setEmployees(nextEmployees);
        setSelectedEmployee((current) => current || nextEmployees[0] || "");
      } catch {
        if (isMounted) {
          setEmployees(["Empleado"]);
          setSelectedEmployee((current) => current || "Empleado");
        }
      }
    };

    void fetchEmployees();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleSaveAndClose = async () => {
    if (!hasChanged) {
      onClose();
      return;
    }

    if (!selectedEmployee) {
      setSaveError("Selecciona quién ha cogido el material.");
      return;
    }

    setSaving(true);
    setSaveError("");

    try {
      await axios.post("/api/adjustments", {
        material_id: material.material_id,
        reference: material.reference,
        name: material.name,
        quantity_before: material.quantity,
        quantity_after: editedQuantity,
        employee_name: selectedEmployee,
      });

      updateMaterialQuantityInCache(material.material_id, editedQuantity);
      const message = `Stock guardado en TallerGP por ${selectedEmployee}`;
      setSaveSuccess(message);
      onSaved?.(message);
      window.setTimeout(onClose, 650);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : "Error desconocido";

      setSaveError(`No se pudo guardar en TallerGP: ${message}`);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleImage = async () => {
    if (showImage) {
      setShowImage(false);
      return;
    }

    setShowImage(true);

    if (imageUrl || imageLoading) {
      return;
    }

    setImageLoading(true);
    setImageError("");

    try {
      const materialDetails = await getMaterialDetails(material.material_id);
      const nextImageUrl = materialDetails.photos?.[0]?.url || "";

      if (!nextImageUrl) {
        setImageError("Este producto no tiene imagen guardada.");
        return;
      }

      setImageUrl(nextImageUrl);
    } catch (err) {
      const message = axios.isAxiosError(err)
        ? err.response?.data?.error || err.message
        : "Error desconocido";

      setImageError(`No se pudo cargar la imagen: ${message}`);
    } finally {
      setImageLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end md:items-center md:justify-center p-4">
      <div className="bg-gradient-to-b from-zinc-800 to-zinc-900 rounded-3xl w-full md:max-w-lg max-h-[90vh] overflow-y-auto border border-zinc-700 shadow-2xl">
        <div className="sticky top-0 bg-gradient-to-r from-zinc-800 to-zinc-900 p-4 border-b border-zinc-700 flex items-center justify-between z-10">
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
            disabled={saving}
            className="ml-4 p-2 hover:bg-zinc-700 rounded-lg transition-colors flex-shrink-0 disabled:opacity-50"
          >
            <X size={20} className="text-zinc-400" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {material.serial_number && (
            <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700">
              <p className="text-xs text-zinc-500 mb-2">Código de barras</p>
              <p className="text-lg font-mono font-bold text-red-400 break-all">
                {material.serial_number}
              </p>
            </div>
          )}

          <div className="bg-gradient-to-br from-red-500/20 to-red-500/5 rounded-xl p-4 border border-red-500/30">
            <div className="flex items-center gap-3 mb-2">
              <Package size={20} className="text-red-400" />
              <span className="text-sm font-medium text-zinc-300">
                Stock en TallerGP
              </span>
            </div>
            <div className="text-4xl font-bold text-red-400 mb-2">
              {material.quantity}
            </div>
            {hasChanged && (
              <div
                className={`text-sm font-medium flex items-center gap-2 ${
                  quantityDifference > 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                <TrendingUp size={16} />
                <span>
                  {quantityDifference > 0 ? "+" : ""}
                  {quantityDifference} (se guardará en TallerGP)
                </span>
              </div>
            )}
          </div>

          <QuantityPanel
            quantity={editedQuantity}
            onQuantityChange={setEditedQuantity}
          />

          <label className="block bg-zinc-900/50 rounded-xl p-4 border border-zinc-700">
            <span className="block text-sm font-medium text-zinc-300 mb-2">
              Quién lo ha cogido
            </span>
            <select
              value={selectedEmployee}
              onChange={(event) => {
                setSelectedEmployee(event.target.value);
                setSaveError("");
              }}
              className="w-full px-4 py-3 bg-zinc-900 border border-zinc-700 rounded-xl text-white focus:outline-none focus:border-red-500"
            >
              {employees.map((employee) => (
                <option key={employee} value={employee}>
                  {employee}
                </option>
              ))}
            </select>
          </label>

          {saveError && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
              {saveError}
            </div>
          )}
          {saveSuccess && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-medium text-emerald-300">
              {saveSuccess}
            </div>
          )}

          <div className="bg-zinc-900/50 rounded-xl p-4 border border-zinc-700">
            <button
              onClick={handleToggleImage}
              className="w-full py-3 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-white font-semibold transition-all flex items-center justify-center gap-2"
            >
              {showImage ? <EyeOff size={18} /> : <Eye size={18} />}
              {showImage ? "Ocultar imagen" : "Mostrar imagen"}
            </button>

            {showImage && (
              <div className="mt-4">
                {imageLoading ? (
                  <div className="aspect-[4/3] rounded-xl border border-zinc-700 bg-zinc-950 flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-red-400" />
                  </div>
                ) : imageUrl ? (
                  <div className="relative h-[420px] w-full overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950">
                    <Image
                      src={imageUrl}
                      alt={material.name}
                      fill
                      sizes="(max-width: 768px) 100vw, 512px"
                      className="object-contain"
                    />
                  </div>
                ) : (
                  <div className="aspect-[4/3] rounded-xl border border-zinc-700 bg-zinc-950 flex flex-col items-center justify-center gap-2 text-zinc-400">
                    <ImageIcon className="h-8 w-8" />
                    <span className="text-sm">
                      {imageError || "Sin imagen disponible"}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="bg-gradient-to-br from-amber-500/20 to-amber-500/5 rounded-xl p-4 border border-amber-500/30">
            <div className="flex items-center gap-2 mb-4">
              <DollarSign size={16} className="text-amber-400" />
              <span className="text-sm font-semibold text-amber-300">
                Precios
              </span>
            </div>

            <div className="space-y-3">
              <div>
                <p className="text-xs text-zinc-400 mb-1">Precio sin IVA</p>
                <p className="text-xl font-bold text-white">
                  {material.pvp?.toFixed(2) || "0.00"} EUR
                </p>
              </div>
              <div className="pt-3 border-t border-amber-500/20">
                <p className="text-xs text-zinc-400 mb-1">
                  Precio con IVA ({material.tax_rate || 21}%)
                </p>
                <p className="text-2xl font-bold text-amber-400">
                  {((material.pvp || 0) * (1 + (material.tax_rate || 21) / 100)).toFixed(2)} EUR
                </p>
              </div>
            </div>
          </div>
        </div>
        

        <div className="sticky bottom-0 bg-gradient-to-t from-zinc-900 to-zinc-900 p-4 border-t border-zinc-700">
          <button
            onClick={handleSaveAndClose}
            disabled={saving}
            className={`w-full min-h-14 py-4 text-base font-semibold rounded-xl transition-all active:scale-95 ${
              hasChanged
                ? "bg-gradient-to-r from-emerald-500 to-teal-600 text-white shadow-lg shadow-emerald-500/20"
                : "bg-gradient-to-r from-red-500 to-red-600 text-white"
            } disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2`}
          >
            {saving && <Loader2 className="h-5 w-5 animate-spin" />}
            {saveSuccess
              ? "Guardado en TallerGP"
              : saving
                ? "Guardando..."
                : hasChanged
                  ? "Guardar y cerrar"
                  : "Cerrar"}
          </button>
        </div>
      </div>
    </div>
  );
}
