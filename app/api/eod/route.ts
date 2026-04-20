import { NextResponse } from "next/server";
import { deleteEodReport, upsertEodReport } from "@/lib/db";

export const runtime = "nodejs";

type Body = {
  date: string;
  recruiter: string;
  location: string;
  resumeShortlisting: object;
  screeningCalls: object;
  virtualRounds: object;
  assignment: object;
  finalRound: object;
  otherTasks: string;
  submittedAt: string;
};

export async function POST(req: Request) {
  const body = (await req.json()) as Body;
  if (!body?.date || !body?.recruiter) {
    return NextResponse.json({ error: "date and recruiter required" }, { status: 400 });
  }
  const payload = JSON.stringify({
    resumeShortlisting: body.resumeShortlisting,
    screeningCalls: body.screeningCalls,
    virtualRounds: body.virtualRounds,
    assignment: body.assignment,
    finalRound: body.finalRound,
    otherTasks: body.otherTasks ?? "",
    submittedAt: body.submittedAt ?? "",
  });
  const id = await upsertEodReport({
    date: body.date,
    recruiter: body.recruiter,
    location: body.location ?? "",
    payload,
  });
  return NextResponse.json({ ok: true, id });
}

export async function DELETE(req: Request) {
  const id = Number(new URL(req.url).searchParams.get("id"));
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }
  await deleteEodReport(id);
  return NextResponse.json({ ok: true });
}
