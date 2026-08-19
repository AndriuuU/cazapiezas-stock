"use client";

import { useEffect, useState } from "react";
import { Warehouse } from "lucide-react";
import { DEFAULT_WAREHOUSE_SETTINGS, type WarehouseSettings } from "@/lib/app-settings";
import { Loading, Message, OptionGroup, SaveButton, SettingsShell, Toggle } from "@/components/admin/SettingsControls";

const OPTIONS: Array<{ key: keyof WarehouseSettings; title: string; description: string; group: string }> = [
  { key: "employeesCanCreatePieces", title: "Registrar piezas", description: "Permite crear fichas nuevas, pero no publicarlas en Recambio Fácil.", group: "Registro" },
  { key: "employeesCanUploadPhotos", title: "Subir fotografías", description: "Permite añadir fotos nuevas a las piezas.", group: "Fotografías" },
  { key: "employeesCanChooseMainPhoto", title: "Elegir foto principal", description: "Permite cambiar qué fotografía aparece como portada.", group: "Fotografías" },
  { key: "employeesCanLocatePieces", title: "Colocar y cambiar ubicación", description: "Permite asignar una pieza a un hueco de las estanterías.", group: "Ubicación" },
  { key: "employeesCanManageDrawerContents", title: "Mover piezas entre cajones", description: "Permite añadir, trasladar o sacar piezas de los cajones.", group: "Ubicación" },
  { key: "employeesCanRegisterSales", title: "Registrar ventas", description: "Permite marcar piezas como vendidas y firma la operación con su usuario.", group: "Ventas" },
];

export default function WarehouseSettingsPage() {
  const [settings, setSettings] = useState<WarehouseSettings>(DEFAULT_WAREHOUSE_SETTINGS);
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false); const [error, setError] = useState(""); const [saved, setSaved] = useState(false);
  useEffect(() => { void fetch("/api/configuracion/almacen-desguace", { cache: "no-store" }).then(async (response) => { const payload = await response.json() as { settings?: WarehouseSettings; error?: string }; if (!response.ok) throw new Error(payload.error || "No se pudo cargar la configuración."); setSettings(payload.settings || DEFAULT_WAREHOUSE_SETTINGS); }).catch((caught) => setError(caught instanceof Error ? caught.message : "No se pudo cargar la configuración.")).finally(() => setLoading(false)); }, []);
  function toggle(key: keyof WarehouseSettings) { setSaved(false); setSettings((current) => { const next = { ...current, [key]: !current[key] }; if (key === "employeesCanUploadPhotos" && !next.employeesCanUploadPhotos) next.employeesCanChooseMainPhoto = false; return next; }); }
  async function save() { setSaving(true); setError(""); setSaved(false); try { const response = await fetch("/api/configuracion/almacen-desguace", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(settings) }); const payload = await response.json() as { settings?: WarehouseSettings; error?: string }; if (!response.ok) throw new Error(payload.error || "No se pudo guardar."); setSettings(payload.settings || settings); setSaved(true); } catch (caught) { setError(caught instanceof Error ? caught.message : "No se pudo guardar."); } finally { setSaving(false); } }
  const groups = Array.from(new Set(OPTIONS.map((option) => option.group)));
  return <SettingsShell title="Almacén Desguace" subtitle="Operaciones cotidianas permitidas a los empleados" icon={<Warehouse className="text-amber-400" />}>{error && <Message tone="error">{error}</Message>}{saved && <Message tone="saved">Configuración guardada</Message>}<div className="mb-5 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm leading-6 text-amber-100">Borrar, editar fichas, importar, publicar y modificar la organización continúan siendo acciones exclusivas del administrador.</div>{loading ? <Loading /> : <><div className="space-y-6">{groups.map((group) => <OptionGroup key={group} title={group}>{OPTIONS.filter((option) => option.group === group).map((option) => { const disabled = option.key === "employeesCanChooseMainPhoto" && !settings.employeesCanUploadPhotos; return <Toggle key={option.key} title={option.title} description={option.description} checked={settings[option.key]} disabled={disabled} onClick={() => toggle(option.key)} />; })}</OptionGroup>)}</div><SaveButton saving={saving} onClick={() => void save()} /></>}</SettingsShell>;
}
