// src/types/material.ts

export interface Material {
  material_id: string;
  reference: string;
  serial_number: string | null;
  name: string;
  quantity: number;
  pvp: number;
}