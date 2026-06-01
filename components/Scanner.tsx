"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader, Result } from "@zxing/browser";
import { Loader } from "lucide-react";

interface ScannerProps {
  onScan: (barcode: string) => void;
  isActive: boolean;
}

export default function Scanner({ onScan, isActive }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const readerRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanTimeRef = useRef<number>(0);

  useEffect(() => {
    if (!isActive || !videoRef.current) {
      return;
    }

    let isMounted = true;
    const reader = new BrowserMultiFormatReader();
    readerRef.current = reader;

    const initScanner = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Usar decodeFromVideoDevice que automáticamente usa la cámara
        const result = await reader.decodeFromVideoDevice(
          undefined, // deviceId - undefined usa la cámara por defecto
          videoRef.current!,
          (result: Result | null, err: Error | null) => {
            if (result && isMounted) {
              const barcode = result.getText();
              const now = Date.now();

              // Prevenir escaneos duplicados en 1 segundo
              if (now - lastScanTimeRef.current > 1000) {
                lastScanTimeRef.current = now;
                onScan(barcode);
              }
            }

            // No mostrar errores de "no barcode found" - son normales
            if (err && !err.message?.includes("not found") && isMounted) {
              console.warn("Scan error:", err.message);
            }
          }
        );

        if (isMounted) {
          setIsLoading(false);
        }
      } catch (err) {
        console.error("Scanner initialization error:", err);

        if (isMounted) {
          const errorMsg = err instanceof Error ? err.message : String(err);

          if (errorMsg.includes("Permission denied") || errorMsg.includes("NotAllowedError")) {
            setError("Permiso de cámara denegado. Verifica los permisos del navegador.");
          } else if (
            errorMsg.includes("not found") ||
            errorMsg.includes("NotFoundError")
          ) {
            setError("No se encontró cámara en este dispositivo");
          } else if (errorMsg.includes("not supported")) {
            setError("Tu navegador no soporta acceso a cámara");
          } else {
            setError(errorMsg || "Error al inicializar la cámara");
          }
          setIsLoading(false);
        }
      }
    };

    initScanner();

    return () => {
      isMounted = false;
      try {
        if (videoRef.current && videoRef.current.srcObject) {
          const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
          tracks.forEach((track) => track.stop());
          videoRef.current.srcObject = null;
        }
      } catch (err) {
        console.error("Cleanup error:", err);
      }
    };
  }, [isActive, onScan]);

  if (!isActive) {
    return null;
  }

  return (
    <div className="relative w-full bg-black rounded-2xl overflow-hidden">
      {/* Video Stream */}
      <video
        ref={videoRef}
        className="w-full aspect-video object-cover"
        style={{ transform: "scaleX(-1)" }}
      />

      {/* Scanning Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-48 h-48 border-2 border-cyan-400 rounded-xl shadow-lg shadow-cyan-400/50 animate-pulse" />
      </div>

      {/* Corner accents */}
      <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-cyan-400" />
      <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-cyan-400" />
      <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-cyan-400" />
      <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-cyan-400" />

      {/* Loading State */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
          <div className="flex flex-col items-center gap-3">
            <Loader className="w-8 h-8 text-cyan-400 animate-spin" />
            <p className="text-cyan-400 text-sm font-medium">
              Inicializando cámara...
            </p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4">
          <div className="text-center">
            <p className="text-red-400 font-medium mb-2">Error</p>
            <p className="text-gray-300 text-sm">{error}</p>
          </div>
        </div>
      )}

      {/* Hint Text */}
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
        <p className="text-white text-xs font-medium text-center px-3 py-1 bg-black/50 rounded-full backdrop-blur">
          Apunta al código de barras
        </p>
      </div>
    </div>
  );
}