import { NextResponse } from "next/server";
import { deleteOffer } from "@/lib/db";

export const runtime = "nodejs";

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteOffer(id);
  return NextResponse.json({ ok: true });
}
