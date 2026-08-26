// app/api/adjustments/route.ts
import { NextResponse } from "next/server";
import axios from "axios";
import { protectApiRequest } from "@/lib/request-security";
import { resolveActionActor } from "@/lib/action-actor";
import {
  getSupabaseApiConfig,
  parseSupabaseResponse,
  supabaseHeaders,
} from "@/lib/supabase-rest";

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
  product_snapshot?: ProductSnapshot;
}

interface ProductSnapshot {
  reference?: string;
  name?: string;
  description?: string;
  barcode?: string;
  quantity?: number;
  cost?: number;
  pvp?: number;
  tax_rate?: number;
  alert_threshold?: number;
  created_at?: string;
}

const EMPLOYEES_REFERENCE = "__EMPLOYEES__";
const EMPLOYEE_PREFIX = "[EMPLEADO: ";
const PRODUCT_CREATED_PREFIX = "[PRODUCTO NUEVO] ";
const PRODUCT_BARCODE_SUFFIX_PATTERN = /\s*\[CODIGO: ([^\]]+)\]\s*$/;
const PRODUCT_SNAPSHOT_SUFFIX_PATTERN = /\s*\[FICHA: ([^\]]+)\]\s*$/;
const MATERIALS_LOOKUP_CACHE_MS = 5 * 60 * 1000;
let materialsLookupCache:
  | {
      fetchedAt: number;
      data: Map<string, { barcode?: string; name?: string }>;
    }
  | undefined;

const tallergpClient = axios.create({
  baseURL: process.env.TALLERGP_URL,
  headers: {
    Authorization: `Bearer ${process.env.TALLERGP_TOKEN}`,
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

async function requestSupabase<T>(path: string, init: RequestInit = {}) {
  const { url, key } = getSupabaseApiConfig();
  const response = await fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: supabaseHeaders(key, init.headers as Record<string, string>),
  });

  return parseSupabaseResponse<T>(response);
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

async function getMaterialAdjustments(materialId: string, reference: string) {
  const filters = [
    materialId ? `material_id.eq.${materialId}` : "",
    reference ? `reference.eq.${reference}` : "",
  ].filter(Boolean);
  const filterQuery =
    filters.length > 0
      ? `&or=${encodeURIComponent(`(${filters.join(",")})`)}`
      : "";

  return requestSupabase<StockAdjustment[]>(
    `stock_adjustments?select=*&reference=neq.${EMPLOYEES_REFERENCE}${filterQuery}&order=created_at.desc&limit=500`
  );
}

async function fetchMaterialsByLookupKey() {
  if (
    materialsLookupCache &&
    Date.now() - materialsLookupCache.fetchedAt < MATERIALS_LOOKUP_CACHE_MS
  ) {
    return materialsLookupCache.data;
  }

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

  materialsLookupCache = {
    fetchedAt: Date.now(),
    data: materialsByKey,
  };

  return materialsByKey;
}

function isProductCreated(item: StockAdjustment) {
  return item.status === "created" || item.name?.startsWith(PRODUCT_CREATED_PREFIX);
}

function getSnapshotBarcode(name: string) {
  return (
    parseProductSnapshot(name)?.barcode ||
    name.match(PRODUCT_BARCODE_SUFFIX_PATTERN)?.[1] ||
    ""
  );
}

function parseProductSnapshot(name: string): ProductSnapshot | undefined {
  const match = name.match(PRODUCT_SNAPSHOT_SUFFIX_PATTERN);

  if (!match?.[1]) {
    return undefined;
  }

  try {
    const base64 = match[1].replaceAll("-", "+").replaceAll("_", "/");
    const paddedBase64 = base64.padEnd(
      base64.length + ((4 - (base64.length % 4)) % 4),
      "="
    );

    return JSON.parse(Buffer.from(paddedBase64, "base64").toString("utf8"));
  } catch {
    return undefined;
  }
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
  const guard = await protectApiRequest(request, {
    keyPrefix: "adjustments:write",
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (guard) {
    return guard;
  }

  try {
    const body = await request.json();
    const {
      material_id,
      reference,
      name,
      quantity_before,
      quantity_after,
      actor_user_id,
    } = body;
    const nextQuantity = Number(quantity_after);
    const previousQuantity = Number(quantity_before);
    const actor = await resolveActionActor(request, actor_user_id);
    const employeeName = actor?.nombre.trim() || "";

    if (!material_id || !Number.isFinite(nextQuantity) || nextQuantity < 0) {
      return NextResponse.json(
        { error: "Datos de stock invalidos" },
        { status: 400 }
      );
    }

    if (!employeeName) {
      return NextResponse.json(
        { error: "Selecciona quién ha cogido o cambiado el material" },
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

async function enrichAdjustments(data: StockAdjustment[]) {
  let materialsByKey = new Map<string, { barcode?: string; name?: string }>();
  let materialsLookupAvailable = true;

  try {
    materialsByKey = await fetchMaterialsByLookupKey();
  } catch (materialsError) {
    materialsLookupAvailable = false;
    console.error("Error enriching adjustments with TallerGP materials:", materialsError);
  }

  return data.map((item) => {
    const material =
      materialsByKey.get(String(item.material_id || "")) ||
      materialsByKey.get(String(item.reference || ""));
    const productSnapshot = parseProductSnapshot(item.name || "");
    const snapshotBarcode = getSnapshotBarcode(item.name || "");
    const created = isProductCreated(item);

    return {
      ...item,
      barcode: material?.barcode || snapshotBarcode || undefined,
      material_name: material?.name || productSnapshot?.name,
      deleted_from_tallergp: materialsLookupAvailable && created && !material,
      product_snapshot: productSnapshot,
    };
  });
}

// Obtiene los ultimos movimientos guardados o los de un material concreto.
export async function GET(request: Request) {
  const guard = await protectApiRequest(request, {
    keyPrefix: "adjustments:get",
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (guard) {
    return guard;
  }

  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get("material_id")?.trim() || "";
    const reference = searchParams.get("reference")?.trim() || "";
    const data =
      materialId || reference
        ? await getMaterialAdjustments(materialId, reference)
        : await getLatestAdjustments();
    const enrichedData = await enrichAdjustments(data);

    return NextResponse.json(enrichedData);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  const guard = await protectApiRequest(request, {
    keyPrefix: "adjustments:write",
    limit: 30,
    windowMs: 60 * 1000,
  });

  if (guard) {
    return guard;
  }

  try {
    const { id, status } = await request.json();

    const data = await updateAdjustmentStatus(id, status);

    return NextResponse.json(data[0]);
  } catch (error: unknown) {
    return NextResponse.json({ error: getErrorMessage(error) }, { status: 500 });
  }
}
