// app/api/adjustments/route.ts
import { NextResponse } from "next/server";
import axios from "axios";

interface StockAdjustment {
  id?: string;
  material_id: string;
  reference: string;
  name: string;
  quantity_before: number;
  quantity_after: number;
  difference: number;
  status: string;
  barcode?: string;
  material_name?: string;
  deleted_from_tallergp?: boolean;
}

const EMPLOYEES_REFERENCE = "__EMPLOYEES__";
const EMPLOYEE_PREFIX = "[EMPLEADO: ";
const PRODUCT_CREATED_PREFIX = "[PRODUCTO NUEVO] ";
const PRODUCT_BARCODE_SUFFIX_PATTERN = /\s*\[CODIGO: ([^\]]+)\]\s*$/;

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
    const responseError = error.response?.data?.error;
    const responseMessage = error.response?.data?.message;

    return responseError || responseMessage || error.message;
  }

  return error instanceof Error ? error.message : "Error desconocido";
}

function getSupabaseConfig() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error("Faltan las variables de entorno de Supabase");
  }

  return { url, key };
}

async function requestSupabase<T>(path: string, init: RequestInit = {}) {
  const { url, key } = getSupabaseConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || `Supabase error ${response.status}`);
  }

  return (await response.json()) as T;
}

async function insertAdjustment(adjustment: StockAdjustment) {
  return requestSupabase<StockAdjustment[]>(
    "stock_adjustments?select=*",
    {
      method: "POST",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify(adjustment),
    }
  );
}

async function getLatestAdjustments() {
  return requestSupabase<StockAdjustment[]>(
    `stock_adjustments?select=*&reference=neq.${EMPLOYEES_REFERENCE}&order=created_at.desc&limit=100`
  );
}

async function fetchMaterialsByLookupKey() {
  const materialsByKey = new Map<string, { barcode?: string; name?: string }>();
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const response = await tallergpClient.get("/materials", {
      params: {
        page,
        per_page: 100,
      },
    });
    const materials = response.data.data || response.data || [];

    for (const material of materials) {
      const barcode = String(
        material.barcode || material.ean || material.serial_number || ""
      ).trim();
      const name = String(material.name || material.description || "").trim();

      for (const key of [material.material_id, material.reference]) {
        const lookupKey = String(key || "").trim();

        if (lookupKey) {
          materialsByKey.set(lookupKey, {
            barcode: barcode || undefined,
            name: name || undefined,
          });
        }
      }
    }

    if (response.data.pagination) {
      hasMorePages = page < response.data.pagination.total_pages;
    } else {
      hasMorePages = materials.length === 100;
    }

    page++;
  }

  return materialsByKey;
}

function isProductCreated(item: StockAdjustment) {
  return item.status === "created" || item.name?.startsWith(PRODUCT_CREATED_PREFIX);
}

function getSnapshotBarcode(name: string) {
  return name.match(PRODUCT_BARCODE_SUFFIX_PATTERN)?.[1] || "";
}

async function updateAdjustmentStatus(id: string, status: string) {
  return requestSupabase<StockAdjustment[]>(
    `stock_adjustments?id=eq.${encodeURIComponent(id)}&select=*`,
    {
      method: "PATCH",
      headers: {
        Prefer: "return=representation",
      },
      body: JSON.stringify({ status }),
    }
  );
}

// Registra un nuevo ajuste y aplica el stock total en TallerGP.
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      material_id,
      reference,
      name,
      quantity_before,
      quantity_after,
      employee_name,
    } = body;
    const nextQuantity = Number(quantity_after);
    const previousQuantity = Number(quantity_before);
    const employeeName = String(employee_name || "").trim();

    if (!material_id || !Number.isFinite(nextQuantity) || nextQuantity < 0) {
      return NextResponse.json(
        { error: "Datos de stock invalidos" },
        { status: 400 }
      );
    }

    if (!employeeName) {
      return NextResponse.json(
        { error: "Selecciona quién ha cogido el material" },
        { status: 400 }
      );
    }

    const difference = nextQuantity - previousQuantity;

    if (difference === 0) {
      return NextResponse.json(
        { message: "No changes detected" },
        { status: 400 }
      );
    }

    const movementResponse = await tallergpClient.post(
      `/materials/${material_id}/movements`,
      {
        quantity: nextQuantity,
      }
    );

    const data = await insertAdjustment({
      material_id,
      reference,
      name: `${EMPLOYEE_PREFIX}${employeeName}] ${name}`,
      quantity_before: previousQuantity,
      quantity_after: nextQuantity,
      difference,
      status: "completed",
    });

    return NextResponse.json(
      {
        ...data[0],
        tallergp_movement: movementResponse.data,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status || 502 : 500;

    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}

// Obtiene los ultimos movimientos guardados.
export async function GET() {
  try {
    const data = await getLatestAdjustments();
    const materialsByKey = await fetchMaterialsByLookupKey();
    const enrichedData = data.map((item) => {
      const material =
        materialsByKey.get(String(item.material_id || "")) ||
        materialsByKey.get(String(item.reference || ""));
      const snapshotBarcode = getSnapshotBarcode(item.name || "");
      const created = isProductCreated(item);

      return {
        ...item,
        barcode: material?.barcode || snapshotBarcode || undefined,
        material_name: material?.name,
        deleted_from_tallergp: created && !material,
      };
    });

    return NextResponse.json(enrichedData);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const { id, status } = await request.json();

    const data = await updateAdjustmentStatus(id, status);

    return NextResponse.json(data[0]);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
