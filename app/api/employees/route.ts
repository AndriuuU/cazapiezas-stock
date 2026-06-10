import { NextResponse } from "next/server";
import { getSupabaseRestConfig } from "@/lib/supabase";

const EMPLOYEES_REFERENCE = "__EMPLOYEES__";
const DEFAULT_EMPLOYEES = ["Empleado"];

interface EmployeeConfigRow {
  name: string;
}

function normalizeEmployees(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((employee) => String(employee).trim())
    .filter(Boolean)
    .filter((employee, index, employees) => employees.indexOf(employee) === index);
}

function getSupabaseHeaders(anonKey: string) {
  return {
    apikey: anonKey,
    Authorization: `Bearer ${anonKey}`,
    "Content-Type": "application/json",
  };
}

export async function GET() {
  try {
    const { url, anonKey } = getSupabaseRestConfig();
    const response = await fetch(
      `${url}/rest/v1/stock_adjustments?select=name&reference=eq.${EMPLOYEES_REFERENCE}&order=created_at.desc&limit=1`,
      {
        headers: getSupabaseHeaders(anonKey),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ employees: DEFAULT_EMPLOYEES });
    }

    const rows = (await response.json()) as EmployeeConfigRow[];
    const config = rows[0]?.name ? JSON.parse(rows[0].name) : null;
    const employees = normalizeEmployees(config?.employees);

    return NextResponse.json({
      employees: employees.length > 0 ? employees : DEFAULT_EMPLOYEES,
    });
  } catch {
    return NextResponse.json({ employees: DEFAULT_EMPLOYEES });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const employees = normalizeEmployees(body.employees);

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "Añade al menos un empleado" },
        { status: 400 }
      );
    }

    const { url, anonKey } = getSupabaseRestConfig();
    const response = await fetch(`${url}/rest/v1/stock_adjustments?select=*`, {
      method: "POST",
      headers: {
        ...getSupabaseHeaders(anonKey),
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        material_id: EMPLOYEES_REFERENCE,
        reference: EMPLOYEES_REFERENCE,
        name: JSON.stringify({ employees }),
        quantity_before: 0,
        quantity_after: 0,
        difference: 0,
        status: "completed",
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null);
      throw new Error(errorBody?.message || `Supabase error ${response.status}`);
    }

    return NextResponse.json({ employees });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Error desconocido";

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
