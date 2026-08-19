"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { AlertCircle, ChevronDown, Loader2, Lock, UserRound } from "lucide-react";
import { useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import type { AppUser } from "@/lib/app-users";

function LoginForm() {
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [selectedId, setSelectedId] = useState("");
  const [pin, setPin] = useState("");
  const [password, setPassword] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [error, setError] = useState("");
  const nextPath = searchParams.get("next") || "/";

  useEffect(() => {
    void fetch("/api/auth/users", { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json() as { users?: AppUser[]; setupRequired?: boolean; error?: string };
        if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los usuarios.");
        const activeUsers = payload.users || [];
        setUsers(activeUsers);
        setSelectedId(activeUsers[0]?.id || "");
        setSetupRequired(Boolean(payload.setupRequired));
      })
      .catch((caught) => setError(caught instanceof Error ? caught.message : "No se pudieron cargar los usuarios."))
      .finally(() => setLoadingUsers(false));
  }, []);

  async function submit(body: Record<string, string>) {
    if (loading) return;
    setLoading(true); setError("");
    try {
      const response = await fetch("/api/auth/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo iniciar sesión.");
      window.location.replace(nextPath.startsWith("/") ? nextPath : "/");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo iniciar sesión.");
    } finally { setLoading(false); }
  }

  function handlePinLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedId) return setError("Selecciona tu nombre.");
    if (!/^\d{4,6}$/.test(pin)) return setError("El PIN debe tener entre 4 y 6 números.");
    void submit({ user_id: selectedId, pin });
  }

  function handleLegacyLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!password) return setError("Introduce la contraseña de administrador.");
    void submit({ password });
  }

  return <section className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl sm:p-7">
    <div className="mb-6 flex flex-col items-center text-center"><Logo size={54} /><h1 className="mt-4 text-2xl font-black text-white">¿Quién eres?</h1><p className="mt-1 text-sm text-zinc-400">Selecciona tu nombre e introduce tu PIN.</p></div>
    {loadingUsers ? <div className="flex min-h-40 items-center justify-center gap-2 text-zinc-400"><Loader2 className="animate-spin" /> Cargando empleados…</div> : users.length > 0 ? <form onSubmit={handlePinLogin} className="space-y-4">
      <label className="block"><span className="mb-2 block text-sm font-bold text-zinc-300">Empleado</span><div className="relative"><UserRound className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400" size={22} /><select value={selectedId} onChange={(event) => { setSelectedId(event.target.value); setError(""); }} className="min-h-16 w-full appearance-none rounded-2xl border border-zinc-700 bg-zinc-950 pl-12 pr-12 text-lg font-bold text-white outline-none focus:border-cyan-400">{users.map((user) => <option key={user.id} value={user.id}>{user.nombre}</option>)}</select><ChevronDown className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-zinc-500" /></div></label>
      <label className="block"><span className="mb-2 block text-sm font-bold text-zinc-300">PIN</span><div className="flex items-center gap-3 rounded-2xl border border-zinc-700 bg-zinc-950 px-4 focus-within:border-cyan-400"><Lock className="text-cyan-400" size={22} /><input value={pin} onChange={(event) => { setPin(event.target.value.replace(/\D/g, "").slice(0, 6)); setError(""); }} inputMode="numeric" type="password" autoComplete="current-password" autoFocus className="min-h-16 w-full bg-transparent text-center text-2xl font-black tracking-[0.35em] text-white outline-none" placeholder="••••" /></div></label>
      <button disabled={loading} className="flex min-h-16 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 text-lg font-black text-zinc-950 active:scale-[.98] disabled:opacity-60">{loading && <Loader2 className="animate-spin" />} Entrar</button>
    </form> : <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">{setupRequired ? "Todavía no hay empleados configurados. Entra como administrador para crear el primero." : "No hay empleados activos. Entra como administrador para activarlos."}</div>}
    {error && <div className="mt-4 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300"><AlertCircle className="mt-0.5 shrink-0" size={18} />{error}</div>}
    <details className="group mt-5 rounded-xl border border-zinc-700 bg-zinc-950/60"><summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 px-4 text-sm font-medium text-zinc-400 [&::-webkit-details-marker]:hidden"><Lock size={16} /> Acceso de administrador <span className="ml-auto group-open:rotate-180">▾</span></summary><form onSubmit={handleLegacyLogin} className="space-y-3 border-t border-zinc-800 p-4"><input value={password} onChange={(event) => { setPassword(event.target.value); setError(""); }} type="password" autoComplete="current-password" placeholder="Contraseña general" className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-900 px-4 text-white outline-none focus:border-red-500" /><button disabled={loading} className="min-h-12 w-full rounded-xl bg-red-600 font-bold text-white disabled:opacity-60">Entrar como administrador</button></form></details>
  </section>;
}

export default function LoginPage() {
  return <main className="flex min-h-dvh items-start justify-center overflow-y-auto bg-zinc-950 p-4 sm:items-center"><Suspense fallback={null}><LoginForm /></Suspense></main>;
}
