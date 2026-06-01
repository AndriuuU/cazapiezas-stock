// src/types/material.ts

export interface StockMovement {
  id: string;
  movement_date: string;
  quantity: number;
  entry_id: string | null;
  sales_delivery_note_id: string | null;
  invoice_id: string | null;
  ticket_id: string | null;
  purchase_delivery_note_id: string | null;
  description: string | null;
}

export interface Material {
  material_id: string;
  reference: string;
  serial_number: string | null;
  name: string;
  quantity: number;
  cost: number;
  pvp: number;
  alert_threshold: number | null;
  discount1: number;
  discount2: number;
  margin: number;
  tax_rate: number;
  stock_movements: StockMovement[];
  photos: string[];
}
