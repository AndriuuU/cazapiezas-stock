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
  estanteria?: EstanteriaHerramientas | null;
  fotos?: FotoHerramientaComun[];
}

export interface MovimientoHerramienta {
  id: number;
  herramienta_id: number;
  tipo: "alta" | "retirada" | "devolucion" | "cambio_estado" | "cambio_ubicacion";
  empleado: string | null;
  vehiculo: string | null;
  estado_anterior: EstadoHerramienta | null;
  estado_nuevo: EstadoHerramienta;
  detalle: string | null;
  created_at: string;
}
