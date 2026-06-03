// app/api/adjustments/route.ts
import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";

// Registrar un nuevo ajuste (Móvil del empleado)
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { material_id, reference, name, quantity_before, quantity_after } = body;

    const difference = quantity_after - quantity_before;

    // Si no hay cambios reales, no registramos nada
    if (difference === 0) {
      return NextResponse.json({ message: "No changes detected" }, { status: 400 });
    }

    const { data, error } = await supabase
      .from("stock_adjustments")
      .insert([
        {
          material_id,
          reference,
          name,
          quantity_before,
          quantity_after,
          difference,
          status: "pending",
        },
      ])
      .select();

    if (error) throw error;

    return NextResponse.json(data[0], { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

// Obtener la lista de ajustes o actualizar estado (Tu PC)
export async function GET() {
  try {
    const { data, error } = await supabase
      .from("stock_adjustments")
      .select("*")
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (error) throw error;
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, status } = await request.json();

    const { data, error } = await supabase
      .from("stock_adjustments")
      .update({ status })
      .eq("id", id)
      .select();

    if (error) throw error;
    return NextResponse.json(data[0]);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}