import Link from "next/link";
import { ArrowLeft, ChevronRight, Settings2, Warehouse, Wrench } from "lucide-react";

const sections = [
  { href: "/admin/configuracion/herramientas", title: "Herramientas comunes", description: "Devoluciones, retiradas, fotografías y permisos de herramientas.", icon: Wrench, tone: "cyan" },
  { href: "/admin/configuracion/almacen-desguace", title: "Almacén Desguace", description: "Permisos para registrar, fotografiar, ubicar y vender piezas.", icon: Warehouse, tone: "amber" },
] as const;

export default function SettingsHomePage() {
  return <main className="min-h-dvh bg-zinc-950 p-4 text-white"><div className="mx-auto max-w-2xl"><header className="mb-6 flex items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-black"><Settings2 className="text-cyan-400" /> Configuración</h1><p className="mt-1 text-sm text-zinc-400">Elige qué parte de la aplicación quieres configurar</p></div><Link href="/" className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-300"><ArrowLeft size={17} /> Inicio</Link></header><div className="space-y-4">{sections.map(({ href, title, description, icon: Icon, tone }) => <Link key={href} href={href} className={`flex min-h-28 items-center gap-4 rounded-2xl border bg-zinc-900 p-5 transition active:scale-[.99] ${tone === "cyan" ? "border-cyan-500/25 hover:border-cyan-400/60" : "border-amber-500/25 hover:border-amber-400/60"}`}><span className={`rounded-2xl p-3 ${tone === "cyan" ? "bg-cyan-500/10 text-cyan-300" : "bg-amber-500/10 text-amber-300"}`}><Icon size={28} /></span><span className="min-w-0 flex-1"><strong className="block text-lg text-white">{title}</strong><span className="mt-1 block text-sm leading-5 text-zinc-500">{description}</span></span><ChevronRight className="shrink-0 text-zinc-600" /></Link>)}</div></div></main>;
}
