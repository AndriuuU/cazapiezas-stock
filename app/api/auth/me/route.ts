import { NextResponse } from "next/server";
import { getRequestUser } from "@/lib/auth";
import { protectApiRequest } from "@/lib/request-security";

export async function GET(request: Request) {
  const guard = await protectApiRequest(request, { keyPrefix: "auth-me", limit: 100, windowMs: 60_000 });
  if (guard) return guard;
  return NextResponse.json({ user: await getRequestUser(request) });
}
