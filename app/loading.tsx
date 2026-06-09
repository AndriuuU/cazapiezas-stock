import Logo from "@/components/Logo";

export default function Loading() {
  return (
    <main className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <Logo size={72} />
        <div className="h-8 w-8 rounded-full border-2 border-red-500 border-t-transparent animate-spin" />
        <p className="text-sm text-zinc-400">Cargando Cazapiezas STOCK...</p>
      </div>
    </main>
  );
}
