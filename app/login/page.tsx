"use client";

import { FormEvent, Suspense, useCallback, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  AlertCircle,
  Keyboard,
  Lock,
  Loader2,
} from "lucide-react";
import Logo from "@/components/Logo";
import Scanner from "@/components/Scanner";

function LoginForm() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const nextPath = searchParams.get("next") || "/";

  const login = useCallback(
    async (credential: string) => {
      const normalizedCredential = credential.trim();

      if (loading) return;
      if (!normalizedCredential) {
        setError("Introduce la contraseña.");
        return;
      }

      setLoading(true);
      setError("");

      try {
        const response = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: normalizedCredential }),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          throw new Error(data.error || "No se pudo iniciar sesión.");
        }

        const destination = nextPath.startsWith("/") ? nextPath : "/";
        window.location.replace(destination);
      } catch (loginError) {
        setError(
          loginError instanceof Error ? loginError.message : "Error desconocido"
        );
      } finally {
        setLoading(false);
      }
    },
    [loading, nextPath]
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    void login(String(formData.get("password") || ""));
  };

  const handleScan = useCallback(
    (credential: string) => void login(credential),
    [login]
  );

  return (
    <section className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6 shadow-2xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <Logo size={54} />
        <h1 className="mt-5 text-2xl font-bold text-white">Acceso al taller</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Escanea el código de barras.
        </p>
      </div>

      <div className="space-y-4">
        <Scanner
          onScan={handleScan}
          onError={setError}
          concealResult
          stopAfterScan
          idleMessage="Pulsa para activar la cámara y escanea tu código de acceso."
          activeMessage="Escaneo activo - Apunta al código de barras o QR"
        />

        {loading && (
          <div className="flex items-center justify-center gap-2 rounded-xl bg-zinc-800 p-3 text-sm text-zinc-200">
            <Loader2 className="h-5 w-5 animate-spin" />
            Comprobando acceso...
          </div>
        )}

      </div>

      <details className="group mt-5 rounded-xl border border-zinc-700 bg-zinc-950/60 open:border-zinc-600">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-center gap-2 px-4 text-sm font-medium text-zinc-300 select-none [&::-webkit-details-marker]:hidden">
          <Keyboard className="h-4 w-4" />
          Introducir clave manualmente
          <span className="ml-auto text-zinc-500 transition-transform group-open:rotate-180">
            ▾
          </span>
        </summary>

        <form
          onSubmit={handleSubmit}
          className="space-y-4 border-t border-zinc-800 p-4"
        >
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-zinc-300">
              Contraseña
            </span>
            <div className="flex items-center gap-2 rounded-xl border border-zinc-700 bg-zinc-950 px-3 focus-within:border-red-500">
              <Lock className="h-5 w-5 text-zinc-500" />
              <input
                name="password"
                type="password"
                onChange={() => setError("")}
                autoComplete="current-password"
                autoCapitalize="none"
                spellCheck={false}
                className="min-h-12 w-full bg-transparent text-white outline-none placeholder:text-zinc-600"
                placeholder="Clave de acceso"
              />
            </div>
          </label>

          <button
            type="submit"
            disabled={loading}
            className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading && <Loader2 className="h-5 w-5 animate-spin" />}
            Entrar
          </button>
        </form>
      </details>

      {error && (
        <div className="mt-4 flex gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
          <AlertCircle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <p className="mt-5 text-center text-xs leading-relaxed text-zinc-500">
        El contenido escaneado nunca se muestra ni se guarda en este dispositivo.
      </p>
    </section>
  );
}

export default function LoginPage() {
  return (
    <main className="flex min-h-dvh items-start justify-center overflow-y-auto bg-zinc-950 p-4 sm:items-center">
      <Suspense fallback={null}>
        <LoginForm />
      </Suspense>
    </main>
  );
}
