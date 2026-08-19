import { NextResponse } from "next/server";
import { protectAdminApiRequest, protectApiRequest } from "@/lib/request-security";
import { getSupabaseApiConfig, supabaseHeaders } from "@/lib/supabase-rest";

const EMPLOYEES_REFERENCE = "__EMPLOYEES__";
const DEFAULT_EMPLOYEES = ["Andrés", "Santi", "Fran"];

interface EmployeeConfigRow {
  name: string;
}

function normalizeEmployees(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  const seen = new Set<string>();
  return value
    .map((employee) => String(employee).trim().replace(/\s+/g, " ").slice(0, 100))
    .filter(Boolean)
    .filter((employee) => {
      const key = employee.toLocaleLowerCase("es");
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 50);
}

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, {
    keyPrefix: "employees:get",
    limit: 60,
    windowMs: 60 * 1000,
  });

  if (guard) {
    return guard;
  }

  try {
    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(
      `${url}/rest/v1/stock_adjustments?select=name&reference=eq.${EMPLOYEES_REFERENCE}&order=created_at.desc&limit=1`,
      {
        headers: supabaseHeaders(key),
      }
    );

    if (!response.ok) {
      return NextResponse.json({ employees: DEFAULT_EMPLOYEES });
    }

    const rows = (await response.json()) as EmployeeConfigRow[];
    const config = rows[0]?.name ? JSON.parse(rows[0].name) : null;
    const employees = normalizeEmployees(config?.employees);
    const onlyLegacyPlaceholder = employees.length === 1 && employees[0].toLocaleLowerCase("es") === "empleado";

    return NextResponse.json({
      employees: employees.length > 0 && !onlyLegacyPlaceholder ? employees : DEFAULT_EMPLOYEES,
    });
  } catch {
    return NextResponse.json({ employees: DEFAULT_EMPLOYEES });
  }
}

export async function POST(request: Request) {
  const guard = await protectAdminApiRequest(request, {
    keyPrefix: "employees:write",
    limit: 15,
    windowMs: 60 * 1000,
  });

  if (guard) {
    return guard;
  }

  try {
    const body = await request.json();
    const employees = normalizeEmployees(body.employees);

    if (employees.length === 0) {
      return NextResponse.json(
        { error: "Añade al menos un empleado" },
        { status: 400 }
      );
    }

    const { url, key } = getSupabaseApiConfig();
    const response = await fetch(`${url}/rest/v1/stock_adjustments?select=*`, {
      method: "POST",
      headers: {
        ...supabaseHeaders(key),
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
