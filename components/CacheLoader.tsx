"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle,
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
  const [success, setSuccess] = useState("");

  const loadCache = useCallback(
    async (forceRefresh = false) => {
      try {
        setIsLoading(true);
        setError("");
        setSuccess("");

        const materials = await loadAllMaterials(forceRefresh);
        const info = getCacheInfo();

        setCacheInfo(info);
        setSuccess(`${materials.length} materiales cargados`);
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
    setSuccess("Catalogo local vaciado");
  };

  return (
    <div className="space-y-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
        <div className="flex items-start justify-between mb-4 gap-4">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              Catalogo local
            </h3>
            <p className="text-sm text-zinc-400">
              Se actualiza al pedirlo o automaticamente cada 24 horas.
            </p>
          </div>

          {cacheInfo.itemCount > 0 && !cacheInfo.isExpired && (
            <div className="flex items-center gap-2 px-3 py-1 bg-green-900/30 border border-green-700 rounded-lg">
              <CheckCircle className="w-4 h-4 text-green-400" />
              <span className="text-xs font-medium text-green-400">Listo</span>
            </div>
          )}
          {cacheInfo.itemCount > 0 && cacheInfo.isExpired && (
            <div className="flex items-center gap-2 px-3 py-1 bg-amber-900/30 border border-amber-700 rounded-lg">
              <AlertCircle className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-medium text-amber-400">24h</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-400 mb-1">Productos</p>
            <p className="text-2xl font-bold text-cyan-400">
              {cacheInfo.itemCount}
            </p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-400 mb-1">Tamano</p>
            <p className="text-2xl font-bold text-cyan-400">
              {cacheInfo.sizeKB} KB
            </p>
          </div>
          <div className="bg-zinc-800 rounded-lg p-3">
            <p className="text-xs text-zinc-400 mb-1">Actualizado</p>
            <p className="text-xs font-mono text-cyan-400">
              {cacheInfo.lastUpdated
                ? new Date(cacheInfo.lastUpdated).toLocaleDateString()
                : "Nunca"}
            </p>
          </div>
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => void loadCache(true)}
            disabled={isLoading}
            className="flex-1 px-4 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg hover:shadow-cyan-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4" />
            )}
            {isLoading ? "Cargando..." : "Actualizar catalogo"}
          </button>
          <button
            onClick={handleClearCache}
            disabled={isLoading || cacheInfo.itemCount === 0}
            className="px-4 py-3 bg-red-900/20 border border-red-800 text-red-400 rounded-xl font-medium hover:bg-red-900/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Vaciar
          </button>
        </div>
      </div>

      {success && (
        <div className="bg-green-900/20 border border-green-800 rounded-xl p-4 flex gap-3">
          <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

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
              Pulsa Actualizar catalogo para cargar los materiales.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
