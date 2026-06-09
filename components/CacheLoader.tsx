"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { clearCache, getCacheInfo, loadAllMaterials } from "@/services/cache";

interface CacheLoaderProps {
  onCacheLoaded?: (count: number) => void;
  onError?: (error: string) => void;
}

export default function CacheLoader({ onCacheLoaded, onError }: CacheLoaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [cacheInfo, setCacheInfo] = useState({
    itemCount: 0,
    sizeKB: 0,
    lastUpdated: null as string | null,
    isExpired: true,
  });
  const [error, setError] = useState("");
  const [showDetails, setShowDetails] = useState(false);

  const loadCache = useCallback(
    async (forceRefresh = false) => {
      try {
        setIsLoading(true);
        setError("");

        const materials = await loadAllMaterials(forceRefresh);
        const info = getCacheInfo();

        setCacheInfo(info);
        onCacheLoaded?.(materials.length);
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : "Error desconocido";
        setError(`Error cargando materiales: ${errorMsg}`);
        onError?.(errorMsg);
      } finally {
        setIsLoading(false);
      }
    },
    [onCacheLoaded, onError]
  );

  const loadCacheIfNeeded = useCallback(async () => {
    const info = getCacheInfo();
    setCacheInfo(info);

    if (info.itemCount > 0 && !info.isExpired) {
      onCacheLoaded?.(info.itemCount);
      return;
    }

    await loadCache(false);
  }, [loadCache, onCacheLoaded]);

  useEffect(() => {
    void Promise.resolve().then(loadCacheIfNeeded);
  }, [loadCacheIfNeeded]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      const info = getCacheInfo();

      if (info.itemCount > 0 && info.isExpired) {
        void loadCache(false);
      }
    }, 60 * 60 * 1000);

    return () => window.clearInterval(intervalId);
  }, [loadCache]);

  const handleClearCache = () => {
    if (!window.confirm("Quieres vaciar el catalogo local?")) {
      return;
    }

    clearCache();
    const info = getCacheInfo();
    setCacheInfo(info);
  };

  return (
    <div className="space-y-3">
      <div className="bg-zinc-900/70 border border-zinc-800 rounded-2xl p-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs text-zinc-500">Catalogo local</p>
            <p className="text-lg font-bold text-white">
              {cacheInfo.itemCount} productos
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => void loadCache(true)}
              disabled={isLoading}
              className="flex-1 sm:flex-none px-4 py-3 bg-zinc-800 hover:bg-zinc-700 text-white rounded-xl font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {isLoading ? "Cargando..." : "Actualizar"}
            </button>
            <button
              type="button"
              onClick={() => setShowDetails((current) => !current)}
              className="px-4 py-3 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-300 rounded-xl font-medium transition-all flex items-center justify-center gap-2"
            >
              {showDetails ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
              Datos
            </button>
          </div>
        </div>

        {showDetails && (
          <div className="mt-4 border-t border-zinc-800 pt-4">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-zinc-950 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-1">Tamano</p>
                <p className="text-sm font-bold text-zinc-200">
                  {cacheInfo.sizeKB} KB
                </p>
              </div>
              <div className="bg-zinc-950 rounded-lg p-3">
                <p className="text-xs text-zinc-500 mb-1">Actualizado</p>
                <p className="text-sm font-mono text-zinc-200">
                  {cacheInfo.lastUpdated
                    ? new Date(cacheInfo.lastUpdated).toLocaleString()
                    : "Nunca"}
                </p>
              </div>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-zinc-500">
                Se recarga solo cuando pasan 24 horas.
              </p>
              <button
                onClick={handleClearCache}
                disabled={isLoading || cacheInfo.itemCount === 0}
                className="px-3 py-2 bg-red-900/20 border border-red-800 text-red-400 rounded-lg text-sm font-medium hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                Vaciar
              </button>
            </div>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-300 text-sm font-medium">Error</p>
            <p className="text-red-300/80 text-sm mt-1">{error}</p>
          </div>
        </div>
      )}

      {cacheInfo.itemCount === 0 && !isLoading && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-amber-300 text-sm font-medium">
              Sin catalogo local
            </p>
            <p className="text-amber-300/80 text-sm mt-1">
              Pulsa Actualizar para cargar los materiales.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
