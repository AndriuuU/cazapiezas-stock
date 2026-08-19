"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, ChevronLeft, FileSpreadsheet, History, LayoutDashboard, MapPinned, MoreHorizontal, PackagePlus, PackageX, ScanBarcode, ShoppingBag, Warehouse, X } from "lucide-react";
import VersionBadge from "@/components/almacen-desguace/VersionBadge";
import MobileQuickActions from "@/components/almacen-desguace/MobileQuickActions";
import { useCurrentUser } from "@/components/auth/useCurrentUser";

export default function MobileWarehouseNav() {
  const pathname = usePathname();
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.rol === "administrador";
  const [open, setOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);

  useEffect(() => {
    if (!open && !quickOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, [open, quickOpen]);

  const piecesActive = pathname === "/almacen-desguace";
  const moreActive = open || pathname.includes("/resumen") || pathname.includes("/historial") || pathname.includes("/estanterias");

  return <>
    {open && createPortal(<>
      <button type="button" aria-label="Cerrar menú" onClick={() => setOpen(false)} className="warehouse-mobile-nav-root fixed inset-0 bg-black/95" style={{ zIndex: 140 }} />
      <section aria-label="Más opciones del almacén" className="warehouse-mobile-nav-root warehouse-mobile-menu fixed rounded-3xl border border-zinc-700 p-3 shadow-2xl shadow-black" style={{ left: "0.75rem", right: "0.75rem", bottom: "calc(5.25rem + env(safe-area-inset-bottom))", zIndex: 150, backgroundColor: "#09090b" }}>
        <div className="mb-2 flex items-center justify-between px-2 py-1">
          <div><div className="flex items-center gap-2"><p className="font-black text-white">Más opciones</p><VersionBadge className="bg-black" /></div><p className="text-xs text-zinc-500">Consulta y organiza el almacén</p></div>
          <button type="button" onClick={() => setOpen(false)} className="rounded-full border border-zinc-700 bg-black p-2 text-zinc-300 active:scale-90" aria-label="Cerrar menú"><X size={20} /></button>
        </div>
        <div className="grid gap-2" style={{ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
          <Link onClick={() => setOpen(false)} href="/almacen-desguace/nueva" className="warehouse-mobile-menu-option border-amber-500/40 bg-amber-500/10 text-amber-300"><PackagePlus size={21} /><span>Nueva pieza</span></Link>
          {isAdmin && <Link onClick={() => setOpen(false)} href="/almacen-desguace/importar-iam" className="warehouse-mobile-menu-option border-violet-500/40 bg-violet-500/10 text-violet-300"><FileSpreadsheet size={21} /><span>Importar IAM</span></Link>}
          <Link onClick={() => setOpen(false)} href="/almacen-desguace/resumen" className={`warehouse-mobile-menu-option ${pathname.includes("/resumen") ? "border-amber-500/60 bg-amber-500/10 text-amber-300" : "border-zinc-700 bg-black text-zinc-200"}`}><LayoutDashboard size={21} /><span>Resumen</span></Link>
          <Link onClick={() => setOpen(false)} href="/almacen-desguace?view=vendidas" className="warehouse-mobile-menu-option border-zinc-700 bg-black text-zinc-200"><ShoppingBag size={21} /><span>Vendidas</span></Link>
          <Link onClick={() => setOpen(false)} href="/almacen-desguace?view=retiradas" className="warehouse-mobile-menu-option border-zinc-700 bg-black text-zinc-200"><PackageX size={21} /><span>Retiradas</span></Link>
          <Link onClick={() => setOpen(false)} href="/almacen-desguace/historial" className={`warehouse-mobile-menu-option ${pathname.includes("/historial") ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300" : "border-zinc-700 bg-black text-zinc-200"}`}><History size={21} /><span>Historial</span></Link>
          {isAdmin && <Link onClick={() => setOpen(false)} href="/almacen-desguace/estanterias" className={`warehouse-mobile-menu-option ${pathname.includes("/estanterias") ? "border-cyan-500/60 bg-cyan-500/10 text-cyan-300" : "border-zinc-700 bg-black text-zinc-200"}`}><Warehouse size={21} /><span>Estanterías</span></Link>}
          <Link onClick={() => setOpen(false)} href="/" className="warehouse-mobile-menu-option border-zinc-700 bg-black text-zinc-200" style={{ gridColumn: "1 / -1" }}><ChevronLeft size={21} /><span>Volver a Stock tienda</span></Link>
        </div>
      </section>
    </>, document.body)}

    <nav aria-label="Navegación móvil del almacén" className="warehouse-mobile-nav-root fixed inset-x-0 bottom-0 border-t border-zinc-800 px-2 pt-2 shadow-[0_-12px_30px_rgba(0,0,0,0.65)]" style={{ zIndex: 250, paddingBottom: "max(0.5rem, env(safe-area-inset-bottom))", backgroundColor: "#000" }}>
      <div className="mx-auto grid max-w-md items-end" style={{ gridTemplateColumns: "repeat(5, minmax(0, 1fr))" }}>
        <Link onClick={() => setQuickOpen(false)} href="/almacen-desguace" className={`warehouse-bottom-nav-item ${piecesActive ? "text-amber-400" : "text-zinc-500"}`}><Warehouse className={piecesActive ? "-translate-y-0.5 scale-110" : ""} size={22} /><span>Piezas</span></Link>
        <Link onClick={() => setQuickOpen(false)} href="/almacen-desguace/cajones" className={`warehouse-bottom-nav-item ${pathname.startsWith("/almacen-desguace/cajones") ? "text-cyan-300" : "text-zinc-500"}`}><Archive size={22} /><span>Cajones</span></Link>
        <button type="button" onClick={() => { setOpen(false); setQuickOpen((current) => !current); }} className="warehouse-bottom-nav-create" aria-label={quickOpen ? "Cerrar acciones rápidas" : "Abrir acciones rápidas"}><span><ScanBarcode size={27} /></span><small>Rápidas</small></button>
        <Link onClick={() => setQuickOpen(false)} href="/almacen-desguace/plano" className={`warehouse-bottom-nav-item ${pathname.startsWith("/almacen-desguace/plano") ? "text-cyan-300" : "text-zinc-500"}`}><MapPinned size={22} /><span>Plano</span></Link>
        <button type="button" aria-expanded={open} onClick={() => { setQuickOpen(false); setOpen((current) => !current); }} className={`warehouse-bottom-nav-item ${moreActive ? "text-cyan-300" : "text-zinc-500"}`}><MoreHorizontal className={open ? "-translate-y-0.5 scale-110" : ""} size={24} /><span>Más</span></button>
      </div>
    </nav>

    {quickOpen && createPortal(<MobileQuickActions onClose={() => setQuickOpen(false)} />, document.body)}

    <style jsx global>{`@media (max-width: 639px) { main { padding-bottom: 7rem !important; } .warehouse-module-header { display: none !important; } } @media (min-width: 640px) { .warehouse-mobile-nav-root { display: none !important; } } .warehouse-bottom-nav-item { display: flex; min-height: 3.5rem; flex-direction: column; align-items: center; justify-content: center; gap: .2rem; border-radius: .9rem; font-size: .68rem; font-weight: 800; transition: color 180ms ease, transform 180ms ease, background-color 180ms ease; } .warehouse-bottom-nav-item:active { transform: scale(.9); background: rgb(24 24 27); } .warehouse-bottom-nav-item svg { transition: transform 220ms cubic-bezier(.2,.8,.2,1); } .warehouse-bottom-nav-create { display: flex; flex-direction: column; align-items: center; gap: .15rem; color: rgb(251 191 36); font-size: .68rem; font-weight: 900; } .warehouse-bottom-nav-create > span { display: flex; width: 3.5rem; height: 3.5rem; margin-top: -1.6rem; align-items: center; justify-content: center; border-radius: 9999px; border: 4px solid #000; background: rgb(245 158 11); color: rgb(9 9 11); box-shadow: 0 8px 24px rgba(245,158,11,.3); transition: transform 180ms ease, box-shadow 180ms ease; } .warehouse-bottom-nav-create:active > span { transform: scale(.9) rotate(90deg); } .warehouse-mobile-menu-option { display: flex; min-height: 4.25rem; align-items: center; gap: .75rem; border-width: 1px; border-radius: 1rem; padding: .8rem; font-size: .82rem; font-weight: 800; transition: transform 160ms ease, border-color 160ms ease, background-color 160ms ease; } .warehouse-mobile-menu-option:active { transform: scale(.96); } .warehouse-mobile-menu { animation: warehouse-menu-enter 220ms cubic-bezier(.2,.8,.2,1); } @keyframes warehouse-menu-enter { from { opacity: 0; transform: translateY(24px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } } @media (prefers-reduced-motion: reduce) { .warehouse-mobile-menu { animation: none; } .warehouse-bottom-nav-item, .warehouse-bottom-nav-item svg, .warehouse-bottom-nav-create > span, .warehouse-mobile-menu-option { transition: none; } }`}</style>
  </>;
}
