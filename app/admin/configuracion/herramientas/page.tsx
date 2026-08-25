"use client";

import { useEffect, useState } from "react";
import { Wrench } from "lucide-react";
import { DEFAULT_TOOL_SETTINGS, type ToolSettings } from "@/lib/app-settings";
import { Loading, Message, OptionGroup, SaveButton, SettingsShell, Toggle } from "@/components/admin/SettingsControls";

type BooleanToolSetting = Exclude<keyof ToolSettings, "loanOverdueHours">;
const OPTIONS: Array<{ key: BooleanToolSetting; title: string; description: string; group: string }> = [
  { key: "requireLocationScanOnReturn", title: "Escanear el hueco al devolver", description: "Obliga a comprobar el QR de la ubicación correcta antes de colocarla.", group: "Devoluciones" },
  { key: "allowManualLocationCode", title: "Permitir escribir el código UB", description: "Alternativa para devolver cuando la cámara no funciona.", group: "Devoluciones" },
  { key: "askVehicleOnLoan", title: "Preguntar el vehículo", description: "Muestra el campo de matrícula, modelo u orden al retirar.", group: "Retiradas" },
  { key: "requireVehicleOnLoan", title: "Vehículo obligatorio", description: "No permite retirar sin indicar un vehículo.", group: "Retiradas" },
  { key: "employeesCanMarkMissing", title: "Empleados pueden marcar «No localizada»", description: "Si se desactiva, solamente un administrador puede cambiar ese estado.", group: "Permisos" },
  { key: "requirePhotoOnCreate", title: "Foto obligatoria al registrar", description: "La herramienta nueva deberá tener una fotografía inicial.", group: "Registro" },
  { key: "allowReturnIncidents", title: "Permitir incidencias al devolver", description: "Muestra las opciones «Falta una pieza», «Está dañada» y «Necesita revisión» durante la devolución.", group: "Incidencias" },
  { key: "requireIncidentComment", title: "Comentario obligatorio en incidencias", description: "Obliga a explicar brevemente qué ocurre antes de registrar la incidencia.", group: "Incidencias" },
];

export default function ToolSettingsPage() {
  const [settings, setSettings] = useState<ToolSettings>(DEFAULT_TOOL_SETTINGS);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  useEffect(() => { void fetch("/api/configuracion/herramientas", { cache: "no-store" }).then(async (response) => { const payload = await response.json() as { settings?: ToolSettings; error?: string }; if (!response.ok) throw new Error(payload.error || "No se pudo cargar la configuración."); setSettings(payload.settings || DEFAULT_TOOL_SETTINGS); }).catch((caught) => setError(caught instanceof Error ? caught.message : "No se pudo cargar la configuración.")).finally(() => setLoading(false)); }, []);
  useEffect(() => { if (!error && !saved) return; const timeout = window.setTimeout(() => { setError(""); setSaved(false); }, 3000); return () => window.clearTimeout(timeout); }, [error, saved]);
  function toggle(key: BooleanToolSetting) { setSaved(false); setSettings((current) => { const next = { ...current, [key]: !current[key] }; if (key === "askVehicleOnLoan" && !next.askVehicleOnLoan) next.requireVehicleOnLoan = false; if (key === "allowReturnIncidents" && !next.allowReturnIncidents) next.requireIncidentComment = false; return next; }); }
  async function save() { setSaving(true); setError(""); setSaved(false); try { const response = await fetch("/api/configuracion/herramientas", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); const payload = await response.json() as { settings?: ToolSettings; error?: string }; if (!response.ok) throw new Error(payload.error || "No se pudo guardar."); setSettings(payload.settings || settings); setSaved(true); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar."); } finally { setSaving(false); } }
  const groups = Array.from(new Set(OPTIONS.map((option) => option.group)));
  return <SettingsShell title="Herramientas comunes" subtitle="Devoluciones, retiradas, registro y permisos" icon={<Wrench className="text-cyan-400" />}>{error && <Message tone="error">{error}</Message>}{saved && <Message tone="saved">Configuración guardada</Message>}{loading ? <Loading /> : <><div className="space-y-6">{groups.map((group) => <OptionGroup key={group} title={group}>{OPTIONS.filter((option) => option.group === group).map((option) => { const disabled = option.key === "requireVehicleOnLoan" && !settings.askVehicleOnLoan || option.key === "requireIncidentComment" && !settings.allowReturnIncidents; return <Toggle key={option.key} title={option.title} description={option.description} checked={settings[option.key]} disabled={disabled} onClick={() => toggle(option.key)} />; })}</OptionGroup>)}<OptionGroup title="Avisos"><label className="block p-4"><strong className="block text-base text-white">Avisar cuando lleve prestada</strong><span className="mt-1 block text-xs leading-5 text-zinc-500">La herramienta se destacará como retrasada al superar este tiempo.</span><div className="mt-3 flex items-center gap-3"><input type="number" min="1" max="720" value={settings.loanOverdueHours} onChange={(event) => { setSaved(false); setSettings((current) => ({ ...current, loanOverdueHours: Math.min(720, Math.max(1, Number(event.target.value) || 1)) })); }} className="min-h-12 w-28 rounded-xl border border-zinc-700 bg-zinc-950 px-3 text-lg font-black text-white outline-none focus:border-cyan-400" /><span className="font-bold text-zinc-400">horas</span></div></label></OptionGroup></div><SaveButton saving={saving} onClick={() => void save()} /></>}</SettingsShell>;
}
