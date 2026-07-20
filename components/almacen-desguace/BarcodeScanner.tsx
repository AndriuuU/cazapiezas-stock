"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Camera, Keyboard, Loader2, ScanBarcode, X } from "lucide-react";

type DetectedBarcode = { rawValue: string };
type BarcodeDetectorInstance = { detect: (source: CanvasImageSource) => Promise<DetectedBarcode[]> };
type BarcodeDetectorConstructor = new (options?: { formats?: string[] }) => BarcodeDetectorInstance;

export default function BarcodeScanner({ onScan, onClose }: { onScan: (value: string) => void; onClose: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const lastDetectionRef = useRef(0);
  const [manualCode, setManualCode] = useState("");
  const [cameraStarting, setCameraStarting] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [error, setError] = useState("");

  function stopCamera() {
    scanningRef.current = false;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  useEffect(() => () => stopCamera(), []);

  function finish(value: string) {
    const normalized = value.trim();
    if (!normalized) return;
    stopCamera();
    onScan(normalized);
  }

  async function startCamera() {
    setCameraStarting(true);
    setError("");
    try {
      const Detector = (window as typeof window & { BarcodeDetector?: BarcodeDetectorConstructor }).BarcodeDetector;
      if (!Detector) throw new Error("Este navegador no permite leer códigos con la cámara. Puedes usar un lector USB/Bluetooth o escribir la referencia.");
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false });
      streamRef.current = stream;
      const video = videoRef.current;
      if (!video) throw new Error("No se pudo iniciar la vista de la cámara.");
      video.srcObject = stream;
      await video.play();
      setCameraActive(true);
      scanningRef.current = true;
      const detector = new Detector({ formats: ["code_128", "code_39", "ean_13", "ean_8", "upc_a", "upc_e", "itf", "codabar", "qr_code"] });
      const scanFrame = async (time: number) => {
        if (!scanningRef.current) return;
        if (time - lastDetectionRef.current > 220 && video.readyState >= 2) {
          lastDetectionRef.current = time;
          try {
            const results = await detector.detect(video);
            if (results[0]?.rawValue) { finish(results[0].rawValue); return; }
          } catch { /* La cámara puede cambiar de fotograma mientras se analiza. */ }
        }
        requestAnimationFrame(scanFrame);
      };
      requestAnimationFrame(scanFrame);
    } catch (caught) {
      stopCamera();
      setError(caught instanceof Error ? caught.message : "No se pudo acceder a la cámara.");
    } finally { setCameraStarting(false); }
  }

  function submitManual(event: FormEvent) {
    event.preventDefault();
    finish(manualCode);
  }

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-3 backdrop-blur-sm" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div role="dialog" aria-modal="true" aria-labelledby="barcode-scanner-title" className="w-full max-w-lg overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950 shadow-2xl">
      <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-3"><div><h2 id="barcode-scanner-title" className="flex items-center gap-2 font-bold text-white"><ScanBarcode className="text-cyan-400" /> Escanear referencia</h2><p className="mt-0.5 text-xs text-zinc-500">Busca la pieza mediante el código de barras.</p></div><button onClick={onClose} title="Cerrar" className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-white"><X /></button></div>
      <div className="space-y-4 p-4">
        <section className="overflow-hidden rounded-xl border border-zinc-800 bg-black">
          <div className="relative flex aspect-video items-center justify-center">
            <video ref={videoRef} muted playsInline className={`h-full w-full object-cover ${cameraActive ? "block" : "hidden"}`} />
            {cameraActive ? <div className="pointer-events-none absolute inset-[18%] rounded-xl border-2 border-cyan-400 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]"><span className="absolute -bottom-7 left-0 right-0 text-center text-xs text-white">Centra el código dentro del recuadro</span></div> : <div className="px-6 text-center"><Camera className="mx-auto text-zinc-700" size={42} /><p className="mt-2 text-sm text-zinc-400">Usar la cámara del móvil</p><button disabled={cameraStarting} onClick={() => void startCamera()} className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-bold text-zinc-950 hover:bg-cyan-400 disabled:opacity-50">{cameraStarting ? <Loader2 className="animate-spin" size={17} /> : <ScanBarcode size={18} />} Activar cámara</button></div>}
          </div>
        </section>
        {error && <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">{error}</p>}
        <div className="flex items-center gap-3 text-xs text-zinc-600"><span className="h-px flex-1 bg-zinc-800" />O USA UN LECTOR<span className="h-px flex-1 bg-zinc-800" /></div>
        <form onSubmit={submitManual} className="space-y-2"><label className="flex items-center gap-2 text-sm font-semibold text-zinc-300"><Keyboard size={17} className="text-amber-400" /> Lector USB/Bluetooth o escritura manual</label><div className="flex gap-2"><input autoFocus value={manualCode} onChange={(event) => setManualCode(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); finish(event.currentTarget.value); } }} placeholder="Escanea o escribe la referencia" className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-3 font-mono text-white focus:border-amber-500 focus:outline-none" /><button disabled={!manualCode.trim()} className="rounded-xl bg-amber-500 px-4 font-bold text-zinc-950 hover:bg-amber-400 disabled:opacity-40">Buscar</button></div><p className="text-xs text-zinc-600">Los lectores físicos normalmente escriben el código y pulsan Enter automáticamente.</p></form>
      </div>
    </div>
  </div>;
}
