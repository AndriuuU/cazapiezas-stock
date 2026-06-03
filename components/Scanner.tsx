"use client";

import { useEffect, useRef, useState } from "react";
import { BrowserMultiFormatReader } from "@zxing/browser";
import { Camera, AlertCircle, Loader2 } from "lucide-react";

interface ScannerProps {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
}

export default function Scanner({ onScan, onError }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState("");
  const [cameraPermission, setCameraPermission] = useState<"granted" | "denied" | "pending">("pending");
  const [lastScannedCode, setLastScannedCode] = useState("");
  // Guardamos el tiempo usando useRef para que no reinicie el escáner al cambiar
  const lastScanTimeRef = useRef(0);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);

  // Inicializar el lector de códigos de barras
  useEffect(() => {
    const initScanner = async () => {
      try {
        codeReaderRef.current = new BrowserMultiFormatReader();
        
        // Comprobación de seguridad (Secure Context) para móviles HTTP
        if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
          throw new Error("SecureContextError");
        }

        // 1. Opcional pero recomendado: Comprobar si hay cámaras disponibles primero
        const devices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = devices.filter(device => device.kind === 'videoinput');
        
        if (videoDevices.length === 0) {
          throw new Error("NotFoundError");
        }

        // 2. Solicitar permiso de cámara
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment", // Intenta usar cámara trasera
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });

        if (videoRef.current && stream) {
          videoRef.current.srcObject = stream;
          setCameraPermission("granted");
          setError("");
        }
      } catch (err: any) {
        if (err.message === "SecureContextError") {
          setCameraPermission("denied");
          setError("El navegador bloqueó la cámara por seguridad (requiere HTTPS o localhost).");
        } else if (err.name === 'NotFoundError' || err.message === 'NotFoundError' || err.message.includes('Requested device')) {
          setCameraPermission("denied");
          setError("No se ha detectado ninguna cámara en este dispositivo. (¿Estás en un PC de escritorio?)");
        } else {
          console.error("Camera error:", err);
          setCameraPermission("denied");
          setError("No se puede acceder a la cámara. Verifica los permisos en tu navegador.");
        }
        
        if (onError) {
          onError("Error de cámara: " + (err.name || "Desconocido"));
        }
      }
    };

    initScanner();

    return () => {
      // Limpiar stream al desmontar
      if (videoRef.current?.srcObject) {
        const tracks = (videoRef.current.srcObject as MediaStream).getTracks();
        tracks.forEach((track) => track.stop());
      }
    };
  }, [onError]);

  // Iniciar/detener escaneo
  useEffect(() => {
    let controls: any = null;

    if (!isScanning || cameraPermission !== "granted" || !videoRef.current) {
      return;
    }

    const startScanning = async () => {
      const reader = codeReaderRef.current;
      if (!reader || !videoRef.current) return;

      try {
        controls = await reader.decodeFromVideoElement(
          videoRef.current,
          (result, error) => {
            if (result) {
              const scannedCode = result.getText();
              const now = Date.now();

              // Comprobamos la última vez que se escaneó usando la referencia
              if (scannedCode !== lastScannedCode || now - lastScanTimeRef.current > 1000) {
                lastScanTimeRef.current = now;
                setLastScannedCode(scannedCode);
                playBeep();
                onScan(scannedCode);
              }
            }
          }
        );
      } catch (err) {
        // Ignoramos errores de inicialización
      }
    };

    startScanning();

    return () => {
      if (controls && typeof controls.stop === "function") {
        controls.stop();
      }
    };
  }, [isScanning, cameraPermission, onScan, lastScannedCode]); // Lógica limpia y sin duplicados

  // Reproducir sonido de beep
  const playBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // Frecuencia en Hz
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch (err) {
      // Silenciar
    }
  };

  if (cameraPermission === "denied") {
    return (
      <div className="bg-red-900/20 border border-red-800 rounded-2xl p-6 mb-8">
        <div className="flex gap-3">
          <AlertCircle className="w-6 h-6 text-red-400 flex-shrink-0" />
          <div>
            <h3 className="text-red-400 font-bold mb-2">Cámara Deshabilitada</h3>
            <p className="text-red-300 text-sm mb-4">
              Este navegador no tiene acceso a la cámara. Verifica que:
            </p>
            <ul className="text-red-300 text-sm space-y-1 list-disc list-inside">
              <li>Has dado permiso de cámara al navegador</li>
              <li>Otra aplicación no está usando la cámara</li>
              <li>La URL es HTTPS (obligatorio en móviles)</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video */}
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden aspect-video">
        {cameraPermission === "pending" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-red-400 animate-spin mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">Accediendo a la cámara...</p>
            </div>
          </div>
        )}

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="w-full h-full object-cover"
        />

        {/* Overlay Animado */}
        {isScanning && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute w-full h-1 bg-gradient-to-r from-transparent via-red-500 to-transparent top-1/2 -translate-y-1/2 animate-pulse" />
            <div className="absolute inset-4 border-2 border-red-400 rounded-lg" />
            <div className="absolute inset-8 border border-red-400/50 rounded-lg" />
            <div className="absolute top-4 left-4 w-8 h-8 border-t-2 border-l-2 border-red-400" />
            <div className="absolute top-4 right-4 w-8 h-8 border-t-2 border-r-2 border-red-400" />
            <div className="absolute bottom-4 left-4 w-8 h-8 border-b-2 border-l-2 border-red-400" />
            <div className="absolute bottom-4 right-4 w-8 h-8 border-b-2 border-r-2 border-red-400" />
          </div>
        )}

        {/* Feedback visual */}
        {lastScannedCode && (
          <div className="absolute top-4 left-4 right-4 bg-black/70 backdrop-blur text-red-300 px-3 py-2 rounded-lg text-sm font-mono">
            ✓ {lastScannedCode}
          </div>
        )}
      </div>

      {/* Controles */}
      <div className="flex gap-3">
        <button
          onClick={() => setIsScanning(!isScanning)}
          disabled={cameraPermission !== "granted"}
          className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            isScanning
              ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50"
              : "bg-gradient-to-r from-red-500 to-red-800 hover:shadow-lg hover:shadow-red-500/50 text-white"
          } ${
            cameraPermission !== "granted" ? "opacity-50 cursor-not-allowed" : ""
          }`}
        >
          <Camera className="w-5 h-5" />
          {isScanning ? "Detener escaneo" : "Iniciar escaneo"}
        </button>
      </div>

      {/* Info extra */}
      {error && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-3 flex gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
        <p className="text-xs text-zinc-400">
          {isScanning
            ? "🟢 Escaneo activo - Apunta el código de barras a la cámara"
            : "🔴 Escaneo inactivo - Presiona el botón para comenzar"}
        </p>
      </div>
    </div>
  );
}