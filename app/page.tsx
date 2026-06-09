"use client";

import { useState, useCallback, useEffect } from "react";
import { searchMaterial, searchByBarcode, searchByReference } from "@/services/search";
import { Material } from "@/types/material";
import Scanner from "@/components/Scanner";
import ProductCard from "@/components/ProductCard";
import CacheLoader from "@/components/CacheLoader";
import NewProductForm from "@/components/NewProductForm";
import MaterialsList from "@/components/MaterialsList";
import { getCacheInfo, getAllMaterialsFromCache } from "@/services/cache";
import { Search, AlertCircle, Loader2, CheckCircle, List, PackagePlus } from "lucide-react";
import Logo from "@/components/Logo";
import axios from "axios";
import { getCacheInfo, getAllMaterialsFromCache } from "@/services/cache";
import { Search, AlertCircle, Loader2, CheckCircle, List, Clock, ArrowRightLeft } from "lucide-react";

interface PendingAdjustment {
  id: string;
  reference: string;
  name: string;
  difference: number;
  created_at: string;
}

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

  // ESTADO NUEVO: Cola de ajustes pendientes que se muestran al operario
  const [queueAdjustments, setQueueAdjustments] = useState<PendingAdjustment[]>([]);

  // Cargar la lista de sincronizaciones pendientes desde la base de datos
  const fetchQueueAdjustments = async () => {
    try {
      const response = await axios.get("/api/adjustments");
      setQueueAdjustments(response.data);
    } catch (err) {
      console.error("Error cargando cola de cambios:", err);
    }
  };

  // Verificar si el caché está listo y traer la cola
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
    fetchQueueAdjustments(); // Traer cola al cargar caché
  }, []);

  const handleOpenMaterialsList = () => {
    const materials = getAllMaterialsFromCache();
    setAllMaterials(materials);
    setShowMaterialsList(true);
  };

  const handleSearch = useCallback(
    async (code: string, type: "barcode" | "reference" | "auto" = "auto") => {
      if (!code.trim()) {
        setError("Por favor ingresa un código");
        return;
      }

      if (!cacheReady) {
        setError("El caché no está listo. Por favor carga los materiales primero.");
        return;
      }

      setLoading(true);
      setError("");
      setSuccess("");

      try {
        let material: Material | null = null;

        if (type === "barcode") {
          material = await searchByBarcode(code);
          if (!material) {
            setError(`Código de barras "${code}" no encontrado`);
          }
        } else if (type === "reference") {
          material = await searchByReference(code);
          if (!material) {
            setError(`Referencia "${code}" no encontrada`);
          }
        } else {
          material = await searchMaterial(code);
          if (!material) {
            setError(`Material no encontrado. Verifique los datos.`);
          }
        }

        if (material) {
          setSelectedMaterial(material);
          setSuccess(`✓ Material encontrado`);
          setManualCode("");
          setScannedCode("");
        }
      } catch (err) {
        setError(`Error en la búsqueda: ${err instanceof Error ? err.message : "Error desconocido"}`);
        console.error("Search error:", err);
      } finally {
        setLoading(false);
      }
    },
    [cacheReady]
  );

  const handleScan = useCallback(
    (code: string) => {
      setScannedCode(code);
      handleSearch(code, "auto");
    },
    [handleSearch]
  );

  const handleManualSearch = useCallback(() => {
    if (manualCode.trim()) {
      handleSearch(manualCode, searchType === "auto" ? "auto" : searchType);
    }
  }, [manualCode, handleSearch, searchType]);

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleManualSearch();
    }
  };

  // Al cerrar la ficha de producto, volvemos a actualizar la lista por si hubo cambios
  const handleCloseProductCard = () => {
    setSelectedMaterial(null);
    fetchQueueAdjustments();
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 p-4 pb-12">
      <div className="max-w-2xl mx-auto">
        
        {/* Header con tu Logo PNG */}
        <div className="flex flex-col items-center justify-center mb-8 pt-6 text-center">
          <Logo size={56} />
        </div>

        <div className="mb-6">
          <CacheLoader onCacheLoaded={handleCacheLoaded} />
        </div>

        {/* COLA DE CAMBIOS EN ESPERA (Aviso para operarios) */}
        {cacheReady && queueAdjustments.length > 0 && (
          <div className="mb-8 bg-zinc-900/60 border border-zinc-800 rounded-2xl p-4 shadow-xl">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
              <Clock size={14} className="text-red-500 animate-pulse" />
              Piezas cogidas en espera de volcar al PC ({queueAdjustments.length})
            </h3>
            <div className="space-y-2.5 max-h-40 overflow-y-auto pr-1">
              {queueAdjustments.map((adjustment) => (
                <div 
                  key={adjustment.id} 
                  className="bg-zinc-950 border border-zinc-800/80 rounded-xl p-3 flex items-center justify-between text-xs transition-all hover:border-zinc-700"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-mono bg-zinc-900 text-red-400 font-bold px-1.5 py-0.5 rounded text-[10px] border border-zinc-800">
                        {adjustment.reference}
                      </span>
                      <span className="text-[10px] text-zinc-500">
                        {new Date(adjustment.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-zinc-200 font-medium truncate">{adjustment.name}</p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    <span className={`font-bold px-2 py-0.5 rounded-full ${
                      adjustment.difference > 0 ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400"
                    }`}>
                      {adjustment.difference > 0 ? `+${adjustment.difference}` : adjustment.difference} u
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Cache Ready Indicator */}
        {cacheReady && queueAdjustments.length === 0 && (
          <div className="bg-green-900/10 border border-green-950 rounded-xl p-3 mb-6 flex items-center gap-2">
            <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
            <p className="text-xs text-green-400">
              Todo sincronizado con el PC. No hay piezas pendientes de procesar.
            </p>
          </div>
        )}

        {!cacheReady && (
          <button
            onClick={() => setShowNewProductForm(true)}
            className="w-full mb-8 py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-zinc-300 hover:text-white font-medium transition-all group"
          >
            <PackagePlus className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
            Registrar producto
          </button>
        )}

        {/* Scanner & Manual Search */}
        {cacheReady && (
          <>
            <div className="mb-8">
              <Scanner onScan={handleScan} />
              {scannedCode && (
                <p className="text-sm text-red-400 mt-2 text-center">
                  ✓ Código escaneado: <span className="font-mono">{scannedCode}</span>
                </p>
              )}
            </div>

            {/* Manual Search */}
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 mb-4">
              <label className="block text-sm font-medium text-zinc-300 mb-3">
                O busca manualmente:
              </label>

              {/* Search Type Selector */}
              <div className="flex gap-2 mb-4">
                <button
                  onClick={() => setSearchType("auto")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    searchType === "auto" ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  Automático
                </button>
                <button
                  onClick={() => setSearchType("barcode")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    searchType === "barcode" ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  Por Código
                </button>
                <button
                  onClick={() => setSearchType("reference")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                    searchType === "reference" ? "bg-red-500 text-white" : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  }`}
                >
                  Por Referencia
                </button>
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualCode}
                  onChange={(e) => {
                    setManualCode(e.target.value);
                    setError("");
                  }}
                  onKeyPress={handleKeyPress}
                  placeholder={searchType === "reference" ? "Ej: REF-12345" : "Ej: 8411564234567"}
                  className="flex-1 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500 transition-all"
                />
                <button
                  onClick={handleManualSearch}
                  disabled={loading || !manualCode.trim()}
                  className="px-6 py-3 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-red-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
                  Buscar
                </button>
              </div>
            </div>

            <div className="grid gap-3 mb-8 md:grid-cols-2">
              <button
                onClick={handleOpenMaterialsList}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-zinc-300 hover:text-white font-medium transition-all group"
              >
                <List className="w-5 h-5 text-red-500 group-hover:scale-110 transition-transform" />
                Ver catálogo ({cacheItemCount})
              </button>
              <button
                onClick={() => setShowNewProductForm(true)}
                className="w-full py-4 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 rounded-2xl flex items-center justify-center gap-2 text-zinc-300 hover:text-white font-medium transition-all group"
              >
                <PackagePlus className="w-5 h-5 text-emerald-400 group-hover:scale-110 transition-transform" />
                Registrar producto
              </button>
            </div>
          </>
        )}

        {/* Mensajes de error/éxito */}
        {error && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-8 flex gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-400 font-medium">Error en la búsqueda</p>
              <p className="text-red-300 text-sm mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Product Card - Modal de edición */}
        {selectedMaterial && !loading && (
          <ProductCard
            material={selectedMaterial}
            onClose={handleCloseProductCard} // Usamos la nueva función para recargar la cola al cerrar
          />
        )}

        {/* Listado Completo de Materiales - Modal */}
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

        {/* Empty State */}
        {!selectedMaterial && !loading && cacheReady && !showMaterialsList && (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🔍</div>
            <p className="text-zinc-400">
              Scanea un código de barras, busca manualmente o abre el catálogo.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
