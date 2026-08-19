"use client";

import Link from "next/link";
import { Download, Trash2 } from "lucide-react";
import { useCurrentUser } from "@/components/auth/useCurrentUser";

export default function WarehouseAdminLinks() {
  const user = useCurrentUser();
  if (user?.rol !== "administrador") return null;
  return <><Link href="/api/almacen-desguace/backup" download className="inline-flex items-center gap-2 rounded-xl border border-emerald-500/30 px-3 py-2 text-sm font-bold text-emerald-300 hover:bg-emerald-500/10"><Download size={16} /> Descargar copia</Link><Link href="/almacen-desguace/papelera" className="inline-flex items-center gap-2 rounded-xl border border-red-500/30 px-3 py-2 text-sm font-bold text-red-300 hover:bg-red-500/10"><Trash2 size={16} /> Papelera</Link></>;
}
