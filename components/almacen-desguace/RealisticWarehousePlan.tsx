"use client";

import Link from "next/link";
import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Box, Check, Crosshair, Edit3, Layers3, MapPin, Maximize2, Plus, RotateCw, Save, Trash2, Warehouse, X } from "lucide-react";
import type { ElementoPlanoAlmacen, EstanteriaPlanoAlmacen } from "@/types/almacen-desguace";
import { useCurrentUser } from "@/components/auth/useCurrentUser";

type DefaultShelf = Omit<ElementoPlanoAlmacen, "id" | "tipo" | "nombre" | "color" | "orden"> & { physicalLabel: string };

const DEFAULT_SHELVES: DefaultShelf[] = [
  { codigo_estanteria: "E01", x: 990, y: 1260, ancho: 180, alto: 54, rotacion: 0, physicalLabel: "1" },
  { codigo_estanteria: "E02", x: 980, y: 1160, ancho: 190, alto: 54, rotacion: 0, physicalLabel: "2" },
  { codigo_estanteria: "E03", x: 980, y: 1060, ancho: 190, alto: 54, rotacion: 0, physicalLabel: "3" },
  { codigo_estanteria: "E04", x: 980, y: 960, ancho: 190, alto: 54, rotacion: 0, physicalLabel: "4" },
  { codigo_estanteria: "E05", x: 980, y: 860, ancho: 190, alto: 54, rotacion: 0, physicalLabel: "5" },
  { codigo_estanteria: "E06", x: 980, y: 760, ancho: 190, alto: 54, rotacion: 0, physicalLabel: "6" },
  { codigo_estanteria: "E07", x: 980, y: 660, ancho: 190, alto: 54, rotacion: 0, physicalLabel: "7" },
  { codigo_estanteria: "E08", x: 560, y: 735, ancho: 115, alto: 58, rotacion: 0, physicalLabel: "1" },
  { codigo_estanteria: "E09", x: 430, y: 735, ancho: 115, alto: 58, rotacion: 0, physicalLabel: "2" },
  { codigo_estanteria: "E10", x: 300, y: 735, ancho: 115, alto: 58, rotacion: 0, physicalLabel: "3" },
  { codigo_estanteria: "E11", x: 170, y: 735, ancho: 115, alto: 58, rotacion: 0, physicalLabel: "4" },
  { codigo_estanteria: "E12", x: 255, y: 455, ancho: 350, alto: 58, rotacion: 0, physicalLabel: "1" },
  { codigo_estanteria: "E13", x: 255, y: 360, ancho: 350, alto: 58, rotacion: 0, physicalLabel: "2" },
];

function defaultLayout(): ElementoPlanoAlmacen[] {
  return DEFAULT_SHELVES.map((shelf, index) => ({
    id: `default-${shelf.codigo_estanteria}`,
    tipo: "estanteria",
    codigo_estanteria: shelf.codigo_estanteria,
    nombre: "",
    x: shelf.x,
    y: shelf.y,
    ancho: shelf.ancho,
    alto: shelf.alto,
    rotacion: shelf.rotacion,
    color: "#64748b",
    orden: index,
  }));
}

function cloneLayout(elements: ElementoPlanoAlmacen[]) {
  return elements.map((element) => ({ ...element }));
}

export default function RealisticWarehousePlan({ shelves, initialLayout, visibleShelfCodes, searching, focusedShelf, focusedLocation }: {
  shelves: EstanteriaPlanoAlmacen[];
  initialLayout: ElementoPlanoAlmacen[];
  visibleShelfCodes: Set<string>;
  searching: boolean;
  focusedShelf?: string;
  focusedLocation?: string;
}) {
  const currentUser = useCurrentUser();
  const isAdmin = currentUser?.rol === "administrador";
  const startingLayout = useMemo(() => initialLayout.length ? cloneLayout(initialLayout) : defaultLayout(), [initialLayout]);
  const [elements, setElements] = useState<ElementoPlanoAlmacen[]>(startingLayout);
  const savedLayout = useRef<ElementoPlanoAlmacen[]>(cloneLayout(startingLayout));
  const [selectedCode, setSelectedCode] = useState<string | null>(focusedShelf && /^E\d{2}$/.test(focusedShelf) ? focusedShelf : null);
  const [selectedElementId, setSelectedElementId] = useState<number | string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFullPlan, setShowFullPlan] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [shelfToAdd, setShelfToAdd] = useState("");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const dragRef = useRef<{ id: number | string; pointerId: number; offsetX: number; offsetY: number } | null>(null);

  const shelvesByCode = useMemo(() => new Map(shelves.map((shelf) => [shelf.codigo, shelf])), [shelves]);
  const selectedShelf = selectedCode ? shelvesByCode.get(selectedCode) || null : null;
  const selectedElement = selectedElementId == null ? null : elements.find((element) => element.id === selectedElementId) || null;
  const placedCodes = useMemo(() => new Set(elements.flatMap((element) => element.tipo === "estanteria" && element.codigo_estanteria ? [element.codigo_estanteria] : [])), [elements]);
  const unplacedShelves = useMemo(() => shelves.filter((shelf) => !placedCodes.has(shelf.codigo)), [placedCodes, shelves]);

  function selectShelf(code: string | null) {
    if (!code) return;
    if (!editing && !shelvesByCode.has(code)) return;
    setSelectedCode(shelvesByCode.has(code) ? code : null);
  }

  function openShelfDetails() {
    if (!selectedCode) return;
    const exactLocation = focusedLocation ? document.getElementById(`ubicacion-${focusedLocation}`) : null;
    (exactLocation || document.getElementById(`estanteria-${selectedCode}`))?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  function beginEditing() {
    setEditing(true);
    setMessage(null);
    setSelectedCode(null);
  }

  function cancelEditing() {
    setElements(cloneLayout(savedLayout.current));
    setEditing(false);
    setSelectedElementId(null);
    setMessage(null);
  }

  async function saveLayout() {
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/almacen-desguace/plano", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ elementos: elements }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(body?.error || "No se pudo guardar el plano.");
      savedLayout.current = cloneLayout(elements);
      setEditing(false);
      setSelectedElementId(null);
      setMessage({ tone: "success", text: "Distribución guardada. Las piezas y cajones no se han modificado." });
    } catch (error) {
      setMessage({ tone: "error", text: error instanceof Error ? error.message : "No se pudo guardar el plano." });
    } finally {
      setSaving(false);
    }
  }

  function addShelf() {
    const code = shelfToAdd || unplacedShelves[0]?.codigo;
    if (!code) return;
    const shelf = shelvesByCode.get(code);
    const id = `shelf-${code}-${Date.now()}`;
    setElements((current) => [...current, {
      id,
      tipo: "estanteria",
      codigo_estanteria: code,
      nombre: shelf?.nombre || "",
      x: 700,
      y: 900,
      ancho: 180,
      alto: 60,
      rotacion: 0,
      color: "#64748b",
      orden: current.length,
    }]);
    setSelectedElementId(id);
    setShelfToAdd("");
  }

  function addFloorZone() {
    const id = `floor-${Date.now()}`;
    setElements((current) => [...current, {
      id,
      tipo: "zona_suelo",
      codigo_estanteria: null,
      nombre: "Nueva zona de suelo",
      x: 690,
      y: 520,
      ancho: 230,
      alto: 150,
      rotacion: 0,
      color: "#8b5cf6",
      orden: current.length,
    }]);
    setSelectedElementId(id);
  }

  function updateSelected(changes: Partial<ElementoPlanoAlmacen>) {
    if (selectedElementId == null) return;
    setElements((current) => current.map((element) => element.id === selectedElementId ? { ...element, ...changes } : element));
  }

  function removeSelected() {
    if (selectedElementId == null) return;
    setElements((current) => current.filter((element) => element.id !== selectedElementId));
    setSelectedElementId(null);
  }

  function svgPoint(event: ReactPointerEvent<SVGSVGElement | SVGGElement>) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const point = svg.createSVGPoint();
    point.x = event.clientX;
    point.y = event.clientY;
    const matrix = svg.getScreenCTM()?.inverse();
    return matrix ? point.matrixTransform(matrix) : { x: 0, y: 0 };
  }

  function startDrag(element: ElementoPlanoAlmacen, event: ReactPointerEvent<SVGGElement>) {
    if (!editing) return;
    event.preventDefault();
    event.stopPropagation();
    const point = svgPoint(event);
    dragRef.current = { id: element.id, pointerId: event.pointerId, offsetX: point.x - element.x, offsetY: point.y - element.y };
    svgRef.current?.setPointerCapture(event.pointerId);
    setSelectedElementId(element.id);
    setSelectedCode(null);
  }

  function moveDrag(event: ReactPointerEvent<SVGSVGElement>) {
    const drag = dragRef.current;
    if (!editing || !drag || drag.pointerId !== event.pointerId) return;
    const point = svgPoint(event);
    setElements((current) => current.map((element) => element.id === drag.id ? {
      ...element,
      x: Math.max(20, Math.min(1180 - element.ancho, Math.round(point.x - drag.offsetX))),
      y: Math.max(20, Math.min(1480 - element.alto, Math.round(point.y - drag.offsetY))),
    } : element));
  }

  function endDrag(event: ReactPointerEvent<SVGSVGElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null;
  }

  const focusedParts = focusedLocation?.match(/^DESGUACE-E\d{2}-N(\d{2})-C(\d{2})$/);
  const focusedElement = focusedShelf ? elements.find((element) => element.tipo === "estanteria" && element.codigo_estanteria === focusedShelf) : null;
  const focusedViewBox = focusedElement ? (() => {
    const width = 860;
    const height = 760;
    const centerX = focusedElement.x + focusedElement.ancho / 2;
    const centerY = focusedElement.y + focusedElement.alto / 2;
    return `${Math.max(0, Math.min(1200 - width, centerX - width / 2))} ${Math.max(0, Math.min(1500 - height, centerY - height / 2))} ${width} ${height}`;
  })() : "0 0 1200 1500";

  return <section id="plano-fisico" className="mx-auto w-full scroll-mt-24 overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-900 shadow-2xl" style={{ maxWidth: 680 }}>
    <header className="border-b border-zinc-800 bg-zinc-950/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2"><MapPin className="text-cyan-400" /><h2 className="text-xl font-black text-white">Plano físico del almacén</h2></div>
          <p className="mt-1 text-sm text-zinc-500">Vista superior basada en el croquis real.</p>
        </div>
        {!editing
          ? isAdmin && <button onClick={beginEditing} className="inline-flex items-center gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-black text-amber-200"><Edit3 size={17} /> Editar plano</button>
          : <div className="flex gap-2"><button onClick={cancelEditing} disabled={saving} className="inline-flex items-center gap-2 rounded-xl border border-zinc-700 px-3 py-2 text-sm font-bold text-zinc-300"><X size={16} /> Cancelar</button><button onClick={saveLayout} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-4 py-2 text-sm font-black text-zinc-950 disabled:opacity-50"><Save size={16} /> {saving ? "Guardando..." : "Guardar"}</button></div>}
      </div>
      {editing && <div className="mt-4 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs leading-5 text-amber-100/80"><strong>Modo edición:</strong> arrastra los elementos en el dibujo. Cambiar el plano no mueve ni elimina piezas, cajones o ubicaciones.</div>}
      {message && <div className={`mt-3 flex items-start gap-2 rounded-xl border p-3 text-sm ${message.tone === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>{message.tone === "success" ? <Check size={18} /> : <X size={18} />}<span>{message.text}</span></div>}
    </header>

    {editing && <div className="grid gap-3 border-b border-zinc-800 bg-zinc-900 p-4 sm:grid-cols-2">
      <div className="rounded-xl border border-zinc-700 bg-zinc-950/60 p-3">
        <p className="mb-2 text-xs font-black uppercase tracking-wide text-zinc-400">Colocar estantería pendiente</p>
        {unplacedShelves.length ? <div className="flex gap-2"><select value={shelfToAdd} onChange={(event) => setShelfToAdd(event.target.value)} className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white"><option value="">Selecciona...</option>{unplacedShelves.map((shelf) => <option key={shelf.id} value={shelf.codigo}>{shelf.codigo} · {shelf.nombre}</option>)}</select><button onClick={addShelf} className="rounded-lg bg-cyan-500 p-2 text-zinc-950" aria-label="Añadir estantería"><Plus size={20} /></button></div> : <p className="text-xs text-zinc-500">Todas las estanterías configuradas ya están colocadas.</p>}
        <Link href="/almacen-desguace/estanterias" className="mt-2 inline-block text-xs font-bold text-amber-300 hover:text-amber-200">Crear una estantería nueva →</Link>
      </div>
      <button onClick={addFloorZone} className="flex items-center justify-center gap-3 rounded-xl border border-violet-500/30 bg-violet-500/10 p-3 text-sm font-black text-violet-200"><Layers3 size={20} /> Añadir zona de suelo</button>
    </div>}

    <div className="bg-[#111318] p-3 sm:p-4">
      {!editing && focusedElement && focusedParts && <div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-cyan-400/40 bg-cyan-500/10 p-3"><div className="flex min-w-0 items-center gap-3"><MapPin className="shrink-0 text-cyan-300" size={22} /><div className="min-w-0"><p className="font-black text-white">{focusedShelf} · Nivel {Number(focusedParts[1])} · Hueco {Number(focusedParts[2])}</p><p className="truncate font-mono text-xs text-cyan-200">{focusedLocation}</p></div></div><div className="flex w-full flex-wrap gap-2 sm:w-auto"><button type="button" onClick={() => setShowFullPlan((current) => !current)} className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-cyan-400/30 bg-zinc-950 px-3 text-sm font-black text-cyan-200 hover:border-cyan-300 sm:flex-none">{showFullPlan ? <Crosshair size={17} /> : <Maximize2 size={17} />}{showFullPlan ? "Centrar ubicación" : "Quitar zoom"}</button><Link href="/almacen-desguace/plano#plano-fisico" className="inline-flex min-h-10 flex-1 items-center justify-center gap-2 rounded-xl bg-cyan-500 px-3 text-sm font-black text-zinc-950 hover:bg-cyan-400 sm:flex-none"><Warehouse size={17} /> Mostrar todas</Link></div></div>}
      <svg ref={svgRef} viewBox={editing || showFullPlan ? "0 0 1200 1500" : focusedViewBox} preserveAspectRatio="xMidYMid meet" className="mx-auto block w-full select-none" style={{ maxWidth: 540, touchAction: editing ? "none" : "auto" }} role="img" aria-label="Plano superior interactivo del almacén desguace" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag} onPointerDown={() => editing && setSelectedElementId(null)}>
        <defs>
          <pattern id="floor-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="#27272a" strokeWidth="1" /></pattern>
          <pattern id="blocked-hatch" width="18" height="18" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="18" height="18" fill="#09090b" /><line x1="0" y1="0" x2="0" y2="18" stroke="#27272a" strokeWidth="7" /></pattern>
          <filter id="selected-glow"><feGaussianBlur stdDeviation="5" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        </defs>
        <rect x="8" y="8" width="1184" height="1484" rx="28" fill="#17191f" stroke="#52525b" strokeWidth="7" />
        <rect x="20" y="20" width="1160" height="1460" rx="20" fill="url(#floor-grid)" />

        <Zone x={25} y={25} width={250} height={255} label="CAJAS DE CAMBIO" color="#c47f59" />
        <Zone x={625} y={25} width={550} height={275} label="ZONA DE CHAPA" color="#22c55e" />
        <Zone x={245} y={325} width={380} height={230} label="ELEVALUNAS" color="#ef4444" />
        <Zone x={150} y={680} width={550} height={165} label="ESTANTERÍAS 2" color="#c05ac8" />
        <Zone x={915} y={610} width={265} height={760} label="ESTANTERÍAS" color="#5567ff" />
        <Zone x={710} y={1110} width={195} height={350} label="CAJAS" color="#fbbf24" />

        <path d="M225 805 Q300 775 385 805 L660 805 Q700 835 700 910 L710 1465 L40 1465 Q15 1400 130 1380 L215 1370 Z" fill="url(#blocked-hatch)" stroke="#3f3f46" strokeWidth="6" />
        <text x="405" y="1110" fill="#71717a" fontSize="28" fontWeight="900" textAnchor="middle" transform="rotate(-90 405 1110)">PARED · ZONA INACCESIBLE</text>

        <g aria-label="Escaleras"><rect x="705" y="790" width="155" height="315" rx="8" fill="#20232b" stroke="#a1a1aa" strokeWidth="4" />{Array.from({ length: 9 }, (_, index) => <line key={index} x1="715" x2="850" y1={820 + index * 30} y2={820 + index * 30} stroke="#71717a" strokeWidth="3" />)}<text x="782" y="775" textAnchor="middle" fill="#e4e4e7" fontSize="25" fontWeight="800">ESCALERAS</text></g>
        <g aria-label="Montacargas"><rect x="975" y="320" width="200" height="175" rx="18" fill="#20232b" stroke="#a1a1aa" strokeWidth="5" /><path d="M1010 445V365M1140 445V365M1010 405H1140" stroke="#71717a" strokeWidth="5" /><text x="1075" y="415" textAnchor="middle" fill="#e4e4e7" fontSize="24" fontWeight="900">MONTACARGAS</text></g>

        {elements.filter((element) => element.tipo === "zona_suelo").map((element) => <FloorZoneShape key={element.id} element={element} selected={editing && selectedElementId === element.id} editing={editing} onPointerDown={(event) => startDrag(element, event)} />)}
        {elements.filter((element) => element.tipo === "estanteria").map((element) => {
          const code = element.codigo_estanteria || "";
          return <ShelfShape key={element.id} element={element} shelf={shelvesByCode.get(code)} physicalLabel={DEFAULT_SHELVES.find((item) => item.codigo_estanteria === code)?.physicalLabel || code.replace("E", "")} visible={editing || !searching || visibleShelfCodes.has(code)} selected={editing ? selectedElementId === element.id : selectedCode === code} editing={editing} onSelect={() => selectShelf(code)} onPointerDown={(event) => startDrag(element, event)} />;
        })}
        {!editing && focusedElement && focusedParts && <FocusedLocationMarker element={focusedElement} level={Number(focusedParts[1])} slot={Number(focusedParts[2])} />}

 </svg>
    </div>

    {editing && selectedElement && <ElementEditor element={selectedElement} update={updateSelected} remove={removeSelected} />}

    <div className="border-t border-zinc-800 bg-zinc-950/50 p-4">
      <div className="flex flex-wrap gap-4 text-xs text-zinc-400"><Legend color="#22c55e" label="Libre" /><Legend color="#06b6d4" label="Con contenido" /><Legend color="#f59e0b" label="Ocupación alta" /><Legend color="#ef4444" label="Llena o inactiva" /><Legend color="#52525b" label="Pendiente de configurar" /></div>
      {!editing && selectedCode && <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-4"><div className="flex items-center gap-3"><span className="rounded-xl bg-cyan-500/10 p-2 text-cyan-300"><Warehouse size={20} /></span><div><p className="font-mono font-black text-amber-300">{selectedCode}</p><p className="font-bold text-white">{selectedShelf?.nombre || "Estantería pendiente de configurar"}</p>{focusedLocation && focusedShelf === selectedCode && focusedParts ? <><p className="mt-1 font-black text-cyan-200">Nivel {Number(focusedParts[1])} · Hueco {Number(focusedParts[2])}</p><p className="font-mono text-[11px] text-zinc-500">{focusedLocation}</p></> : selectedShelf ? <p className="text-xs text-zinc-500">{selectedShelf.zona} · {selectedShelf.ocupados} ocupados · {selectedShelf.disponibles} libres</p> : <p className="text-xs text-zinc-500">La posición está señalada en el dibujo.</p>}</div></div>{selectedShelf ? <button onClick={openShelfDetails} className="inline-flex items-center gap-2 rounded-xl bg-cyan-500 px-4 py-2.5 font-black text-zinc-950"><Box size={17} /> Ver niveles y huecos</button> : <Link href="/almacen-desguace/estanterias" className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm font-black text-amber-200">Configurar estantería</Link>}</div>}
    </div>
  </section>;
}

function ElementEditor({ element, update, remove }: { element: ElementoPlanoAlmacen; update: (changes: Partial<ElementoPlanoAlmacen>) => void; remove: () => void }) {
  return <div className="border-t border-amber-500/20 bg-amber-500/5 p-4">
    <div className="mb-3 flex items-center justify-between gap-3"><div><p className="text-xs font-black uppercase tracking-wide text-amber-300">Elemento seleccionado</p><p className="font-bold text-white">{element.tipo === "estanteria" ? element.codigo_estanteria : element.nombre}</p></div><button onClick={remove} className="inline-flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200"><Trash2 size={15} /> Quitar del plano</button></div>
    {element.tipo === "zona_suelo" && <div className="mb-3 grid gap-3 sm:grid-cols-[1fr_auto]"><label className="text-xs text-zinc-400">Nombre<input value={element.nombre} onChange={(event) => update({ nombre: event.target.value })} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white" /></label><label className="text-xs text-zinc-400">Color<input type="color" value={element.color} onChange={(event) => update({ color: event.target.value })} className="mt-1 block h-10 w-16 rounded-lg border border-zinc-700 bg-zinc-950 p-1" /></label></div>}
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <NumberControl label="Posición X" value={element.x} min={0} max={1160} onChange={(x) => update({ x })} />
      <NumberControl label="Posición Y" value={element.y} min={0} max={1470} onChange={(y) => update({ y })} />
      <NumberControl label="Ancho" value={element.ancho} min={40} max={600} onChange={(ancho) => update({ ancho })} />
      <NumberControl label="Alto" value={element.alto} min={30} max={500} onChange={(alto) => update({ alto })} />
    </div>
    <button onClick={() => update({ rotacion: element.rotacion === 0 ? 90 : 0 })} className="mt-3 inline-flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-bold text-zinc-200"><RotateCw size={15} /> Girar {element.rotacion === 0 ? "90°" : "horizontal"}</button>
  </div>;
}

function NumberControl({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return <label className="text-xs text-zinc-400">{label}<input type="number" value={Math.round(value)} min={min} max={max} onChange={(event) => onChange(Math.max(min, Math.min(max, Number(event.target.value) || min)))} className="mt-1 w-full rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-2 text-sm text-white" /></label>;
}

function Zone({ x, y, width, height, label, color }: { x: number; y: number; width: number; height: number; label: string; color: string }) {
  return <g><rect x={x} y={y} width={width} height={height} rx="18" fill={`${color}12`} stroke={color} strokeWidth="5" strokeDasharray="14 8" /><text x={x + 18} y={y + 38} fill={color} fontSize="24" fontWeight="900">{label}</text></g>;
}

function FloorZoneShape({ element, selected, editing, onPointerDown }: { element: ElementoPlanoAlmacen; selected: boolean; editing: boolean; onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void }) {
  const centerX = element.x + element.ancho / 2;
  const centerY = element.y + element.alto / 2;
  return <g transform={`rotate(${element.rotacion} ${centerX} ${centerY})`} onPointerDown={onPointerDown} className={editing ? "cursor-move" : ""}>
    <rect x={element.x} y={element.y} width={element.ancho} height={element.alto} rx="16" fill={`${element.color}28`} stroke={selected ? "#f4f4f5" : element.color} strokeWidth={selected ? 8 : 5} strokeDasharray="14 8" filter={selected ? "url(#selected-glow)" : undefined} />
    <text x={centerX} y={centerY - 5} textAnchor="middle" fill="#fafafa" fontSize="22" fontWeight="900">{element.nombre || "ZONA DE SUELO"}</text>
    <text x={centerX} y={centerY + 24} textAnchor="middle" fill={element.color} fontSize="15" fontWeight="800">PIEZAS GRANDES / PALETS</text>
  </g>;
}

function ShelfShape({ element, shelf, physicalLabel, visible, selected, editing, onSelect, onPointerDown }: { element: ElementoPlanoAlmacen; shelf?: EstanteriaPlanoAlmacen; physicalLabel: string; visible: boolean; selected: boolean; editing: boolean; onSelect: () => void; onPointerDown: (event: ReactPointerEvent<SVGGElement>) => void }) {
  const fill = !shelf ? "#52525b" : !shelf.activa || shelf.llena ? "#ef4444" : shelf.porcentaje_ocupacion >= 75 ? "#f59e0b" : shelf.ocupados ? "#06b6d4" : "#22c55e";
  const code = element.codigo_estanteria || "";
  const label = shelf ? `${code} · ${shelf.ocupados}/${shelf.capacidad_maxima}` : `${code} · sin configurar`;
  const centerX = element.x + element.ancho / 2;
  const centerY = element.y + element.alto / 2;
  return <g role={!editing && shelf ? "button" : undefined} tabIndex={!editing && shelf ? 0 : undefined} aria-label={label} onClick={() => !editing && onSelect()} onPointerDown={onPointerDown} onKeyDown={(event) => { if (!editing && shelf && (event.key === "Enter" || event.key === " ")) onSelect(); }} opacity={visible ? 1 : 0.16} className={editing ? "cursor-move" : shelf ? "cursor-pointer" : "cursor-not-allowed"} style={{ transition: "opacity 180ms ease" }} transform={`rotate(${element.rotacion} ${centerX} ${centerY})`}>
    <rect x={element.x} y={element.y} width={element.ancho} height={element.alto} rx="9" fill="#09090b" stroke={selected ? "#f4f4f5" : fill} strokeWidth={selected ? 8 : 5} filter={selected ? "url(#selected-glow)" : undefined} />
    {Array.from({ length: 4 }, (_, index) => <line key={index} x1={element.x + (element.ancho / 5) * (index + 1)} x2={element.x + (element.ancho / 5) * (index + 1)} y1={element.y + 5} y2={element.y + element.alto - 5} stroke="#3f3f46" strokeWidth="2" />)}
    <text x={centerX} y={centerY - 3} textAnchor="middle" fill="#fafafa" fontSize="17" fontWeight="900">{code}</text>
    <text x={centerX} y={centerY + 18} textAnchor="middle" fill={shelf ? fill : "#a1a1aa"} fontSize="13" fontWeight="800">{shelf ? `${shelf.ocupados}/${shelf.capacidad_maxima}` : "PENDIENTE"}</text>
    <circle cx={element.x - 18} cy={centerY} r="15" fill={fill} /><text x={element.x - 18} y={centerY + 6} textAnchor="middle" fill="#09090b" fontSize="17" fontWeight="900">{physicalLabel}</text>
  </g>;
}

function FocusedLocationMarker({ element, level, slot }: { element: ElementoPlanoAlmacen; level: number; slot: number }) {
  const shelfX = element.x + element.ancho / 2;
  const shelfY = element.y + element.alto / 2;
  const markerX = Math.max(25, Math.min(985, shelfX - 95));
  const markerY = element.y > 125 ? element.y - 95 : element.y + element.alto + 30;
  const lineEndY = markerY < shelfY ? markerY + 70 : markerY;
  return <g pointerEvents="none" aria-label={`Nivel ${level}, hueco ${slot}`}>
    <line x1={shelfX} y1={shelfY} x2={markerX + 95} y2={lineEndY} stroke="#67e8f9" strokeWidth="7" strokeDasharray="10 7" />
    <circle cx={shelfX} cy={shelfY} r="22" fill="none" stroke="#fbbf24" strokeWidth="7"><animate attributeName="r" values="20;31;20" dur="1.4s" repeatCount="indefinite" /><animate attributeName="opacity" values="1;.35;1" dur="1.4s" repeatCount="indefinite" /></circle>
    <rect x={markerX} y={markerY} width="190" height="70" rx="16" fill="#083344" stroke="#67e8f9" strokeWidth="5" />
    <text x={markerX + 95} y={markerY + 29} textAnchor="middle" fill="#a5f3fc" fontSize="18" fontWeight="900">UBICACIÓN EXACTA</text>
    <text x={markerX + 95} y={markerY + 55} textAnchor="middle" fill="#ffffff" fontSize="23" fontWeight="900">NIVEL {level} · HUECO {slot}</text>
  </g>;
}

function Legend({ color, label }: { color: string; label: string }) {
  return <span className="inline-flex items-center gap-2"><span className="inline-block flex-none rounded" style={{ width: 12, height: 12, backgroundColor: color }} />{label}</span>;
}
