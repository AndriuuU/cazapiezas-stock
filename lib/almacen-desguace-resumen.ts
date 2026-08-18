import "server-only";

import { getAuditHistory } from "@/lib/almacen-desguace-auditoria";
import { getDrawers } from "@/lib/almacen-desguace-cajones";
import { getShelves } from "@/lib/almacen-desguace-estanterias";
import { getSupabaseApiConfig, parseSupabaseResponse, supabaseHeaders } from "@/lib/supabase-rest";
import type { CajonDesguace, EventoAlmacen, PiezaDesguace } from "@/types/almacen-desguace";

export type SummaryIssue = "location" | "photos" | "publish" | "rf";

export type CapacityAlert = {
  id: string;
  kind: "shelf" | "drawer";
  code: string;
  name: string;
  occupied: number;
  capacity: number;
  percentage: number;
  href: string;
};

export type RecentWarehouseActivity = {
  id: number;
  kind: "entry" | "sale" | "removed";
  pieceId: number | null;
  code: string;
  name: string | null;
  createdAt: string;
};

export type WarehouseSummary = {
  unlocated: PiezaDesguace[];
  missingPhotos: PiezaDesguace[];
  pendingPublish: PiezaDesguace[];
  rfProblems: EventoAlmacen[];
  counts: {
    unlocated: number;
    missingPhotos: number;
    pendingPublish: number;
    rfProblems: number;
  };
  capacityAlerts: CapacityAlert[];
  recentActivity: RecentWarehouseActivity[];
  today: { entries: number; sales: number; removed: number };
  auditReady: boolean;
};

function activePiece(piece: PiezaDesguace) {
  return piece.estado_proceso !== "Vendida" && piece.estado_proceso !== "Retirada";
}

function madridDay(value: string | Date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(value));
}

function activityKind(event: EventoAlmacen): RecentWarehouseActivity["kind"] | null {
  if (event.tipo_evento === "creacion_pieza") return "entry";
  if (event.tipo_evento !== "cambio_proceso") return null;
  const process = String(event.valor_nuevo?.estado_proceso || "");
  if (process === "Vendida") return "sale";
  if (process === "Retirada") return "removed";
  return null;
}

function unresolvedRfProblems(events: EventoAlmacen[]) {
  const latestByPiece = new Map<string, EventoAlmacen>();
  events.forEach((event) => {
    if (event.tipo_evento !== "publicacion_rf") return;
    const key = event.pieza_id == null ? event.pieza_codigo : String(event.pieza_id);
    if (!latestByPiece.has(key)) latestByPiece.set(key, event);
  });
  return [...latestByPiece.values()].filter((event) => !event.exito);
}

function capacityAlerts(shelves: Awaited<ReturnType<typeof getShelves>>, drawers: CajonDesguace[]) {
  const shelfAlerts: CapacityAlert[] = shelves
    .filter((shelf) => shelf.activa && shelf.porcentaje_ocupacion >= 80)
    .map((shelf) => ({
      id: `shelf-${shelf.id}`,
      kind: "shelf",
      code: shelf.codigo,
      name: shelf.nombre,
      occupied: shelf.ocupados,
      capacity: shelf.capacidad_maxima,
      percentage: shelf.porcentaje_ocupacion,
      href: `/almacen-desguace/estanterias/${shelf.id}`,
    }));
  const drawerAlerts: CapacityAlert[] = drawers
    .filter((drawer) => drawer.activo && drawer.porcentaje_ocupacion >= 80)
    .map((drawer) => ({
      id: `drawer-${drawer.id}`,
      kind: "drawer",
      code: drawer.codigo,
      name: drawer.nombre,
      occupied: drawer.cantidad_piezas,
      capacity: drawer.capacidad_maxima,
      percentage: drawer.porcentaje_ocupacion,
      href: `/almacen-desguace/cajones/${drawer.id}`,
    }));
  return [...shelfAlerts, ...drawerAlerts]
    .sort((left, right) => right.percentage - left.percentage || left.code.localeCompare(right.code, "es"))
    .slice(0, 8);
}

export async function getWarehouseSummary(): Promise<WarehouseSummary> {
  const { url, key } = getSupabaseApiConfig();
  const piecesParams = new URLSearchParams({ select: "*", order: "created_at.desc", limit: "10000" });
  const photosParams = new URLSearchParams({ select: "pieza_id", limit: "10000" });

  const [piecesResult, photosResult, auditResult, shelvesResult, drawersResult] = await Promise.allSettled([
    fetch(`${url}/rest/v1/almacen_desguace_piezas?${piecesParams}`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    }).then((response) => parseSupabaseResponse<PiezaDesguace[]>(response)),
    fetch(`${url}/rest/v1/almacen_desguace_fotos?${photosParams}`, {
      headers: supabaseHeaders(key),
      cache: "no-store",
    }).then((response) => parseSupabaseResponse<Array<{ pieza_id: number }>>(response)),
    getAuditHistory({ limit: 2000 }),
    getShelves(),
    getDrawers(),
  ]);

  if (piecesResult.status === "rejected") throw piecesResult.reason;
  if (photosResult.status === "rejected") throw photosResult.reason;

  const pieces = piecesResult.value;
  const photoPieceIds = new Set(photosResult.value.map((photo) => photo.pieza_id));
  const events = auditResult.status === "fulfilled" ? auditResult.value : [];
  const shelves = shelvesResult.status === "fulfilled" ? shelvesResult.value : [];
  const drawers = drawersResult.status === "fulfilled" ? drawersResult.value : [];
  const active = pieces.filter(activePiece);

  const unlocated = active.filter((piece) => !piece.ubicacion && piece.cajon_id == null);
  const missingPhotos = active.filter((piece) => piece.tipo_pieza === "CAT" && !photoPieceIds.has(piece.id));
  const pendingPublish = active.filter((piece) => piece.tipo_pieza === "CAT" && !piece.publicado_online && piece.estado_proceso === "Lista para publicar");
  const rfProblems = unresolvedRfProblems(events);
  const activities = events.flatMap((event): RecentWarehouseActivity[] => {
    const kind = activityKind(event);
    return kind ? [{
      id: event.id,
      kind,
      pieceId: event.pieza_id,
      code: event.pieza_codigo,
      name: event.pieza_nombre,
      createdAt: event.created_at,
    }] : [];
  });
  const todayKey = madridDay(new Date());
  const todayActivities = activities.filter((activity) => madridDay(activity.createdAt) === todayKey);

  return {
    unlocated: unlocated.slice(0, 20),
    missingPhotos: missingPhotos.slice(0, 20),
    pendingPublish: pendingPublish.slice(0, 20),
    rfProblems: rfProblems.slice(0, 20),
    counts: {
      unlocated: unlocated.length,
      missingPhotos: missingPhotos.length,
      pendingPublish: pendingPublish.length,
      rfProblems: rfProblems.length,
    },
    capacityAlerts: capacityAlerts(shelves, drawers),
    recentActivity: activities.slice(0, 10),
    today: {
      entries: todayActivities.filter((activity) => activity.kind === "entry").length,
      sales: todayActivities.filter((activity) => activity.kind === "sale").length,
      removed: todayActivities.filter((activity) => activity.kind === "removed").length,
    },
    auditReady: auditResult.status === "fulfilled",
  };
}
