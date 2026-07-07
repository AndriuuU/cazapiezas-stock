import axios from "axios";
import { NextResponse } from "next/server";
import { createInternalEan13 } from "@/lib/barcodes";
import { getSupabaseRestConfig } from "@/lib/supabase";

const tallergpClient = axios.create({
  baseURL: process.env.TALLERGP_URL,
  headers: {
    Authorization: `Bearer ${process.env.TALLERGP_TOKEN}`,
    "Content-Type": "application/json",
  },
});

const PRODUCT_CREATED_PREFIX = "[PRODUCTO NUEVO] ";
const PRODUCT_BARCODE_SUFFIX_PREFIX = " [CODIGO: ";
const PRODUCT_SNAPSHOT_SUFFIX_PREFIX = " [FICHA: ";
const PRODUCT_KEYS_CACHE_MS = 5 * 60 * 1000;
const MATERIALS_PER_PAGE = 100;
let productKeysCache:
  | {
      fetchedAt: number;
      data: {
        barcodes: Set<string>;
        references: Set<string>;
      };
    }
  | undefined;

interface ProductSnapshot {
  reference: string;
  name: string;
  barcode: string;
  quantity: number;
  cost?: number;
  pvp?: number;
  tax_rate: number;
  alert_threshold: number;
  created_at: string;
}

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

function normalizeMaterialListResponse(data: unknown) {
  const response = data as {
    data?: unknown[];
    pagination?: { total_pages?: number; page?: number; total?: number };
  };

  return {
    materials: Array.isArray(response.data)
      ? response.data
      : Array.isArray(data)
        ? data
        : [],
    pagination: response.pagination,
  };
}

async function fetchAllMaterials() {
  const allMaterials: Record<string, unknown>[] = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const response = await tallergpClient.get("/materials", {
      params: {
        page,
        per_page: MATERIALS_PER_PAGE,
      },
    });
    const { materials, pagination } = normalizeMaterialListResponse(response.data);

    allMaterials.push(...(materials as Record<string, unknown>[]));

    if (pagination?.total_pages) {
      hasMorePages = page < pagination.total_pages;
    } else {
      hasMorePages = materials.length === MATERIALS_PER_PAGE;
    }

    page++;
  }

  return allMaterials;
}

function getMaterialSearchText(material: Record<string, unknown>) {
  return [
    material.reference,
    material.name,
    material.description,
    material.barcode,
    material.ean,
    material.serial_number,
    material.material_id,
  ]
    .map((value) => String(value || "").toLowerCase())
    .join(" ");
}

function toOptionalNumber(value: unknown) {
  if (value === "" || value === null || value === undefined) {
    return undefined;
  }

  const numberValue = Number(value);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}

function compactPayload(payload: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(payload).filter(([, value]) => value !== undefined)
  );
}

async function updateMaterial(materialId: string, payload: Record<string, unknown>) {
  if (Object.keys(payload).length === 0) {
    return undefined;
  }

  const response = await tallergpClient.put(`/materials/${materialId}`, payload);

  return response.data;
}

async function registerAdminStockAdjustment(material: {
  material_id: string;
  reference: string;
  name: string;
  quantity_before: number;
  quantity_after: number;
}) {
  const { url, anonKey } = getSupabaseRestConfig();
  const difference = material.quantity_after - material.quantity_before;

  if (difference === 0) {
    return undefined;
  }

  const response = await fetch(`${url}/rest/v1/stock_adjustments?select=*`, {
    method: "POST",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${anonKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({
      material_id: material.material_id,
      reference: material.reference,
      name: `[ADMIN] ${material.name}`,
      quantity_before: material.quantity_before,
      quantity_after: material.quantity_after,
      difference,
      status: "completed",
    }),
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.message || `Supabase error ${response.status}`);
  }

  return response.json();
}

async function registerProductCreatedEvent(material: {
  material_id?: string;
  reference: string;
  name: string;
  quantity: number;
  barcode?: string;
  snapshot?: ProductSnapshot;
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
  const nameWithBarcode = material.barcode
    ? `${material.name}${PRODUCT_BARCODE_SUFFIX_PREFIX}${material.barcode}]`
    : material.name;
  const snapshotSuffix = material.snapshot
    ? `${PRODUCT_SNAPSHOT_SUFFIX_PREFIX}${Buffer.from(
        JSON.stringify(material.snapshot),
        "utf8"
      )
        .toString("base64")
        .replaceAll("+", "-")
        .replaceAll("/", "_")
        .replaceAll("=", "")}]`
    : "";
  const nameWithSnapshot = `${nameWithBarcode}${snapshotSuffix}`;

  try {
    return await insertEvent("pending", `${PRODUCT_CREATED_PREFIX}${nameWithSnapshot}`);
  } catch {
    return insertEvent("completed", `${PRODUCT_CREATED_PREFIX}${nameWithSnapshot}`);
  }
}

function materialHasBarcode(material: Record<string, unknown>, barcode: string) {
  return (
    material.barcode === barcode ||
    material.ean === barcode ||
    material.serial_number === barcode
  );
}

async function fetchExistingProductKeys() {
  if (
    productKeysCache &&
    Date.now() - productKeysCache.fetchedAt < PRODUCT_KEYS_CACHE_MS
  ) {
    return productKeysCache.data;
  }

  const barcodes = new Set<string>();
  const references = new Set<string>();
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
      const reference = String(material?.reference || "").trim().toUpperCase();

      if (reference) {
        references.add(reference);
      }

      for (const key of ["barcode", "ean", "serial_number"]) {
        const value = String(material?.[key] || "").trim();

        if (value) {
          barcodes.add(value);
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

  const data = { barcodes, references };

  productKeysCache = {
    fetchedAt: Date.now(),
    data,
  };

  return data;
}

async function getExistingProductKeys() {
  try {
    return await fetchExistingProductKeys();
  } catch (error) {
    if (productKeysCache) {
      console.error("Using stale product keys cache after TallerGP error:", error);
      return productKeysCache.data;
    }

    if (axios.isAxiosError(error) && error.response?.status === 429) {
      throw new Error(
        "TallerGP ha limitado temporalmente las peticiones. Espera un minuto y vuelve a registrar el producto."
      );
    }

    throw error;
  }
}

function generateUniqueInternalBarcode(existingBarcodes: Set<string>) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const barcode = createInternalEan13();

    if (!existingBarcodes.has(barcode)) {
      return barcode;
    }
  }

  throw new Error("No se pudo generar un codigo de barras unico");
}

async function fetchMaterialMovements(materialId: string) {
  const allMovements: Record<string, unknown>[] = [];
  let page = 1;
  let hasMorePages = true;

  while (hasMorePages) {
    const response = await tallergpClient.get(`/materials/${materialId}/movements`, {
      params: {
        page,
        per_page: 100,
      },
    });
    const movements = response.data.data || response.data || [];
    const pagination = response.data.pagination;

    allMovements.push(...movements);

    if (pagination?.total_pages) {
      hasMorePages = page < pagination.total_pages;
    } else {
      hasMorePages = movements.length === 100;
    }

    page++;
  }

  return allMovements;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const materialId = searchParams.get("material_id")?.trim();
    const movements = searchParams.get("movements") === "true";
    const all = searchParams.get("all") === "true";

    if (materialId && movements) {
      return NextResponse.json(await fetchMaterialMovements(materialId));
    }

    if (materialId) {
      const response = await tallergpClient.get(`/materials/${materialId}`);

      return NextResponse.json(response.data);
    }

    if (all) {
      return NextResponse.json(await fetchAllMaterials());
    }

    const query = searchParams.get("q")?.trim().toLowerCase() || "";
    const stock = searchParams.get("stock") || "all";
    const page = Math.max(1, Number(searchParams.get("page") || 1));
    const perPage = Math.min(100, Math.max(10, Number(searchParams.get("per_page") || 30)));
    const minStock = toOptionalNumber(searchParams.get("min_stock"));
    const maxStock = toOptionalNumber(searchParams.get("max_stock"));

    const allMaterials = await fetchAllMaterials();
    const filteredMaterials = allMaterials.filter((material) => {
      const quantity = Number(material.quantity ?? 0);
      const threshold = Number(material.alert_threshold ?? 2);
      const matchesQuery = query
        ? getMaterialSearchText(material).includes(query)
        : true;
      const matchesStock =
        stock === "out"
          ? quantity <= 0
          : stock === "low"
            ? quantity > 0 && quantity <= threshold
            : stock === "available"
              ? quantity > 0
              : true;
      const matchesMin = minStock === undefined || quantity >= minStock;
      const matchesMax = maxStock === undefined || quantity <= maxStock;

      return matchesQuery && matchesStock && matchesMin && matchesMax;
    });
    const start = (page - 1) * perPage;

    return NextResponse.json({
      data: filteredMaterials.slice(start, start + perPage),
      total: filteredMaterials.length,
      page,
      per_page: perPage,
      total_pages: Math.max(1, Math.ceil(filteredMaterials.length / perPage)),
    });
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status || 502 : 500;

    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}

export async function PUT(request: Request) {
  try {
    const body = await request.json();
    const materialId = String(body.material_id || "").trim();
    const nextQuantity = toOptionalNumber(body.quantity);
    const payload = compactPayload({
      description: body.description ?? body.name,
      serial_number: body.serial_number || body.barcode || body.ean || undefined,
      quantity: nextQuantity,
      cost: toOptionalNumber(body.cost),
      pvp: toOptionalNumber(body.pvp),
      tax_rate: toOptionalNumber(body.tax_rate ?? body.iva),
      alert_threshold: toOptionalNumber(body.alert_threshold),
      discount1: toOptionalNumber(body.discount1),
      discount2: toOptionalNumber(body.discount2),
      margin: toOptionalNumber(body.margin),
    });

    if (!materialId) {
      return NextResponse.json(
        { error: "Falta el ID del material" },
        { status: 400 }
      );
    }

    if (nextQuantity !== undefined && nextQuantity < 0) {
      return NextResponse.json(
        { error: "El stock no puede ser negativo" },
        { status: 400 }
      );
    }

    const previousDetailsResponse =
      nextQuantity === undefined
        ? undefined
        : await tallergpClient.get(`/materials/${materialId}`);
    const previousMaterial = previousDetailsResponse?.data || {};
    const previousQuantity = Number(previousMaterial.quantity ?? 0);
    const updateResult = await updateMaterial(materialId, payload);
    let detailsResponse = await tallergpClient.get(`/materials/${materialId}`);
    let updatedMaterial = detailsResponse.data || {};
    let stockFallbackUsed = false;

    if (
      nextQuantity !== undefined &&
      Number(updatedMaterial.quantity ?? 0) !== nextQuantity
    ) {
      await tallergpClient.post(`/materials/${materialId}/movements`, {
        quantity: nextQuantity,
      });
      stockFallbackUsed = true;
      detailsResponse = await tallergpClient.get(`/materials/${materialId}`);
      updatedMaterial = detailsResponse.data || {};
    }

    if (
      nextQuantity !== undefined &&
      Number(updatedMaterial.quantity ?? 0) !== nextQuantity
    ) {
      throw new Error(
        `TallerGP no devolvio el stock actualizado. Pedido: ${nextQuantity}. Actual: ${updatedMaterial.quantity ?? "-"}`
      );
    }
    let historyWarning: string | undefined;

    if (
      nextQuantity !== undefined &&
      Number.isFinite(previousQuantity) &&
      previousQuantity !== nextQuantity
    ) {
      try {
        await registerAdminStockAdjustment({
          material_id: materialId,
          reference: String(updatedMaterial.reference || previousMaterial.reference || ""),
          name: String(
            updatedMaterial.name ||
              updatedMaterial.description ||
              previousMaterial.name ||
              previousMaterial.description ||
              body.description ||
              body.name ||
              ""
          ),
          quantity_before: previousQuantity,
          quantity_after: nextQuantity,
        });
      } catch (historyError) {
        historyWarning = getErrorMessage(historyError);
      }
    }
    productKeysCache = undefined;

    return NextResponse.json({
      material: updatedMaterial,
      tallergp_update: updateResult,
      stock_fallback_used: stockFallbackUsed,
      history_warning: historyWarning,
    });
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status || 502 : 500;

    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const reference = String(body.reference || "").trim().toUpperCase();
    const description = String(body.description || body.name || "").trim();
    const requestedBarcode = String(body.serial_number || body.barcode || body.ean || "").trim();

    if (!reference || !description) {
      return NextResponse.json(
        { error: "Referencia y descripción son obligatorias" },
        { status: 400 }
      );
    }

    const existingKeys = await getExistingProductKeys();

    if (existingKeys.references.has(reference)) {
      return NextResponse.json(
        { error: "Esa referencia ya existe en otro producto" },
        { status: 409 }
      );
    }

    if (requestedBarcode && existingKeys.barcodes.has(requestedBarcode)) {
      return NextResponse.json(
        { error: "Ese codigo de barras ya existe en otro producto" },
        { status: 409 }
      );
    }

    const serialNumber = requestedBarcode || generateUniqueInternalBarcode(existingKeys.barcodes);
    const payload = {
      reference,
      description,
      serial_number: serialNumber,
      quantity: Number(body.quantity || 0),
      cost: body.cost === "" || body.cost === undefined ? undefined : Number(body.cost),
      pvp: body.pvp === "" || body.pvp === undefined ? undefined : Number(body.pvp),
      alert_threshold: Number(body.alert_threshold ?? 2),
      tax_rate: Number(body.tax_rate ?? 21),
    };

    const response = await tallergpClient.post("/materials", payload);
    productKeysCache = undefined;
    const createdMaterial = response.data || {};
    const createdBarcode =
      String(createdMaterial.barcode || createdMaterial.ean || createdMaterial.serial_number || "").trim() ||
      serialNumber;
    let historyWarning: string | undefined;

    if (!requestedBarcode && !materialHasBarcode(createdMaterial, serialNumber)) {
      historyWarning =
        "Se genero un codigo interno, pero TallerGP no lo devolvio en la ficha creada.";
    }

    try {
      const snapshot: ProductSnapshot = {
        reference: createdMaterial.reference || reference,
        name: createdMaterial.name || createdMaterial.description || description,
        barcode: createdBarcode,
        quantity: Number(createdMaterial.quantity ?? payload.quantity),
        cost: payload.cost,
        pvp: payload.pvp,
        tax_rate: payload.tax_rate,
        alert_threshold: payload.alert_threshold,
        created_at: new Date().toISOString(),
      };

      await registerProductCreatedEvent({
        material_id: createdMaterial.material_id,
        reference: snapshot.reference,
        name: snapshot.name,
        quantity: snapshot.quantity,
        barcode: createdBarcode,
        snapshot,
      });
    } catch (historyError) {
      historyWarning = getErrorMessage(historyError);
    }

    return NextResponse.json(
      {
        ...response.data,
        generated_barcode: requestedBarcode ? undefined : createdBarcode,
        history_warning: historyWarning,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const status = axios.isAxiosError(error) ? error.response?.status || 502 : 500;

    return NextResponse.json({ error: getErrorMessage(error) }, { status });
  }
}
