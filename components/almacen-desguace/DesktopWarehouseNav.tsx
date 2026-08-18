"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Archive, History, Layers3, LayoutDashboard, MapPinned, Warehouse } from "lucide-react";

const navigation = [
  { href: "/almacen-desguace", label: "Almacén", icon: Warehouse, exact: true },
  { href: "/almacen-desguace/plano", label: "Plano", icon: MapPinned },
  { href: "/almacen-desguace/cajones", label: "Cajones", icon: Archive },
  { href: "/almacen-desguace/estanterias", label: "Estanterías", icon: Layers3 },
  { href: "/almacen-desguace/resumen", label: "Resumen", icon: LayoutDashboard },
  { href: "/almacen-desguace/historial", label: "Historial", icon: History },
];

export default function DesktopWarehouseNav() {
  const pathname = usePathname();

  return (
    <>
      <nav
        aria-label="Secciones del Almacén Desguace"
        className="warehouse-desktop-module-nav sticky top-0 z-30 border-b border-zinc-800 bg-zinc-950/95 shadow-lg shadow-black/20 backdrop-blur"
      >
        <div className="mx-auto max-w-[1500px] overflow-x-auto px-4 sm:px-6">
          <div className="flex min-w-max items-center gap-2 py-2.5">
            {navigation.map(({ href, label, icon: Icon, exact }) => {
              const active = exact ? pathname === href : pathname.startsWith(href);

              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-10 items-center gap-2 rounded-xl border px-4 text-sm font-black transition ${
                    active
                      ? "border-amber-400 bg-amber-500 text-zinc-950 shadow-md shadow-amber-950/30"
                      : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-cyan-500/50 hover:bg-zinc-800 hover:text-cyan-200"
                  }`}
                >
                  <Icon size={18} />
                  {label}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>
      <style jsx global>{`
        .warehouse-desktop-module-nav { display: none; }
        @media (min-width: 640px) {
          .warehouse-desktop-module-nav { display: block !important; }
        }
      `}</style>
    </>
  );
}
