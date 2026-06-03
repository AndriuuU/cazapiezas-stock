"use client";

import Image from "next/image";

interface LogoProps {
  className?: string;
  iconOnly?: boolean;
  size?: number;
}

export default function Logo({ className = "", iconOnly = false, size = 40 }: LogoProps) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      {/* Tu logotipo PNG real */}
      <div 
        className="relative flex items-center justify-center overflow-hidden rounded-xl"
        style={{ width: size, height: size }}
      >
        <Image
          src="/logo.png" // Apunta directamente a public/logo.png
          alt="Cazapiezas Logo"
          width={size}
          height={size}
          className="object-contain"
          priority // Fuerza a que cargue de inmediato sin retardo
        />
      </div>

      {/* Texto al lado del logo (Opcional, se oculta si iconOnly es true) */}
      {!iconOnly && (
        <span className="font-sans font-black tracking-tighter text-xl text-white uppercase">
          CAZA<span className="text-red-500">PIEZAS</span>
          <span className="text-xs font-mono font-light tracking-widest text-zinc-500 block -mt-1">
            STOCK MANAGER
          </span>
        </span>
      )}
    </div>
  );
}