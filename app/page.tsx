"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertCircle, CheckCircle, List, Loader2, PackagePlus, Search } from "lucide-react";
import CacheLoader from "@/components/CacheLoader";
import Logo from "@/components/Logo";
import MaterialsList from "@/components/MaterialsList";
import NewProductForm from "@/components/NewProductForm";
import ProductCard from "@/components/ProductCard";
import Scanner from "@/components/Scanner";
import { getAllMaterialsFromCache, getCacheInfo } from "@/services/cache";
import { searchByBarcode, searchByReference, searchMaterial } from "@/services/search";
import { Material } from "@/types/material";

export default function Home() {
  const [scannedCode, setScannedCode] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [searchType, setSearchType] = useState<"barcode" | "reference" | "auto">("auto");
  const [cacheReady, setCacheReady] = useState(false);
  const [cacheItemCount, setCacheItemCount] = useState(0);
  const [showMaterialsList, setShowMaterialsList] = useState(false);
  const [showNewProductForm, setShowNewProductForm] = useState(false);
  const [allMaterials, setAllMaterials] = useState<Material[]>([]);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const info = getCacheInfo();

      setCacheReady(info.itemCount > 0);
      setCacheItemCount(info.itemCount);
    });
  }, []);

  const handleCacheLoaded = useCallback((count: number) => {
    setCacheReady(true);
    setCacheItemCount(count);
  }, []);

  const handleOpenMaterialsList = () => {
    setAllMaterials(getAllMaterialsFromCache());
    setShowMaterialsList(true);
  };

  const handleSearch = useCallback(
    async (code: string, type: "barcode" | "reference" | "auto" = "auto") => {
      const query = code.trim();

      if (!query) {
        setError("Por favor ingresa un código.");
        return;
      }

      if (!cacheReady) {
        setError("El catálogo no está listo. Actualízalo primero.");
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");

      try {
        let material: Material | null = null;

        if (type === "barcode") {
          material = await searchByBarcode(query);
          if (!material) {
            setError(`Código de barras "${query}" no encontrado en el catálogo.`);
          }
        } else if (type === "reference") {
          material = await searchByReference(query);
          if (!material) {
            setError(`Referencia "${query}" no encontrada en el catálogo.`);
          }
        } else {
          material = await searchMaterial(query);
          if (!material) {
            setError("Material no encontrado. Verifica el código o la referencia.");
          }
        }

        if (material) {
          setSelectedMaterial(material);
          setSuccess("Material encontrado");
          setManualCode("");
          setScannedCode("");
        }
      } catch (err) {
        setError(
          `Error en la búsqueda: ${err instanceof Error ? err.message : "Error desconocido"}`
        );
      } finally {
        setLoading(false);
      }
    },
    [cacheReady]
  );

  const handleScan = useCallback(
    (code: string) => {
      setScannedCode(code);
      void handleSearch(code, "auto");
    },
    [handleSearch]
  );

  const handleManualSearch = useCallback(() => {
    if (manualCode.trim()) {
      void handleSearch(manualCode, searchType === "auto" ? "auto" : searchType);
    }
  }, [manualCode, handleSearch, searchType]);

  const handleKeyPress = (event: React.KeyboardEvent) => {
    if (event.key === "Enter") {
      handleManualSearch();
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4">
      <div className="max-w-2xl mx-auto">
        <div className="flex flex-col items-center justify-center mb-8 pt-6 text-center">
          <Logo size={56} />
        </div>

        <div className="mb-6">
          <CacheLoader onCacheLoaded={handleCacheLoaded} />
        </div>

        {!cacheReady && (
          <button
            onClick={() => setShowNewProductForm(true)}
            className="w-full mb-8 min-h-14 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-zinc-300 hover:text-white font-semibold transition-all active:scale-95 group"
          >
            <PackagePlus className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            Registrar producto
          </button>
        )}

        {cacheReady && (
          <>
            <div className="mb-8">
              <Scanner onScan={handleScan} />
              {scannedCode && (
                <p className="text-sm text-red-400 mt-2 text-center">
                  Código escaneado: <span className="font-mono">{scannedCode}</span>
                </p>
              )}
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                O busca manualmente:
              </label>

              <div className="flex gap-2 mb-4">
                {[
                  { id: "auto", label: "Automático" },
                  { id: "barcode", label: "Por Código" },
                  { id: "reference", label: "Por Referencia" },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSearchType(item.id as typeof searchType)}
                    className={`min-h-11 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
                      searchType === item.id
                        ? "bg-red-500 text-white"
                        : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(event) => {
                    setManualCode(event.target.value);
                    setError("");
                  }}
                  onKeyDown={handleKeyPress}
                  placeholder={searchType === "reference" ? "Ej: REF-12345" : "Ej: 8411564234567"}
                  className="min-w-0 flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                />
                <button
                  onClick={handleManualSearch}
                  disabled={loading || !manualCode.trim()}
                  className="min-h-12 px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-95 flex items-center gap-2"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Search className="w-5 h-5" />
                  )}
                  Buscar
                </button>
              </div>

              <div className="mt-4 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
                <p className="text-xs text-zinc-400">
                  <strong>Automático:</strong> busca por código de barras o referencia. <br />
                  <strong>Por Código:</strong> solo por código de barras (EAN, UPC). <br />
                  <strong>Por Referencia:</strong> solo por referencia del producto.
                </p>
              </div>
            </div>

            <div className="grid gap-3 mb-8 md:grid-cols-2">
              <button
                onClick={handleOpenMaterialsList}
                className="w-full min-h-14 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-zinc-300 hover:text-white font-semibold transition-all active:scale-95 group"
              >
                <List className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                Ver catálogo ({cacheItemCount})
              </button>
              <button
                onClick={() => setShowNewProductForm(true)}
                className="w-full min-h-14 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-zinc-300 hover:text-white font-semibold transition-all active:scale-95 group"
              >
                <PackagePlus className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                Registrar producto
              </button>
            </div>
          </>
        )}

        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-8 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Error en la búsqueda</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {success && (
          <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 mb-8 flex gap-3">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
            <p className="text-green-300 text-sm">{success}</p>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12">
            <Logo size={48} iconOnly className="mb-4" />
            <Loader2 className="w-8 h-8 text-red-400 animate-spin mb-3" />
            <p className="text-zinc-400">Buscando en {cacheItemCount} materiales...</p>
          </div>
        )}

        {selectedMaterial && !loading && (
          <ProductCard
            material={selectedMaterial}
            onClose={() => setSelectedMaterial(null)}
            onSaved={(message) => setSuccess(message)}
          />
        )}

        {showMaterialsList && (
          <MaterialsList
            materials={allMaterials}
            onClose={() => setShowMaterialsList(false)}
            onSelectMaterial={(material) => {
              setSelectedMaterial(material);
              setShowMaterialsList(false);
            }}
          />
        )}

        {showNewProductForm && (
          <NewProductForm
            onClose={() => setShowNewProductForm(false)}
            onProductCreated={(count) => {
              setCacheReady(true);
              setCacheItemCount(count);
              setSuccess("Producto registrado y catálogo actualizado");
            }}
          />
        )}

        {!selectedMaterial && !loading && cacheReady && !showMaterialsList && (
          <div className="text-center py-12">
            <p className="text-zinc-400">
              Escanea un código de barras, busca manualmente o abre el catálogo.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
