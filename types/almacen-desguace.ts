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
export type TipoPiezaDesguace = "CAT" | "IAM";

export interface DetallePiezaIam {
  pieza_id: number;
  codigo_iam: number | null;
  idcliente: number | null;
  referencia_2: string | null;
  referencia_3: string | null;
  marca_rf: string | null;
  id_marca: number | null;
  familia: string | null;
  precio_base: number | null;
  precio_ecotasa: number | null;
  precio_publicado: number | null;
  importe_casco: number | null;
  precio_pvp: number | null;
  precio_pue: number | null;
  precio_pm: number | null;
  fecha_base: string | null;
  fecha_insercion: string | null;
  fecha_ultima_entrada: string | null;
  fecha_ultima_salida: string | null;
  fecha_ultimo_movimiento: string | null;
  forma_publicacion: string | null;
  almacen_origen: string | null;
  ubicacion_estanteria_origen: string | null;
  peso: number | null;
  largo: number | null;
  ancho: number | null;
  alto: number | null;
  clave_importacion: string | null;
  datos_origen: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

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
  cajon: (Pick<CajonDesguace, "id" | "codigo" | "nombre" | "cantidad_piezas" | "capacidad_maxima" | "lleno"> & { contenido_busqueda?: string }) | null;
}

export interface EstanteriaPlanoAlmacen extends EstanteriaDesguace {
  huecos: HuecoPlanoAlmacen[];
}

export type TipoElementoPlanoAlmacen = "estanteria" | "zona_suelo";

export interface ElementoPlanoAlmacen {
  id: number | string;
  tipo: TipoElementoPlanoAlmacen;
  codigo_estanteria: string | null;
  nombre: string;
  x: number;
  y: number;
  ancho: number;
  alto: number;
  rotacion: 0 | 90;
  color: string;
  orden: number;
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
  tipo_pieza: TipoPiezaDesguace;
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
  codigo_recambio_facil: string | null;
  fecha_entrada: string;
  created_at: string;
  updated_at: string;
  fotos?: FotoDesguace[];
  iam?: DetallePiezaIam | null;
}

export type PiezaDesguaceInput = Partial<Omit<
  PiezaDesguace,
  "id" | "codigo_interno" | "created_at" | "updated_at" | "fotos" | "cajon" | "iam"
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

export type TipoEventoAlmacen =
  | "creacion_pieza"
  | "edicion_pieza"
  | "eliminacion_pieza"
  | "cambio_estado"
  | "cambio_proceso"
  | "cambio_ubicacion"
  | "cambio_cajon"
  | "cambio_online"
  | "foto"
  | "publicacion_rf"
  | "online_manual";

export interface EventoAlmacen {
  id: number;
  pieza_id: number | null;
  pieza_codigo: string;
  pieza_nombre: string | null;
  cajon_id: number | null;
  tipo_evento: TipoEventoAlmacen;
  accion: string;
  campos_cambiados: string[];
  valor_anterior: Record<string, unknown> | null;
  valor_nuevo: Record<string, unknown> | null;
  exito: boolean;
  detalle: string | null;
  error: string | null;
  origen: string;
  usuario_nombre: string;
  metadata: Record<string, unknown>;
  created_at: string;
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
  contenido_busqueda?: string;
  piezas?: PiezaDesguace[];
  movimientos?: MovimientoCajon[];
}
