import { NextResponse } from "next/server";
import { replaceHiringTargets } from "@/lib/db";

export const runtime = "nodejs";

export async function PUT(req: Request) {
  const body = (await req.json()) as {
    targets?: Record<string, { target: number; location: string }>;
  };
  if (!body?.targets || typeof body.targets !== "object") {
    return NextResponse.json({ error: "targets object required" }, { status: 400 });
  }
  await replaceHiringTargets(body.targets);
  return NextResponse.json({ ok: true });
}
