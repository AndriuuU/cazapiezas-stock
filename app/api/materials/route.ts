import axios from "axios";
import { NextResponse } from "next/server";
import { createInternalEan13 } from "@/lib/barcodes";
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
const PRODUCT_BARCODE_SUFFIX_PREFIX = " [CODIGO: ";
const PRODUCT_SNAPSHOT_SUFFIX_PREFIX = " [FICHA: ";
const PRODUCT_KEYS_CACHE_MS = 5 * 60 * 1000;
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
