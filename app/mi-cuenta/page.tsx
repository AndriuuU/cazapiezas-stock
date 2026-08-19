"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, KeyRound, Loader2, ShieldCheck, UserRound } from "lucide-react";
import { useCurrentUser } from "@/components/auth/useCurrentUser";

export default function MyAccountPage() {
  const user = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function changePin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const currentPin = String(form.get("current_pin") || "");
    const newPin = String(form.get("new_pin") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (newPin !== confirmation) {
      setError("La repetición no coincide con el nuevo PIN.");
      setSuccess("");
      return;
    }

    setSaving(true); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/auth/pin", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_pin: currentPin, new_pin: newPin }),
      });
      const payload = await response.json() as { error?: string; message?: string };
      if (!response.ok) throw new Error(payload.error || "No se pudo cambiar el PIN.");
      formElement.reset();
      setSuccess(payload.message || "Tu PIN se ha cambiado correctamente.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "No se pudo cambiar el PIN.");
    } finally { setSaving(false); }
  }

  return <main className="min-h-dvh bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 px-4 py-5 text-white">
    <div className="mx-auto max-w-lg">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div><h1 className="flex items-center gap-2 text-2xl font-black"><UserRound className="text-cyan-400" /> Mi cuenta</h1><p className="mt-1 text-sm text-zinc-400">Tus datos y PIN de acceso</p></div>
        <Link href="/" className="flex min-h-11 items-center gap-2 rounded-xl border border-zinc-700 px-3 text-sm font-bold text-zinc-300"><ArrowLeft size={17} /> Inicio</Link>
      </header>

      <section className="mb-5 flex items-center gap-3 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
        <span className="rounded-xl bg-cyan-500/10 p-3 text-cyan-300"><ShieldCheck /></span>
        <div><p className="text-lg font-black">{user?.nombre || "Cargando…"}</p><p className="text-sm text-zinc-500">{user?.rol === "administrador" ? "Administrador" : "Empleado"}</p></div>
      </section>

      {error && <p role="alert" className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-semibold text-red-200">{error}</p>}
      {success && <p className="mb-4 flex gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm font-semibold text-emerald-200"><CheckCircle2 size={19} className="shrink-0" />{success}</p>}

      <form onSubmit={changePin} className="space-y-4 rounded-3xl border border-zinc-800 bg-zinc-900 p-5 shadow-2xl">
        <div><h2 className="flex items-center gap-2 text-xl font-black"><KeyRound className="text-amber-300" /> Cambiar mi PIN</h2><p className="mt-1 text-sm leading-6 text-zinc-500">Elige entre 4 y 6 números. El administrador podrá restablecerlo si lo olvidas.</p></div>
        <PinField name="current_pin" label="PIN actual" autoComplete="current-password" />
        <PinField name="new_pin" label="Nuevo PIN" autoComplete="new-password" />
        <PinField name="confirmation" label="Repite el nuevo PIN" autoComplete="new-password" />
        <button disabled={saving || !user} className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-cyan-400 font-black text-zinc-950 disabled:opacity-50">{saving ? <Loader2 className="animate-spin" /> : <KeyRound />} Guardar nuevo PIN</button>
      </form>
    </div>
  </main>;
}

function PinField({ name, label, autoComplete }: { name: string; label: string; autoComplete: string }) {
  return <label className="block text-sm font-bold text-zinc-300">{label}<input name={name} required type="password" inputMode="numeric" pattern="[0-9]{4,6}" minLength={4} maxLength={6} autoComplete={autoComplete} className="mt-2 min-h-14 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-center text-2xl tracking-[.35em] text-white outline-none focus:border-cyan-400" /></label>;
}
