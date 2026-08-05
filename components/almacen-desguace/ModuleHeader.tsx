import Link from "next/link";
import { ArrowLeft, Warehouse } from "lucide-react";
import MobileWarehouseNav from "@/components/almacen-desguace/MobileWarehouseNav";
import { APP_VERSION } from "@/lib/app-version";

export default function ModuleHeader({ title, subtitle }: { title?: string; subtitle?: string }) {
  return (<>
    <header className="warehouse-module-header border-b border-zinc-800 bg-zinc-950/90">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <span className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-2.5 text-amber-400"><Warehouse size={24} /></span>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2"><p className="truncate text-lg font-black tracking-wide text-white">{title || "ALMACÉN DESGUACE"}</p><span className="shrink-0 rounded-md border border-zinc-700 bg-zinc-900 px-1.5 py-0.5 font-mono text-[10px] font-bold text-zinc-500">v{APP_VERSION}</span></div>
            <p className="truncate text-xs text-zinc-500">{subtitle || "Piezas antiguas y sobrantes para venta online"}</p>
          </div>
        </div>
        <Link href="/" className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-semibold text-zinc-300 hover:bg-zinc-800 hover:text-white">
          <ArrowLeft size={16} /> Stock tienda
        </Link>
      </div>
    </header>
    <MobileWarehouseNav />
  </>);
}
