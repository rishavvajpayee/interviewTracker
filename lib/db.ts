import { neon } from "@neondatabase/serverless";
import type { Candidate, DashboardState, EodReport, Offer } from "./types";

type Sql = ReturnType<typeof neon>;

let sqlSingleton: Sql | null = null;
let bootstrapPromise: Promise<void> | null = null;

function getConnectionString(): string {
  const url = process.env.DATABASE_URL?.trim() || process.env.POSTGRES_URL?.trim();
  if (!url) {
    throw new Error(
      "Set DATABASE_URL (or POSTGRES_URL) to your Neon PostgreSQL connection string, e.g. postgresql://user:pass@host/neondb?sslmode=require",
    );
  }
  return url;
}

function getSql(): Sql {
  if (!sqlSingleton) {
    sqlSingleton = neon(getConnectionString());
  }
  return sqlSingleton;
}

function num(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v);
}

/** Neon `sql` return type is a broad union; we always use default row objects. */
function asRowObjects(r: unknown): Record<string, unknown>[] {
  return r as Record<string, unknown>[];
}

async function ensureSchema(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      const sql = getSql();

      await sql`
        CREATE TABLE IF NOT EXISTS candidates (
          id SERIAL PRIMARY KEY,
          "date" TEXT NOT NULL,
          candidate TEXT NOT NULL,
          dept TEXT NOT NULL,
          role TEXT NOT NULL,
          source TEXT NOT NULL,
          owner TEXT NOT NULL,
          status TEXT NOT NULL,
          rating DOUBLE PRECISION,
          notes TEXT NOT NULL DEFAULT '',
          location TEXT NOT NULL DEFAULT ''
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS offers (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          role TEXT NOT NULL,
          dept TEXT NOT NULL,
          status TEXT NOT NULL,
          offerdate TEXT,
          joindate TEXT,
          notes TEXT
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS eod_reports (
          id SERIAL PRIMARY KEY,
          "date" TEXT NOT NULL,
          recruiter TEXT NOT NULL,
          location TEXT,
          payload TEXT NOT NULL,
          UNIQUE (recruiter, "date")
        )
      `;

      await sql`
        CREATE TABLE IF NOT EXISTS hiring_targets (
          role TEXT PRIMARY KEY,
          target INTEGER NOT NULL DEFAULT 0,
          location TEXT NOT NULL DEFAULT ''
        )
      `;
    })();
  }
  return bootstrapPromise;
}

function mapCandidateRow(row: Record<string, unknown>): Candidate {
  const r = row;
  return {
    id: num(r.id),
    date: String(r.date ?? ""),
    candidate: String(r.candidate ?? ""),
    dept: String(r.dept ?? ""),
    role: String(r.role ?? ""),
    source: String(r.source ?? ""),
    owner: String(r.owner ?? ""),
    status: String(r.status ?? ""),
    rating: r.rating === null || r.rating === undefined || r.rating === "" ? null : Number(r.rating),
    notes: String(r.notes ?? ""),
    location: String(r.location ?? ""),
  };
}

function mapOfferRow(row: Record<string, unknown>): Offer {
  const r = row;
  return {
    id: num(r.id),
    name: String(r.name ?? ""),
    role: String(r.role ?? ""),
    dept: String(r.dept ?? ""),
    status: String(r.status ?? ""),
    offerdate: String(r.offerdate ?? ""),
    joindate: String(r.joindate ?? ""),
    notes: String(r.notes ?? ""),
  };
}

export async function loadDashboardState(): Promise<DashboardState> {
  await ensureSchema();
  const sql = getSql();

  const candRows = asRowObjects(
    await sql`
    SELECT id, "date", candidate, dept, role, source, owner, status, rating, notes, location
    FROM candidates
    ORDER BY "date" DESC, id DESC
  `,
  );
  const candidates = candRows.map(mapCandidateRow);

  const offRows = asRowObjects(
    await sql`
    SELECT id, name, role, dept, status, offerdate, joindate, notes
    FROM offers
    ORDER BY id
  `,
  );
  const offers = offRows.map(mapOfferRow);

  const eodRows = asRowObjects(
    await sql`
    SELECT id, "date", recruiter, location, payload
    FROM eod_reports
    ORDER BY "date" DESC, id DESC
  `,
  );
  const eodReports: EodReport[] = eodRows.map((row) => {
    const p = JSON.parse(String(row.payload ?? "{}")) as Omit<EodReport, "id" | "date" | "recruiter" | "location">;
    return {
      id: num(row.id),
      date: String(row.date ?? ""),
      recruiter: String(row.recruiter ?? ""),
      location: String(row.location ?? ""),
      ...p,
    };
  });

  const htRows = asRowObjects(await sql`SELECT role, target, location FROM hiring_targets`);
  const hiringTargets: Record<string, { target: number; location: string }> = {};
  for (const row of htRows) {
    hiringTargets[String(row.role)] = {
      target: num(row.target),
      location: String(row.location ?? ""),
    };
  }

  return { candidates, offers, eodReports, hiringTargets };
}

export async function deleteOffer(id: number): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM offers WHERE id = ${id}`;
}

export async function upsertEodReport(entry: {
  date: string;
  recruiter: string;
  location: string;
  payload: string;
}): Promise<number> {
  await ensureSchema();
  const sql = getSql();
  const rows = asRowObjects(
    await sql`
    INSERT INTO eod_reports ("date", recruiter, location, payload)
    VALUES (${entry.date}, ${entry.recruiter}, ${entry.location}, ${entry.payload})
    ON CONFLICT (recruiter, "date") DO UPDATE SET
      location = EXCLUDED.location,
      payload = EXCLUDED.payload
    RETURNING id
  `,
  );
  const row = rows[0];
  return row ? num(row.id) : 0;
}

export async function deleteEodReport(id: number): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM eod_reports WHERE id = ${id}`;
}

export async function replaceHiringTargets(
  targets: Record<string, { target: number; location: string }>,
): Promise<void> {
  await ensureSchema();
  const sql = getSql();
  await sql`DELETE FROM hiring_targets`;
  for (const [role, v] of Object.entries(targets)) {
    await sql`
      INSERT INTO hiring_targets (role, target, location)
      VALUES (${role}, ${v.target ?? 0}, ${v.location ?? ""})
    `;
  }
}
