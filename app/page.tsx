"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import axios from "axios";
import { AlertCircle, BellRing, CheckCircle, ChevronRight, KeyRound, List, Loader2, LogOut, PackagePlus, Search, Settings2, ShieldCheck, Warehouse, Wrench } from "lucide-react";
import Link from "next/link";
import CacheLoader from "@/components/CacheLoader";
import Logo from "@/components/Logo";
import MaterialsList from "@/components/MaterialsList";
import NewProductForm from "@/components/NewProductForm";
import ProductCard from "@/components/ProductCard";
import Scanner from "@/components/Scanner";
import {
  getAllMaterialsFromCache,
  getCacheInfo,
  updateMaterialInCache,
} from "@/services/cache";
import { searchByBarcode, searchByReference, searchMaterial } from "@/services/search";
import { Material } from "@/types/material";
import { getStockMinimum, isLowStock } from "@/lib/stock-alerts";
import type { AppUser } from "@/lib/app-users";

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
  const [lowStockCount, setLowStockCount] = useState(0);
  const [materialsListFilter, setMaterialsListFilter] = useState<"all" | "alerts">("all");
  const [currentUser, setCurrentUser] = useState<AppUser | null>(null);

  useEffect(() => {
    void Promise.resolve().then(() => {
      const info = getCacheInfo();

      setCacheReady(info.itemCount > 0);
      setCacheItemCount(info.itemCount);
      setLowStockCount(getAllMaterialsFromCache().filter(isLowStock).length);
    });
  }, []);

  useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json()).then((payload: { user?: AppUser }) => setCurrentUser(payload.user || null)).catch(() => undefined);
  }, []);

  const handleCacheLoaded = useCallback((count: number) => {
    setCacheReady(true);
    setCacheItemCount(count);
    setLowStockCount(getAllMaterialsFromCache().filter(isLowStock).length);
  }, []);

  const handleOpenMaterialsList = () => {
    setAllMaterials(getAllMaterialsFromCache());
    setMaterialsListFilter("all");
    setShowMaterialsList(true);
  };

  const handleOpenStockAlerts = () => {
    setAllMaterials(getAllMaterialsFromCache());
    setMaterialsListFilter("alerts");
    setShowMaterialsList(true);
  };

  const handleIgnoreStockAlert = async (material: Material) => {
    setError("");

    try {
      const response = await axios.put("/api/materials", {
        material_id: material.material_id,
        alert_threshold: 0,
      });
      const updatedMaterial: Material = {
        ...material,
        ...response.data.material,
        alert_threshold: 0,
      };

      updateMaterialInCache(updatedMaterial);
      setAllMaterials((current) =>
        current.map((item) =>
          item.material_id === material.material_id ? updatedMaterial : item
        )
      );
      setLowStockCount((current) => Math.max(0, current - 1));
    } catch (ignoreError) {
      const message = axios.isAxiosError(ignoreError)
        ? ignoreError.response?.data?.error || ignoreError.message
        : ignoreError instanceof Error
          ? ignoreError.message
          : "Error desconocido";
      setError(`No se pudo marcar «No reponer»: ${message}`);
      throw new Error(message);
    }
  };

  const handleExportStockAlerts = () => {
    const alerts = getAllMaterialsFromCache()
      .filter(isLowStock)
      .sort((a, b) => String(a.reference || "").localeCompare(String(b.reference || "")));

    if (alerts.length === 0) {
      setError("No hay materiales con alerta de stock para exportar.");
      return;
    }

    const escapeCsv = (value: unknown) =>
      `"${String(value ?? "").replaceAll('"', '""')}"`;
    const rows = alerts.map((material) => {
      const quantity = Number(material.quantity ?? 0);
      const minimum = getStockMinimum(material);
      const orderQuantity = Math.max(1, Math.ceil(minimum + 1 - quantity));

      return [
        material.reference,
        material.name || material.description || "",
        quantity,
        minimum,
        orderQuantity,
        material.unit || "ud.",
      ].map(escapeCsv).join(";");
    });
    const csv = [
      ["Referencia", "Material", "Stock actual", "Stock mínimo", "Cantidad a pedir", "Unidad"]
        .map(escapeCsv)
        .join(";"),
      ...rows,
    ].join("\r\n");
    const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `pedido-stock-bajo-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
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
        const message = axios.isAxiosError(err)
          ? err.response?.data?.error || err.message
          : err instanceof Error
            ? err.message
            : "Error desconocido";

        setError(`Error en la búsqueda: ${message}`);
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
        <div className="mb-4 flex items-center justify-between gap-3 pt-2">
          <Link href="/mi-cuenta" className="flex min-w-0 items-center gap-2 rounded-xl py-1 pr-2 text-left"><KeyRound size={18} className="shrink-0 text-cyan-400" /><span className="min-w-0"><span className="block truncate text-sm font-bold text-zinc-200">{currentUser?.nombre || "Usuario"}</span><span className="block text-xs text-zinc-500">{currentUser?.rol === "administrador" ? "Administrador" : "Empleado"} · Cambiar PIN</span></span></Link>
          <button onClick={() => void fetch("/api/auth/logout", { method: "POST" }).finally(() => window.location.replace("/login"))} className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-400"><LogOut size={17} /> Salir</button>
        </div>
        <div className="flex flex-col items-center justify-center mb-8 text-center">
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

            {error && (
              <div className="bg-red-900/20 border border-red-800 rounded-xl p-4 mb-4 flex gap-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-red-400 font-medium">Error en la búsqueda</p>
                  <p className="text-red-300 text-sm mt-1">{error}</p>
                </div>
              </div>
            )}

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
              {lowStockCount > 0 && (
                <button
                  onClick={handleOpenStockAlerts}
                  className="min-h-14 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-4 text-left transition-all hover:bg-amber-500/15 active:scale-95 md:col-span-2"
                >
                  <span className="flex items-center gap-3">
                    <BellRing className="h-6 w-6 text-amber-400" />
                    <span>
                      <span className="block font-bold text-amber-300">
                        {lowStockCount} {lowStockCount === 1 ? "alerta" : "alertas"} de stock
                      </span>
                      <span className="text-sm text-amber-200/70">
                        Ver materiales que hay que reponer
                      </span>
                    </span>
                  </span>
                </button>
              )}
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
              {currentUser?.rol === "administrador" && (
                <HomeNavLink href="/admin" title="Movimientos stock" description="Historial y control del inventario" icon={<ShieldCheck />} tone="red" className="md:col-span-2" />
              )}
              <HomeNavLink href="/almacen-desguace" title="Almacén Desguace" description="Piezas, ubicaciones y retiradas" icon={<Warehouse />} tone="amber" className="md:col-span-2" />
              <HomeNavLink href="/herramientas-comunes" title="Herramientas comunes" description="Préstamos, devoluciones y estanterías" icon={<Wrench />} tone="cyan" className="md:col-span-2" />
              {currentUser?.rol === "administrador" && <><HomeNavLink href="/admin/usuarios" title="Usuarios y permisos" description="Empleados, accesos y roles" icon={<ShieldCheck />} tone="violet" /><HomeNavLink href="/admin/configuracion" title="Configuración" description="Ajustes generales de la aplicación" icon={<Settings2 />} tone="cyan" /></>}
            </div>
          </>
        )}

        {error && !cacheReady && (
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
            initialStockFilter={materialsListFilter}
            onIgnoreStockAlert={handleIgnoreStockAlert}
            onExportStockAlerts={handleExportStockAlerts}
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

function HomeNavLink({ href, title, description, icon, tone, className = "" }: { href: string; title: string; description: string; icon: ReactNode; tone: "red" | "amber" | "cyan" | "violet"; className?: string }) {
  const tones = {
    red: { icon: "bg-red-500/10 text-red-300 ring-red-500/20", hover: "hover:border-red-500/40" },
    amber: { icon: "bg-amber-500/10 text-amber-300 ring-amber-500/20", hover: "hover:border-amber-500/40" },
    cyan: { icon: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/20", hover: "hover:border-cyan-500/40" },
    violet: { icon: "bg-violet-500/10 text-violet-300 ring-violet-500/20", hover: "hover:border-violet-500/40" },
  }[tone];
  return <Link href={href} className={`group flex min-h-20 w-full items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 text-left shadow-sm shadow-black/20 transition hover:bg-zinc-800/90 active:scale-[0.98] ${tones.hover} ${className}`}>
    <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset [&>svg]:h-5 [&>svg]:w-5 ${tones.icon}`}>{icon}</span>
    <span className="min-w-0 flex-1"><span className="block font-black text-white">{title}</span><span className="mt-0.5 block text-xs leading-4 text-zinc-500">{description}</span></span>
    <ChevronRight className="shrink-0 text-zinc-600 transition group-hover:translate-x-0.5 group-hover:text-zinc-300" size={20} />
  </Link>;
}
