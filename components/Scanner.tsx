"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BrowserMultiFormatReader,
  type IScannerControls,
} from "@zxing/browser";
import { AlertCircle, Camera, Loader2 } from "lucide-react";

interface ScannerProps {
  onScan: (code: string) => void;
  onError?: (error: string) => void;
}

type CameraStatus = "idle" | "loading" | "granted" | "denied";

function getCameraErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (error.message === "SecureContextError") {
      return "El navegador bloqueo la camara por seguridad. Requiere HTTPS o localhost.";
    }

    if (
      error.name === "NotFoundError" ||
      error.message === "NotFoundError" ||
      error.message.includes("Requested device")
    ) {
      return "No se ha detectado ninguna camara en este dispositivo.";
    }
  }

  return "No se puede acceder a la camara. Verifica los permisos en tu navegador.";
}

export default function Scanner({ onScan, onError }: ScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const codeReaderRef = useRef<BrowserMultiFormatReader | null>(null);
  const lastScanTimeRef = useRef(0);
  const lastScannedCodeRef = useRef("");

  const [isScanning, setIsScanning] = useState(false);
  const [cameraStatus, setCameraStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState("");
  const [lastScannedCode, setLastScannedCode] = useState("");

  const stopCamera = useCallback(() => {
    controlsRef.current?.stop();
    controlsRef.current = null;

    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setCameraStatus((current) => (current === "denied" ? current : "idle"));
  }, []);

  const playBeep = useCallback(() => {
    try {
      const AudioContextClass =
        window.AudioContext ||
        (window as Window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AudioContextClass) {
        return;
      }

      const audioContext = new AudioContextClass();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800;
      oscillator.type = "sine";

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(
        0.01,
        audioContext.currentTime + 0.1
      );

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    } catch {
      // Beep opcional.
    }
  }, []);

  const startCamera = useCallback(async () => {
    try {
      setCameraStatus("loading");
      setError("");

      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        throw new Error("SecureContextError");
      }

      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );

      if (videoDevices.length === 0) {
        throw new Error("NotFoundError");
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });

      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      if (!codeReaderRef.current) {
        codeReaderRef.current = new BrowserMultiFormatReader();
      }

      if (videoRef.current && codeReaderRef.current) {
        controlsRef.current = await codeReaderRef.current.decodeFromVideoElement(
          videoRef.current,
          (result) => {
            if (!result) {
              return;
            }

            const scannedCode = result.getText();
            const now = Date.now();

            if (
              scannedCode !== lastScannedCodeRef.current ||
              now - lastScanTimeRef.current > 1000
            ) {
              lastScanTimeRef.current = now;
              lastScannedCodeRef.current = scannedCode;
              setLastScannedCode(scannedCode);
              playBeep();
              onScan(scannedCode);
            }
          }
        );
      }

      setIsScanning(true);
      setCameraStatus("granted");
    } catch (err) {
      const message = getCameraErrorMessage(err);

      stopCamera();
      setCameraStatus("denied");
      setError(message);
      onError?.(message);
    }
  }, [onError, onScan, playBeep, stopCamera]);

  const handleToggleScanner = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();

    if (isScanning || cameraStatus === "loading") {
      stopCamera();
      return;
    }

    void startCamera();
  };

  useEffect(() => {
    return () => stopCamera();
  }, [stopCamera]);

  return (
    <div className="space-y-4">
      <div className="relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden aspect-video">
        {cameraStatus === "idle" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900">
            <div className="text-center px-6">
              <Camera className="w-10 h-10 text-zinc-500 mx-auto mb-3" />
              <p className="text-zinc-400 text-sm">
                Pulsa iniciar escaneo para activar la camara.
              </p>
            </div>
          </div>
        )}

        {cameraStatus === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-zinc-900/80 backdrop-blur">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-red-400 animate-spin mx-auto mb-2" />
              <p className="text-zinc-400 text-sm">Accediendo a la camara...</p>
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

        {lastScannedCode && (
          <div className="absolute top-4 left-4 right-4 bg-black/70 backdrop-blur text-red-300 px-3 py-2 rounded-lg text-sm font-mono">
            {lastScannedCode}
          </div>
        )}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleToggleScanner}
          className={`flex-1 py-3 px-4 rounded-xl font-medium flex items-center justify-center gap-2 transition-all ${
            isScanning || cameraStatus === "loading"
              ? "bg-red-500 hover:bg-red-600 text-white shadow-lg shadow-red-500/50"
              : "bg-gradient-to-r from-red-500 to-red-800 hover:shadow-lg hover:shadow-red-500/50 text-white"
          }`}
        >
          {cameraStatus === "loading" ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Camera className="w-5 h-5" />
          )}
          {isScanning || cameraStatus === "loading"
            ? "Detener escaneo"
            : "Iniciar escaneo"}
        </button>
      </div>

      {error && (
        <div className="bg-amber-900/20 border border-amber-800 rounded-xl p-3 flex gap-2">
          <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-amber-300 text-sm">{error}</p>
        </div>
      )}

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-3">
        <p className="text-xs text-zinc-400">
          {isScanning
            ? "Escaneo activo - Apunta el codigo de barras a la camara"
            : "Escaneo inactivo - Presiona el boton para comenzar"}
        </p>
      </div>
    </div>
  );
}
