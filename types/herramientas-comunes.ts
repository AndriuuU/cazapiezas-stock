// "reparacion" se conserva solo para poder leer datos antiguos hasta aplicar
// la migración que lo transforma definitivamente en "perdida".
export type EstadoHerramienta = "disponible" | "prestada" | "perdida" | "reparacion";

export interface FotoHerramientaComun {
  id: number;
  herramienta_id: number;
  url: string;
  storage_path: string | null;
  tipo: "inicial" | "actualizacion";
  created_at: string;
}

export interface FilaEstanteriaHerramientas {
  nivel: number;
  nombre: string;
  tipo: "balda" | "colgador";
  columnas: number;
  altura: number;
}

export interface ConfiguracionEstanteriaHerramientas {
  filas: FilaEstanteriaHerramientas[];
}

export interface EstanteriaHerramientas {
  id: number;
  codigo: string;
  nombre: string;
  zona: string;
  niveles: number;
  orden: number;
  activa: boolean;
  configuracion: ConfiguracionEstanteriaHerramientas;
}

export interface HerramientaComun {
  id: number;
  codigo: string;
  qr_token?: string;
  nombre: string;
  categoria: string | null;
  marca: string | null;
  descripcion: string | null;
  solo_localizacion: boolean;
  espacio_ocupado: string | null;
  foto_url: string | null;
  estanteria_id: number | null;
  nivel: number | null;
  posicion: string | null;
  estado: EstadoHerramienta;
  empleado_actual: string | null;
  vehiculo_actual: string | null;
  retirada_at: string | null;
  created_at: string;
  updated_at: string;
  archivada: boolean;
  archivada_at: string | null;
  archivada_por: string | null;
  motivo_archivo: string | null;
  incidencia_abierta_tipo: TipoIncidenciaHerramienta | null;
  incidencia_abierta_detalle: string | null;
  incidencia_abierta_at: string | null;
  estanteria?: EstanteriaHerramientas | null;
  fotos?: FotoHerramientaComun[];
}

export interface MovimientoHerramienta {
  id: number;
  herramienta_id: number;
  tipo: "alta" | "retirada" | "devolucion" | "cambio_estado" | "cambio_ubicacion" | "edicion" | "foto" | "incidencia" | "incidencia_resuelta" | "archivo" | "restauracion";
  empleado: string | null;
  vehiculo: string | null;
  estado_anterior: EstadoHerramienta | null;
  estado_nuevo: EstadoHerramienta;
  detalle: string | null;
  incidencia_tipo: TipoIncidenciaHerramienta | null;
  foto_url: string | null;
  storage_path: string | null;
  created_at: string;
}

export type TipoIncidenciaHerramienta = "falta_pieza" | "danada" | "revision";
