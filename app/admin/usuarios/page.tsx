"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Loader2, LockKeyhole, ShieldCheck, UnlockKeyhole, UserPlus, UsersRound } from "lucide-react";
import type { AppRole } from "@/lib/app-users";

type UserItem = { id: string; nombre: string; rol: AppRole; activo: boolean; bloqueado: boolean; intentos_pin_fallidos: number; bloqueado_at: string | null };

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<UserItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/users", { cache: "no-store" });
      const payload = await response.json() as { users?: UserItem[]; error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudieron cargar los usuarios.");
      setUsers(payload.users || []); setError("");
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudieron cargar los usuarios."); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void Promise.resolve().then(load); }, [load]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaving(true); setError(""); setSuccess("");
    const form = new FormData(event.currentTarget);
    const body = { ...(editing && { id: editing.id }), nombre: String(form.get("nombre") || ""), rol: String(form.get("rol") || "empleado"), activo: form.get("activo") === "on", pin: String(form.get("pin") || "") };
    try {
      const response = await fetch("/api/users", { method: editing ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo guardar el usuario.");
      setCreating(false); setEditing(null); setSuccess(editing ? "Usuario actualizado." : "Usuario creado. Ya puede entrar con su PIN."); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar el usuario."); }
    finally { setSaving(false); }
  }

  async function unlock(user: UserItem) {
    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: user.id, nombre: user.nombre, rol: user.rol, activo: user.activo, desbloquear: true }) });
      const payload = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo devolver el acceso.");
      setEditing(null); setSuccess(`${user.nombre} ya puede volver a entrar.`); await load();
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo devolver el acceso."); }
    finally { setSaving(false); }
  }

  const modalUser = editing || (creating ? { id: "", nombre: "", rol: "empleado" as AppRole, activo: true, bloqueado: false, intentos_pin_fallidos: 0, bloqueado_at: null } : null);
  return <main className="min-h-dvh bg-zinc-950 px-4 py-5 text-white">
    <div className="mx-auto max-w-3xl"><header className="mb-6 flex items-center justify-between gap-3"><div><h1 className="flex items-center gap-2 text-2xl font-black"><UsersRound className="text-cyan-400" /> Usuarios</h1><p className="mt-1 text-sm text-zinc-400">Empleados, administradores y PIN de acceso</p></div><Link href="/" className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-300"><ArrowLeft size={17} /> Inicio</Link></header>
      {error && <p className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}{success && <p className="mb-4 flex gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"><Check size={18} />{success}</p>}
      <section className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6"><p className="font-black text-amber-200">Permisos de Almacén Desguace</p><p className="mt-1 text-zinc-300"><strong>Empleado:</strong> consultar, registrar, fotografiar, ubicar, mover entre cajones y vender.</p><p className="text-zinc-300"><strong>Administrador:</strong> además puede editar o retirar piezas, borrar fotos, deshacer ventas, importar, publicar y cambiar estanterías o el plano.</p></section>
      <button onClick={() => setCreating(true)} className="mb-4 flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 font-black text-zinc-950"><UserPlus /> Añadir empleado</button>
      {loading ? <div className="flex justify-center py-16 text-zinc-400"><Loader2 className="animate-spin" /></div> : <div className="space-y-3">{users.map((user) => <article key={user.id} className={`rounded-2xl border p-3 ${user.bloqueado ? "border-red-500/40 bg-red-500/10" : "border-zinc-800 bg-zinc-900"}`}><button onClick={() => setEditing(user)} className="flex min-h-16 w-full items-center gap-3 text-left active:scale-[.99]"><span className={`rounded-xl p-2.5 ${user.bloqueado ? "bg-red-500/15 text-red-300" : user.rol === "administrador" ? "bg-amber-500/10 text-amber-300" : "bg-cyan-500/10 text-cyan-300"}`}>{user.bloqueado ? <LockKeyhole /> : <ShieldCheck />}</span><span className="min-w-0 flex-1"><strong className="block truncate text-lg">{user.nombre}</strong><span className="text-sm text-zinc-400">{user.bloqueado ? "Bloqueado por 4 PIN incorrectos" : user.rol === "administrador" ? "Administrador" : "Empleado"}</span></span><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.bloqueado ? "bg-red-500 text-white" : user.activo ? "bg-emerald-500/10 text-emerald-300" : "bg-zinc-800 text-zinc-500"}`}>{user.bloqueado ? "Bloqueado" : user.activo ? "Activo" : "Inactivo"}</span></button>{user.bloqueado && <button disabled={saving} onClick={() => void unlock(user)} className="mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-emerald-400 font-black text-zinc-950 disabled:opacity-50"><UnlockKeyhole size={19} /> Dar acceso de nuevo</button>}</article>)}</div>}
    </div>
    {modalUser && <div className="fixed inset-0 z-50 flex items-end bg-black/75 p-3 sm:items-center sm:justify-center"><form onSubmit={save} className="w-full max-w-md space-y-4 rounded-3xl border border-zinc-700 bg-zinc-900 p-5"><h2 className="text-xl font-black">{editing ? "Editar usuario" : "Nuevo empleado"}</h2><label className="block text-sm font-bold text-zinc-300">Nombre<input name="nombre" defaultValue={modalUser.nombre} required maxLength={100} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-base text-white outline-none focus:border-cyan-400" /></label><label className="block text-sm font-bold text-zinc-300">Permisos<select name="rol" defaultValue={modalUser.rol} className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white"><option value="empleado">Empleado · trabajo diario seguro</option><option value="administrador">Administrador · control completo</option></select><span className="mt-1.5 block text-xs font-normal leading-5 text-zinc-500">Da Administrador solo a quien deba borrar, importar, publicar o cambiar la organización del almacén.</span></label><label className="block text-sm font-bold text-zinc-300">{editing ? "Restablecer PIN (opcional)" : "PIN de 4 a 6 números"}<input name="pin" required={!editing} inputMode="numeric" pattern="[0-9]{4,6}" maxLength={6} type="password" className="mt-2 min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-center text-xl tracking-[.3em] text-white outline-none focus:border-cyan-400" />{editing && <span className="mt-1.5 block text-xs font-normal leading-5 text-zinc-500">Déjalo vacío para conservarlo. El administrador puede asignar uno nuevo sin conocer el anterior.</span>}</label>{editing && <label className="flex min-h-12 items-center gap-3 rounded-xl border border-zinc-700 px-4 font-bold"><input name="activo" type="checkbox" defaultChecked={modalUser.activo} className="h-5 w-5 accent-cyan-400" /> Usuario activo</label>} {!editing && <input type="hidden" name="activo" value="on" />}<div className="grid grid-cols-2 gap-3"><button type="button" onClick={() => { setCreating(false); setEditing(null); }} className="min-h-12 rounded-xl border border-zinc-700 font-bold text-zinc-300">Cancelar</button><button disabled={saving} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-400 font-black text-zinc-950 disabled:opacity-60">{saving && <Loader2 className="animate-spin" size={18} />} Guardar</button></div></form></div>}
  </main>;
}
