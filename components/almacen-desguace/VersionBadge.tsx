"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, History, X } from "lucide-react";
import { APP_CHANGELOG, APP_VERSION } from "@/lib/app-version";

export default function VersionBadge({ className = "" }: { className?: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return <>
    <button
      type="button"
      onClick={() => setOpen(true)}
      title="Ver novedades"
      aria-label={`Ver novedades de la versión ${APP_VERSION}`}
      className={`shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-400 transition hover:border-amber-500/50 hover:bg-amber-500/10 hover:text-amber-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400 ${className}`}
    >v{APP_VERSION}</button>

    {open && createPortal(
      <div className="fixed inset-0 flex items-center justify-center bg-black/90 p-2 backdrop-blur-sm sm:p-4" style={{ zIndex: 1000 }} onMouseDown={(event) => { if (event.target === event.currentTarget) setOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="version-history-title" className="flex w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl sm:rounded-3xl" style={{ height: "calc(100vh - 16px)", maxHeight: 760 }}>
          <header className="flex shrink-0 items-start justify-between gap-3 border-b border-zinc-800 bg-zinc-950 px-4 py-3 sm:px-6 sm:py-5">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-400 text-zinc-950 sm:h-11 sm:w-11 sm:rounded-2xl"><History size={20} /></span>
              <div><p className="text-[10px] font-black uppercase tracking-wider text-amber-300 sm:text-xs">Almacén Desguace</p><h2 id="version-history-title" className="mt-0.5 text-lg font-black leading-tight text-white sm:text-2xl">Novedades y versiones</h2><p className="mt-1 text-xs text-zinc-500 sm:text-sm">Versión instalada: <strong className="font-mono text-zinc-300">v{APP_VERSION}</strong></p></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar novedades" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 hover:text-white sm:h-11 sm:w-11"><X size={20} /></button>
          </header>

          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-4 sm:p-6">
            {APP_CHANGELOG.map((release, index) => <article key={release.version} className={`overflow-hidden rounded-2xl border ${index === 0 ? "border-amber-500/35 bg-amber-500/5" : "border-zinc-800 bg-zinc-900/50"}`}>
              <div className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${index === 0 ? "border-amber-500/20" : "border-zinc-800"}`}>
                <div className="flex items-baseline gap-1.5"><span className={`font-mono text-sm font-black sm:text-base ${index === 0 ? "text-amber-300" : "text-zinc-200"}`}>v{release.version}</span>{index === 0 && <span className="text-[7px] font-black uppercase tracking-wider text-amber-400">Actual</span>}</div>
                <time className="text-xs text-zinc-500">{release.date}</time>
              </div>
              <ul className="space-y-2 p-4">{release.changes.map((change) => <li key={change} className="flex gap-2.5 text-sm leading-5 text-zinc-300"><Check size={16} className={`mt-0.5 shrink-0 ${index === 0 ? "text-amber-400" : "text-cyan-400"}`} /><span>{change}</span></li>)}</ul>
            </article>)}
          </div>
        </section>
      </div>,
      document.body
    )}
  </>;
}
