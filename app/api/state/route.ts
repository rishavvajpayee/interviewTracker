import { NextResponse } from "next/server";
import { loadDashboardState } from "@/lib/db";

export async function GET() {
  return NextResponse.json(loadDashboardState());
}
