import axios from "axios";
import { NextResponse } from "next/server";
import { getSupabaseRestConfig } from "@/lib/supabase";

const tallergpClient = axios.create({
  baseURL: process.env.TALLERGP_URL || process.env.NEXT_PUBLIC_TALLERGP_URL,
  headers: {
    Authorization: `Bearer ${
      process.env.TALLERGP_TOKEN || process.env.NEXT_PUBLIC_TALLERGP_TOKEN
    }`,
    "Content-Type": "application/json",
  },
});

const PRODUCT_CREATED_PREFIX = "[PRODUCTO NUEVO] ";

function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return (
      error.response?.data?.error ||
      error.response?.data?.message ||
      error.message
    );
  }

  return error instanceof Error ? error.message : "Error desconocido";
}

async function registerProductCreatedEvent(material: {
  material_id?: string;
  reference: string;
  name: string;
  quantity: number;
}) {
  const { url, anonKey } = getSupabaseRestConfig();

  const insertEvent = async (status: string, name: string) => {
    const response = await fetch(`${url}/rest/v1/stock_adjustments?select=*`, {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${anonKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        material_id: material.material_id || material.reference,
        reference: material.reference,
        name,
        quantity_before: 0,
        quantity_after: material.quantity,
        difference: material.quantity,
        status,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.message || `Supabase error ${response.status}`);
    }

    return response.json();
  };

  try {
    return await insertEvent("created", material.name);
  } catch {
    return insertEvent("completed", `${PRODUCT_CREATED_PREFIX}${material.name}`);
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reference = String(body.reference || "").trim().toUpperCase();
    const description = String(body.description || body.name || "").trim();

    if (!reference || !description) {
      return NextResponse.json(
        { error: "Referencia y descripción son obligatorias" },
        { status: 400 }
      );
    }

    const payload = {
      reference,
      description,
      serial_number: body.serial_number || undefined,
      quantity: Number(body.quantity || 0),
      cost: body.cost === "" || body.cost === undefined ? undefined : Number(body.cost),
      pvp: body.pvp === "" || body.pvp === undefined ? undefined : Number(body.pvp),
      alert_threshold: Number(body.alert_threshold ?? 2),
      tax_rate: Number(body.tax_rate ?? 21),
    };

    const response = await tallergpClient.post("/materials", payload);
    const createdMaterial = response.data || {};
    let historyWarning: string | undefined;

    try {
      await registerProductCreatedEvent({
        material_id: createdMaterial.material_id,
        reference: createdMaterial.reference || reference,
        name: createdMaterial.name || createdMaterial.description || description,
        quantity: Number(createdMaterial.quantity ?? payload.quantity),
      });
    } catch (historyError) {
      historyWarning = getErrorMessage(historyError);
    }

    return NextResponse.json(
      {
        ...response.data,
        history_warning: historyWarning,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status || 502 : 500;

    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
