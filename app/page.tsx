"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { Loader, AlertCircle, Barcode, Grid3x3 } from "lucide-react";
import Scanner from "@/components/Scanner";
import ProductCard from "@/components/ProductCard";
import QuantityPanel from "@/components/QuantityPanel";
import MaterialsList from "@/components/MaterialsList";
import {
  searchMaterialByBarcode,
  getMaterialDetails,
  fetchAllMaterialsPaginated,
} from "@/services/materials";
import { Material } from "@/types/material";

export default function Home() {
  const [scannerActive, setScannerActive] = useState(false);
  const [material, setMaterial] = useState<Material | null>(null);
  const [localQuantity, setLocalQuantity] = useState(0);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manualBarcode, setManualBarcode] = useState("");
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);
  const [showMaterialsList, setShowMaterialsList] = useState(false);

  // Cargar todos los materiales al montar el componente
  useEffect(() => {
    const loadMaterials = async () => {
      try {
        setInitialLoading(true);
        const materials = await fetchAllMaterialsPaginated();
        setAllMaterials(materials);
      } catch (err) {
        setError("Error al cargar los materiales. Intenta recargar la página.");
        console.error(err);
      } finally {
        setInitialLoading(false);
      }
    };

    loadMaterials();
  }, []);

  const handleScan = useCallback(
    async (barcode: string) => {
      setLoading(true);
      setError(null);

      try {
        const foundMaterial = await searchMaterialByBarcode(
          barcode,
          allMaterials
        );

        if (foundMaterial) {
          setMaterial(foundMaterial);
          setLocalQuantity(foundMaterial.quantity);
          setScannerActive(false);
        } else {
          setError(`Material no encontrado: ${barcode}`);
          setTimeout(() => setError(null), 3000);
        }
      } catch (err) {
        setError("Error al buscar el material. Intenta nuevamente.");
        console.error(err);
        setTimeout(() => setError(null), 3000);
      } finally {
        setLoading(false);
      }
    },
    [allMaterials]
  );

  const handleManualSearch = async () => {
    if (!manualBarcode.trim()) {
      setError("Ingresa un código de barras");
      return;
    }

    await handleScan(manualBarcode);
    setManualBarcode("");
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleManualSearch();
    }
  };

  const handleCloseMaterial = () => {
    setMaterial(null);
    setLocalQuantity(0);
    setScannerActive(false);
  };

  const handleNewScan = () => {
    handleCloseMaterial();
    setScannerActive(true);
  };

  const handleSelectFromList = async (selectedMaterial: Material) => {
    setLoading(true);
    setShowMaterialsList(false);

    try {
      // Obtener detalles completos
      const details = await getMaterialDetails(selectedMaterial.material_id);
      setMaterial(details);
      setLocalQuantity(details.quantity);
    } catch (err) {
      setError("Error al cargar los detalles del material");
      console.error(err);
      setTimeout(() => setError(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  // Show loading screen while fetching materials
  if (initialLoading) {
    return (
      <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader size={40} className="text-cyan-400 animate-spin" />
          <p className="text-zinc-400">Cargando materiales...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Background gradient accent */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative px-4 py-6 border-b border-zinc-800 sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                <Barcode size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Cazapiezas</h1>
                <p className="text-xs text-zinc-500">Stock Manager</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 pb-12 relative">
        {/* No Material State */}
        {!material && (
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex justify-center pt-8 mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
                <div className="relative bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                  <Barcode size={48} className="text-cyan-400" />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle
                  size={20}
                  className="text-red-400 flex-shrink-0 mt-0.5"
                />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Manual Input */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400">
                O ingresa manualmente
              </label>
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Código de barras"
                className="
                  w-full px-4 py-4 rounded-xl
                  bg-zinc-900 border-2 border-zinc-800
                  text-white placeholder-zinc-600
                  focus:border-cyan-500 focus:outline-none
                  transition-colors text-base font-medium
                  min-h-[48px]
                "
              />
              <button
                onClick={handleManualSearch}
                disabled={loading || !manualBarcode.trim()}
                className={`
                  w-full py-4 rounded-xl font-semibold text-base
                  transition-all min-h-[48px]
                  flex items-center justify-center gap-2
                  ${
                    loading || !manualBarcode.trim()
                      ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white active:scale-95"
                  }
                `}
              >
                {loading ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <Barcode size={20} />
                    <span>Buscar Código</span>
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

            {/* Scanner Button */}
            <button
              onClick={() => setScannerActive(true)}
              disabled={loading || scannerActive}
              className={`
                w-full py-4 rounded-xl font-semibold text-base
                flex items-center justify-center gap-2
                transition-all min-h-[48px]
                ${
                  scannerActive || loading
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white active:scale-95"
                }
              `}
            >
              {scannerActive ? (
                <>
                  <Loader size={20} className="animate-spin" />
                  <span>Escaneando...</span>
                </>
              ) : (
                <>
                  <Barcode size={20} />
                  <span>Escanear Código de Barras</span>
                </>
              )}
            </button>

            {/* Show All Materials Button */}
            <button
              onClick={() => setShowMaterialsList(true)}
              disabled={loading}
              className={`
                w-full py-4 rounded-xl font-semibold text-base
                flex items-center justify-center gap-2
                transition-all min-h-[48px]
                ${
                  loading
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-purple-600 to-purple-500 hover:from-purple-700 hover:to-purple-600 text-white active:scale-95"
                }
              `}
            >
              <Grid3x3 size={20} />
              <span>Ver Todos ({allMaterials.length})</span>
            </button>

            {/* Scanner Component */}
            {scannerActive && (
              <Scanner isActive={scannerActive} onScan={handleScan} />
            )}
          </div>
        )}

        {/* Material Details State */}
        {material && !scannerActive && (
          <div className="space-y-6 py-6">
            {/* Quantity Panel */}
            <QuantityPanel
              quantity={localQuantity}
              onQuantityChange={setLocalQuantity}
            />

            {/* New Scan Button */}
            <button
              onClick={handleNewScan}
              className="
                w-full py-3 px-4 rounded-xl font-semibold
                bg-zinc-800 hover:bg-zinc-700
                text-white transition-all active:scale-95
                flex items-center justify-center gap-2
              "
            >
              <Barcode size={18} />
              <span>Escanear Otro</span>
            </button>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {material && (
        <ProductCard
          material={material}
          onClose={handleCloseMaterial}
          localQuantity={localQuantity}
        />
      )}

      {/* Materials List Modal */}
      {showMaterialsList && (
        <MaterialsList
          materials={allMaterials}
          onSelectMaterial={handleSelectFromList}
          onClose={() => setShowMaterialsList(false)}
        />
      )}
    </main>
  );
}

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      {/* Background gradient accent */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <div className="relative px-4 py-6 border-b border-zinc-800 sticky top-0 z-10 bg-zinc-950/95 backdrop-blur">
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-cyan-500 to-cyan-600 flex items-center justify-center">
                <Barcode size={20} className="text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white">Cazapiezas</h1>
                <p className="text-xs text-zinc-500">Stock Manager</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto p-4 pb-12 relative">
        {/* No Material State */}
        {!material && (
          <div className="space-y-6">
            {/* Logo */}
            <div className="flex justify-center pt-8 mb-8">
              <div className="relative">
                <div className="absolute inset-0 bg-cyan-500/20 blur-2xl rounded-full" />
                <div className="relative bg-zinc-900 rounded-2xl p-6 border border-zinc-800">
                  <Barcode size={48} className="text-cyan-400" />
                </div>
              </div>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 flex items-start gap-3">
                <AlertCircle
                  size={20}
                  className="text-red-400 flex-shrink-0 mt-0.5"
                />
                <p className="text-sm text-red-300">{error}</p>
              </div>
            )}

            {/* Manual Input */}
            <div className="space-y-3">
              <label className="text-xs font-medium text-zinc-400">
                O ingresa manualmente
              </label>
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Código de barras"
                className="
                  w-full px-4 py-4 rounded-xl
                  bg-zinc-900 border-2 border-zinc-800
                  text-white placeholder-zinc-600
                  focus:border-cyan-500 focus:outline-none
                  transition-colors text-base font-medium
                  min-h-[48px]
                "
              />
              <button
                onClick={handleManualSearch}
                disabled={loading || !manualBarcode.trim()}
                className={`
                  w-full py-4 rounded-xl font-semibold text-base
                  transition-all min-h-[48px]
                  flex items-center justify-center gap-2
                  ${
                    loading || !manualBarcode.trim()
                      ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                      : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white active:scale-95"
                  }
                `}
              >
                {loading ? (
                  <>
                    <Loader size={20} className="animate-spin" />
                    <span>Buscando...</span>
                  </>
                ) : (
                  <>
                    <Barcode size={20} />
                    <span>Buscar Código</span>
                  </>
                )}
              </button>
            </div>

            {/* Divider */}
            <div className="relative h-px bg-gradient-to-r from-transparent via-zinc-700 to-transparent" />

            {/* Scanner Button */}
            <button
              onClick={() => setScannerActive(true)}
              disabled={loading || scannerActive}
              className={`
                w-full py-3 rounded-xl font-semibold
                flex items-center justify-center gap-2
                transition-all
                ${
                  scannerActive || loading
                    ? "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                    : "bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-700 hover:to-cyan-600 text-white active:scale-95"
                }
              `}
            >
              {scannerActive ? (
                <>
                  <Loader size={18} className="animate-spin" />
                  <span>Escaneando...</span>
                </>
              ) : (
                <>
                  <Barcode size={18} />
                  <span>Escanear Código de Barras</span>
                </>
              )}
            </button>

            {/* Scanner Component */}
            {scannerActive && (
              <Scanner isActive={scannerActive} onScan={handleScan} />
            )}
          </div>
        )}

        {/* Material Details State */}
        {material && !scannerActive && (
          <div className="space-y-6 py-6">
            {/* Quantity Panel */}
            <QuantityPanel
              quantity={localQuantity}
              onQuantityChange={setLocalQuantity}
            />

            {/* New Scan Button */}
            <button
              onClick={handleNewScan}
              className="
                w-full py-3 px-4 rounded-xl font-semibold
                bg-zinc-800 hover:bg-zinc-700
                text-white transition-all active:scale-95
                flex items-center justify-center gap-2
              "
            >
              <Barcode size={18} />
              <span>Escanear Otro</span>
            </button>
          </div>
        )}
      </div>

      {/* Product Modal */}
      {material && (
        <ProductCard
          material={material}
          onClose={handleCloseMaterial}
          localQuantity={localQuantity}
        />
      )}
    </main>
  );
}