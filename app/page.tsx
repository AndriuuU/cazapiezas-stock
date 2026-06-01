"use client";

import Image from "next/image";

export default function Home() {
  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      <div className="max-w-md mx-auto p-4">

        <div className="flex justify-center mb-8">
          <Image
            src="/logo.png"
            alt="CAZAPIEZAS"
            width={180}
            height={180}
          />
        </div>

        <input
          className="
            w-full
            p-4
            rounded-xl
            bg-zinc-900
            border
            border-zinc-800
            text-lg
          "
          placeholder="Escanea código de barras"
        />

      </div>

    </main>
  );
}