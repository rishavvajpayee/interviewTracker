import { NextResponse } from "next/server";
import { loadDashboardState } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json(await loadDashboardState());
}
