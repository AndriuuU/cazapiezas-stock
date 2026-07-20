export const ESTADOS_PIEZA = [
  "Nueva",
  "Nueva con embalaje abierto",
  "Segunda mano comprobada",
  "Segunda mano sin comprobar",
  "Con defecto",
  "Pendiente de revisar",
  "No apta para venta",
] as const;

export const ESTADOS_PROCESO = [
  "Pendiente de identificar",
  "Pendiente de comprobar",
  "Pendiente de fotografiar",
  "Lista para publicar",
  "Publicada",
  "Reservada",
  "Vendida",
  "Pendiente de envío",
  "Enviada",
  "Devuelta",
  "Retirada",
] as const;

export type EstadoPieza = (typeof ESTADOS_PIEZA)[number];
export type EstadoProceso = (typeof ESTADOS_PROCESO)[number];

export interface FotoDesguace {
  id: number;
  pieza_id: number;
  url_imagen: string;
  url_publica?: string;
  url_firmada?: string;
  url_visualizacion?: string;
  es_principal: boolean;
  orden: number;
}

export interface ReglaNivelEstanteria {
  nivel_desde: number;
  nivel_hasta: number;
  contenido: string;
  categorias: string[];
  palabras_clave: string[];
}

export interface EstanteriaDesguace {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  zona: string;
  orden_plano: number;
  categorias: string[];
  palabras_clave: string[];
  reglas_nivel: ReglaNivelEstanteria[];
  niveles: number;
  huecos_por_nivel: number;
  capacidad_maxima: number;
  llena_manual: boolean;
  activa: boolean;
  created_at: string;
  updated_at: string;
  ocupados: number;
  disponibles: number;
  porcentaje_ocupacion: number;
  llena: boolean;
  motivo_llena: "manual" | "capacidad" | null;
  siguiente_ubicacion: string | null;
  siguientes_ubicaciones_por_nivel: Record<number, string | null>;
}

export type TipoMovimientoUbicacion = "colocacion" | "traslado" | "retirada" | "incidencia";

export interface MovimientoUbicacion {
  id: number;
  pieza_id: number;
  estanteria_sugerida_id: number | null;
  ubicacion_anterior: string | null;
  ubicacion_sugerida: string | null;
  resultado: "colocada_sugerida" | "colocada_alternativa" | "no_colocada" | "movida" | "retirada_ubicacion";
  ubicacion_final: string | null;
  tipo_movimiento: TipoMovimientoUbicacion;
  motivo: string | null;
  usuario_nombre: string;
  origen: string;
  created_at: string;
  pieza?: Pick<PiezaDesguace, "id" | "codigo_interno" | "nombre_pieza">;
  estanteria_sugerida?: Pick<EstanteriaDesguace, "id" | "codigo" | "nombre" | "zona"> | null;
}

export interface HuecoPlanoAlmacen {
  ubicacion: string;
  nivel: number;
  hueco: number;
  disponible: boolean;
  pieza: Pick<PiezaDesguace, "id" | "codigo_interno" | "nombre_pieza" | "categoria"> | null;
  cajon: Pick<CajonDesguace, "id" | "codigo" | "nombre" | "cantidad_piezas" | "capacidad_maxima" | "lleno"> | null;
}

export interface EstanteriaPlanoAlmacen extends EstanteriaDesguace {
  huecos: HuecoPlanoAlmacen[];
}

export interface SugerenciaUbicacion {
  estanteria: EstanteriaDesguace;
  ubicacion: string;
  motivos: string[];
  puntuacion: number;
}

export interface PiezaDesguace {
  id: number;
  codigo_interno: string;
  nombre_pieza: string | null;
  descripcion: string | null;
  categoria: string | null;
  marca_pieza: string | null;
  referencia_principal: string | null;
  referencia_oem: string | null;
  referencias_equivalentes: string | null;
  marca_vehiculo: string | null;
  modelo_vehiculo: string | null;
  matricula_vehiculo: string | null;
  motorizacion: string | null;
  codigo_motor: string | null;
  ano_desde: number | null;
  ano_hasta: number | null;
  estado_pieza: EstadoPieza | null;
  cantidad: number | null;
  precio_coste: number | null;
  precio_venta: number | null;
  ubicacion: string | null;
  cajon_id: number | null;
  cajon?: Pick<CajonDesguace, "id" | "codigo" | "nombre" | "ubicacion"> | null;
  procedencia: string | null;
  estado_proceso: EstadoProceso;
  publicado_online: boolean;
  fecha_entrada: string;
  created_at: string;
  updated_at: string;
  fotos?: FotoDesguace[];
}

export type PiezaDesguaceInput = Partial<Omit<
  PiezaDesguace,
  "id" | "codigo_interno" | "created_at" | "updated_at" | "fotos" | "cajon"
>>;

export type TipoMovimientoCajon = "creacion" | "entrada" | "salida" | "traslado" | "estado";

export interface MovimientoCajon {
  id: number;
  cajon_id: number;
  pieza_id: number | null;
  tipo_movimiento: TipoMovimientoCajon;
  ubicacion_anterior: string | null;
  ubicacion_final: string | null;
  detalle: string | null;
  usuario_nombre: string;
  created_at: string;
  pieza?: Pick<PiezaDesguace, "id" | "codigo_interno" | "nombre_pieza"> | null;
}

export interface CajonDesguace {
  id: number;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  ubicacion: string;
  capacidad_maxima: number;
  lleno_manual: boolean;
  activo: boolean;
  created_at: string;
  updated_at: string;
  cantidad_piezas: number;
  disponibles: number;
  porcentaje_ocupacion: number;
  lleno: boolean;
  piezas?: PiezaDesguace[];
  movimientos?: MovimientoCajon[];
}
