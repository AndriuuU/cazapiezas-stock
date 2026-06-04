import axios from "axios";
import { NextResponse } from "next/server";

const tallergpClient = axios.create({
  baseURL: process.env.TALLERGP_URL || process.env.NEXT_PUBLIC_TALLERGP_URL,
  headers: {
    Authorization: `Bearer ${
      process.env.TALLERGP_TOKEN || process.env.NEXT_PUBLIC_TALLERGP_TOKEN
    }`,
    "Content-Type": "application/json",
  },
});

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

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reference = String(body.reference || "").trim().toUpperCase();
    const description = String(body.description || body.name || "").trim();

    if (!reference || !description) {
      return NextResponse.json(
        { error: "Referencia y descripcion son obligatorias" },
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

    return NextResponse.json(response.data, { status: 201 });
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status || 502 : 500;

    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
