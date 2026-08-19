"use client";

import { useEffect, useState } from "react";
import { UserRound } from "lucide-react";
import type { AppUser } from "@/lib/app-users";

export function useActionActors(currentUser: AppUser | null) {
  const [adminUsers, setAdminUsers] = useState<AppUser[] | null>(null);
  useEffect(() => {
    if (currentUser?.rol !== "administrador") return;
    let active = true;
    void fetch("/api/auth/users", { cache: "no-store" }).then(async (response) => {
      const payload = await response.json() as { users?: AppUser[] };
      if (active) setAdminUsers(payload.users || []);
    }).catch(() => { if (active) setAdminUsers([]); });
    return () => { active = false; };
  }, [currentUser]);
  return {
    users: currentUser?.rol === "administrador" ? adminUsers || [] : currentUser ? [currentUser] : [],
    loading: currentUser?.rol === "administrador" && adminUsers === null,
  };
}

export function ActionActorSelect({ currentUser, users, loading, value, onChange, label = "Quién realiza la acción" }: { currentUser: AppUser | null; users: AppUser[]; loading: boolean; value: string; onChange: (id: string) => void; label?: string }) {
  if (currentUser?.rol !== "administrador") return <div className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 flex items-center gap-2 font-bold text-white"><UserRound size={17} className="text-cyan-300" />{currentUser?.nombre || "Usuario conectado"}</p></div>;
  return <label className="block"><span className="mb-2 flex items-center gap-2 text-sm font-bold text-zinc-300"><UserRound size={17} className="text-amber-300" />{label}</span><select required value={value} disabled={loading} onChange={(event) => onChange(event.target.value)} className="min-h-12 w-full rounded-xl border border-amber-500/40 bg-zinc-900 px-3 text-white outline-none focus:border-amber-400 disabled:opacity-50"><option value="">{loading ? "Cargando empleados…" : "Selecciona un empleado"}</option>{users.map((user) => <option key={user.id} value={user.id}>{user.nombre}{user.rol === "administrador" ? " · Administrador" : ""}</option>)}</select><span className="mt-1.5 block text-xs text-amber-200/70">La operación quedará guardada a nombre de esta persona.</span></label>;
}
