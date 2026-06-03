export interface Material {
  material_id: string;
  reference: string;
  name: string;
  description?: string;
  barcode?: string; // Código de barras EAN-13
  ean?: string; // Código EAN (puede ser igual a barcode)
  serial_number?: string; // Número de serie
  quantity: number;
  unit?: string;
  pvp?: number; // Precio de venta al público
  cost?: number; // Coste
  iva?: number; // IVA
  photos?: Photo[];
  stock_movements?: StockMovement[];
  created_at?: string;
  updated_at?: string;
  // Campos adicionales que tu API pueda tener
  [key: string]: any;
}

export interface Photo {
  id: string;
  url: string;
  thumbnail?: string;
}

export interface StockMovement {
  id: string;
  type: "entrada" | "salida" | "ajuste" | "inventario";
  quantity: number;
  reason?: string;
  date: string;
  created_by?: string;
  notes?: string;
}

export interface SearchResult {
  material: Material;
  matchType: "barcode" | "reference" | "serial" | "ean" | "name" | "description";
  confidence: "exact" | "partial";
}