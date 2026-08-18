"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, FileSpreadsheet, Loader2, PackagePlus, Search, Upload } from "lucide-react";

type Preview = {
  total: number; validas: number; invalidas: number; stock: number;
  muestra: Array<{ referencia: string | null; descripcion: string | null; marca: string | null; cantidad: number | null; precio: number | null }>;
};
type Result = { insertadas: number; actualizadas: number; ids: number[] };
type ApiResponse = { preview?: Preview; result?: Result; piece?: { base: { nombre_pieza?: string | null; referencia_principal?: string | null; marca_pieza?: string | null; cantidad?: number | null; precio_venta?: number | null } }; error?: string };

export default function IamImporter() {
  const [file, setFile] = useState<File | null>(null);
  const [csvPreview, setCsvPreview] = useState<Preview | null>(null);
  const [code, setCode] = useState("");
  const [apiData, setApiData] = useState<ApiResponse | null>(null);
  const [manual, setManual] = useState({ referencia: "", referencia2: "", referencia3: "", descripcion: "", marca: "", stock: "1", precio: "", importe_casco: "0", publicado_online: true });
  const [busy, setBusy] = useState<"manual" | "csv-preview" | "csv-import" | "api-preview" | "api-import" | "">("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function sendCsv(action: "preview" | "import") {
    if (!file) return setError("Selecciona primero el fichero CSV de IAM.");
    setBusy(action === "preview" ? "csv-preview" : "csv-import"); setError(""); setSuccess("");
    try {
      const body = new FormData(); body.set("file", file); body.set("action", action);
      const response = await fetch("/api/almacen-desguace/iam/importar", { method: "POST", body });
      const data = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(data.error || "No se pudo leer el CSV IAM.");
      if (data.preview) setCsvPreview(data.preview);
      if (data.result) setSuccess(message(data.result));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo importar el CSV."); }
    finally { setBusy(""); }
  }

  async function sendApi(action: "preview" | "import") {
    setBusy(action === "preview" ? "api-preview" : "api-import"); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/almacen-desguace/iam/importar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ codigo: code, action }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(data.error || "No se pudo consultar la pieza IAM.");
      setApiData(data);
      if (data.result) setSuccess(message(data.result));
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo consultar Recambio Fácil."); }
    finally { setBusy(""); }
  }

  async function saveManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy("manual"); setError(""); setSuccess("");
    try {
      const response = await fetch("/api/almacen-desguace/iam/importar", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "manual", ...manual, stock: Number(manual.stock), precio: Number(manual.precio), importe_casco: Number(manual.importe_casco) }),
      });
      const data = await response.json() as ApiResponse;
      if (!response.ok) throw new Error(data.error || "No se pudo guardar la pieza IAM.");
      if (data.result) setSuccess(message(data.result));
      setManual({ referencia: "", referencia2: "", referencia3: "", descripcion: "", marca: "", stock: "1", precio: "", importe_casco: "0", publicado_online: true });
    } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar la pieza IAM."); }
    finally { setBusy(""); }
  }

  return <div className="space-y-5">
    {error && <div role="alert" className="rounded-2xl border border-red-500/40 bg-red-500/10 p-4 font-semibold text-red-100">{error}</div>}
    {success && <div role="status" className="flex items-start gap-3 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 font-semibold text-emerald-100"><CheckCircle2 className="shrink-0 text-emerald-400" /> <span>{success} <Link href="/almacen-desguace?tipo_pieza=IAM" className="ml-1 underline">Ver piezas IAM</Link></span></div>}

    <section className="rounded-2xl border border-violet-500/25 bg-zinc-900 p-5">
      <div className="flex items-start gap-3"><PackagePlus className="mt-1 shrink-0 text-violet-400" /><div><h2 className="text-xl font-black text-white">Añadir una pieza IAM manualmente</h2><p className="mt-1 text-sm text-zinc-400">Úsalo si la pieza ya está en Recambio Fácil pero no tienes su código interno.</p></div></div>
      <form onSubmit={saveManual} className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ManualField label="Referencia IAM equivalente" required value={manual.referencia} onChange={(value) => setManual((current) => ({ ...current, referencia: value }))} placeholder="9135R9" />
        <ManualField label="Referencia alternativa 1" value={manual.referencia2} onChange={(value) => setManual((current) => ({ ...current, referencia2: value }))} placeholder="EZCPE000" />
        <ManualField label="Referencia alternativa 2" value={manual.referencia3} onChange={(value) => setManual((current) => ({ ...current, referencia3: value }))} placeholder="E4V9" />
        <div className="sm:col-span-2"><ManualField label="Descripción" required value={manual.descripcion} onChange={(value) => setManual((current) => ({ ...current, descripcion: value }))} placeholder="CERRADURA DE PUERTA DELANTERA IZQUIERDA" /></div>
        <ManualField label="Marca IAM equivalente" required value={manual.marca} onChange={(value) => setManual((current) => ({ ...current, marca: value }))} placeholder="MOTOTO PARTS" />
        <ManualField label="Importe de venta (€)" required type="number" min="0" step="0.01" value={manual.precio} onChange={(value) => setManual((current) => ({ ...current, precio: value }))} placeholder="15,00" />
        <ManualField label="Importe casco (€)" required type="number" min="0" step="0.01" value={manual.importe_casco} onChange={(value) => setManual((current) => ({ ...current, importe_casco: value }))} />
        <ManualField label="Stock" required type="number" min="0" step="1" value={manual.stock} onChange={(value) => setManual((current) => ({ ...current, stock: value }))} />
        <label className="flex min-h-12 items-center gap-3 self-end rounded-xl border border-zinc-700 bg-zinc-950 px-4 font-bold text-zinc-200"><input type="checkbox" checked={manual.publicado_online} onChange={(event) => setManual((current) => ({ ...current, publicado_online: event.target.checked }))} className="size-4 accent-violet-500" /><span>Ya está publicada en R/F</span></label>
        <button type="submit" disabled={Boolean(busy)} className="inline-flex min-h-12 items-center justify-center gap-2 self-end rounded-xl bg-violet-500 px-5 font-black text-white disabled:opacity-40">{busy === "manual" ? <Loader2 className="animate-spin" /> : <PackagePlus size={19} />} Guardar pieza IAM</button>
      </form>
    </section>

    <section className="rounded-2xl border border-cyan-500/25 bg-zinc-900 p-5">
      <div className="flex items-start gap-3"><Search className="mt-1 shrink-0 text-cyan-400" /><div><h2 className="text-xl font-black text-white">Buscar una pieza IAM en Recambio Fácil</h2><p className="mt-1 text-sm text-zinc-400">Escribe el código interno de la pieza. Se consulta mediante <span className="font-mono text-cyan-300">/IAM/código?idcliente=…</span>.</p></div></div>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row"><input inputMode="numeric" value={code} onChange={(event) => { setCode(event.target.value.replace(/\D/g, "")); setApiData(null); }} placeholder="Código IAM" className="min-h-12 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 font-mono text-white outline-none focus:border-cyan-500" /><button onClick={() => void sendApi("preview")} disabled={!code || Boolean(busy)} className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-5 font-black text-zinc-950 disabled:opacity-40">{busy === "api-preview" ? <Loader2 className="animate-spin" /> : <Search size={19} />} Buscar</button></div>
      {apiData?.piece && <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950 p-4"><p className="font-mono font-black text-amber-300">{apiData.piece.base.referencia_principal || "Sin referencia"}</p><p className="mt-1 font-bold text-white">{apiData.piece.base.nombre_pieza || "Sin descripción"}</p><p className="mt-1 text-sm text-zinc-400">{apiData.piece.base.marca_pieza || "Sin marca"} · Stock {apiData.piece.base.cantidad ?? 0} · {money(apiData.piece.base.precio_venta)}</p><button onClick={() => void sendApi("import")} disabled={Boolean(busy)} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-amber-500 px-4 font-black text-zinc-950 disabled:opacity-40">{busy === "api-import" ? <Loader2 className="animate-spin" /> : <Upload size={18} />} Guardar en el almacén</button></div>}
    </section>

    <section className="rounded-2xl border border-amber-500/25 bg-zinc-900 p-5">
      <div className="flex items-start gap-3"><FileSpreadsheet className="mt-1 shrink-0 text-amber-400" /><div><h2 className="text-xl font-black text-white">Importar el fichero completo</h2><p className="mt-1 text-sm text-zinc-400">Admite el CSV exportado de IAM. Primero comprueba el contenido y después podrás guardarlo.</p></div></div>
      <label className="mt-5 flex cursor-pointer items-center justify-center gap-3 rounded-xl border border-dashed border-zinc-600 bg-zinc-950 p-5 text-center font-bold text-zinc-300 hover:border-amber-500/60"><FileSpreadsheet className="text-amber-400" /><span>{file?.name || "Seleccionar CSV de IAM"}</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={(event) => { setFile(event.target.files?.[0] || null); setCsvPreview(null); setSuccess(""); }} /></label>
      <button onClick={() => void sendCsv("preview")} disabled={!file || Boolean(busy)} className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 font-black text-amber-300 disabled:opacity-40">{busy === "csv-preview" ? <Loader2 className="animate-spin" /> : <Search size={18} />} Comprobar fichero</button>
      {csvPreview && <div className="mt-5 space-y-4"><div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat label="Filas" value={csvPreview.total} /><Stat label="Válidas" value={csvPreview.validas} /><Stat label="Con problemas" value={csvPreview.invalidas} /><Stat label="Stock total" value={csvPreview.stock} /></div><div className="overflow-x-auto rounded-xl border border-zinc-800"><table className="min-w-full text-left text-sm"><thead className="bg-zinc-950 text-zinc-500"><tr><th className="p-3">Referencia</th><th className="p-3">Descripción</th><th className="p-3">Marca</th><th className="p-3">Stock</th><th className="p-3">Precio</th></tr></thead><tbody className="divide-y divide-zinc-800">{csvPreview.muestra.map((row, index) => <tr key={`${row.referencia}-${index}`}><td className="p-3 font-mono text-amber-300">{row.referencia || "-"}</td><td className="p-3 text-white">{row.descripcion || "-"}</td><td className="p-3 text-zinc-300">{row.marca || "-"}</td><td className="p-3 text-zinc-300">{row.cantidad ?? 0}</td><td className="p-3 text-zinc-300">{money(row.precio)}</td></tr>)}</tbody></table></div><p className="text-xs text-zinc-500">Si vuelves a importar el mismo fichero, las piezas existentes se actualizarán y no se duplicarán.</p><button onClick={() => void sendCsv("import")} disabled={Boolean(busy)} className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-amber-500 px-5 font-black text-zinc-950 disabled:opacity-40">{busy === "csv-import" ? <Loader2 className="animate-spin" /> : <Upload size={19} />} Importar {csvPreview.validas} piezas</button></div>}
    </section>
  </div>;
}

function message(result: Result) { return `${result.insertadas} pieza${result.insertadas === 1 ? "" : "s"} IAM añadida${result.insertadas === 1 ? "" : "s"} y ${result.actualizadas} actualizada${result.actualizadas === 1 ? "" : "s"}.`; }
function money(value: number | null | undefined) { return value == null ? "-" : `${Number(value).toFixed(2)} €`; }
function Stat({ label, value }: { label: string; value: number }) { return <div className="rounded-xl bg-zinc-950 p-3"><p className="text-xs text-zinc-500">{label}</p><p className="mt-1 text-xl font-black text-white">{value.toLocaleString("es-ES")}</p></div>; }
function ManualField({ label, value, onChange, required, type = "text", min, step, placeholder }: { label: string; value: string; onChange: (value: string) => void; required?: boolean; type?: string; min?: string; step?: string; placeholder?: string }) { return <label className="block"><span className="mb-1.5 block text-sm font-bold text-zinc-300">{label}{required ? " *" : ""}</span><input required={required} type={type} min={min} step={step} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} className="min-h-12 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 text-white outline-none placeholder:text-zinc-600 focus:border-violet-500" /></label>; }
