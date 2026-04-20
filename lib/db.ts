import fs from "fs";
import path from "path";
import Sqlite from "better-sqlite3";
import { createClient, type Client } from "@libsql/client";
import type { Candidate, DashboardState, EodReport, Offer } from "./types";
import { DEFAULT_HIRING_TARGETS } from "./constants";

/** better-sqlite3 merges class + namespace; use instance type for annotations */
type SqliteDb = InstanceType<typeof Sqlite>;

const DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS candidates (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      candidate TEXT NOT NULL,
      dept TEXT NOT NULL,
      role TEXT NOT NULL,
      source TEXT NOT NULL,
      owner TEXT NOT NULL,
      status TEXT NOT NULL,
      rating REAL,
      notes TEXT NOT NULL DEFAULT '',
      location TEXT NOT NULL DEFAULT ''
    )`,
  `CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      dept TEXT NOT NULL,
      status TEXT NOT NULL,
      offerdate TEXT,
      joindate TEXT,
      notes TEXT
    )`,
  `CREATE TABLE IF NOT EXISTS eod_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      recruiter TEXT NOT NULL,
      location TEXT,
      payload TEXT NOT NULL,
      UNIQUE(recruiter, date)
    )`,
  `CREATE TABLE IF NOT EXISTS hiring_targets (
      role TEXT PRIMARY KEY,
      target INTEGER NOT NULL DEFAULT 0,
      location TEXT NOT NULL DEFAULT ''
    )`,
];

function tursoConfigured(): boolean {
  return Boolean(process.env.TURSO_DATABASE_URL?.trim() && process.env.TURSO_AUTH_TOKEN?.trim());
}

function assertNotVercelWithoutTurso() {
  if (process.env.VERCEL && !tursoConfigured()) {
    throw new Error(
      "Vercel needs Turso: set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN on the project (https://turso.tech). Local file SQLite does not run on serverless.",
    );
  }
}

let libsqlClient: Client | null = null;
function getLibsql(): Client {
  if (!libsqlClient) {
    const url = process.env.TURSO_DATABASE_URL!;
    const authToken = process.env.TURSO_AUTH_TOKEN!;
    libsqlClient = createClient({ url, authToken });
  }
  return libsqlClient;
}

let dbInstance: SqliteDb | null = null;

function dbPath() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "interviewtrack.db");
}

function getLocalDb(): SqliteDb {
  assertNotVercelWithoutTurso();
  if (dbInstance) return dbInstance;
  dbInstance = new Sqlite(dbPath());
  for (const sql of DDL_STATEMENTS) {
    dbInstance.exec(sql);
  }
  seedIfEmptyLocal(dbInstance);
  return dbInstance;
}

function num(v: unknown): number {
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "number") return v;
  return Number(v);
}

let libsqlBootstrap: Promise<void> | null = null;

function ensureLibsqlSchemaAndSeed(client: Client): Promise<void> {
  if (!libsqlBootstrap) {
    libsqlBootstrap = (async () => {
      for (const sql of DDL_STATEMENTS) {
        await client.execute(sql);
      }

      const cntRes = await client.execute("SELECT COUNT(*) AS c FROM candidates");
      const first = cntRes.rows[0] as Record<string, unknown> | undefined;
      const c = first ? num(first.c ?? first.C) : 0;
      if (c > 0) return;

      const rawC = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "lib", "seed-candidates.json"), "utf8"),
  ) as Array<{
    date: string;
    candidate: string;
    dept: string;
    role: string;
    source: string;
    owner: string;
    status: string;
    rating: number | "" | string;
    notes: string;
    location: string;
  }>;

  for (const c of rawC) {
    const rating =
      c.rating === "" || c.rating === null || c.rating === undefined
        ? null
        : Number(c.rating);
    await client.execute({
      sql: `INSERT INTO candidates (date, candidate, dept, role, source, owner, status, rating, notes, location)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        c.date,
        c.candidate,
        c.dept,
        c.role,
        c.source,
        c.owner,
        c.status,
        rating,
        c.notes ?? "",
        c.location ?? "",
      ],
    });
  }

  const rawO = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "lib", "seed-offers.json"), "utf8"),
  ) as Offer[];

  for (const o of rawO) {
    await client.execute({
      sql: `INSERT INTO offers (id, name, role, dept, status, offerdate, joindate, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      args: [
        o.id,
        o.name,
        o.role,
        o.dept,
        o.status,
        o.offerdate ?? "",
        o.joindate ?? "",
        o.notes ?? "",
      ],
    });
  }

      for (const [role, v] of Object.entries(DEFAULT_HIRING_TARGETS)) {
        await client.execute({
          sql: `INSERT INTO hiring_targets (role, target, location) VALUES (?, ?, ?)`,
          args: [role, v.target, v.location],
        });
      }
    })();
  }
  return libsqlBootstrap;
}

function seedIfEmptyLocal(db: SqliteDb) {
  const n = db.prepare("SELECT COUNT(*) AS c FROM candidates").get() as { c: number };
  if (n.c > 0) return;

  const rawC = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "lib", "seed-candidates.json"), "utf8"),
  ) as Array<{
    date: string;
    candidate: string;
    dept: string;
    role: string;
    source: string;
    owner: string;
    status: string;
    rating: number | "" | string;
    notes: string;
    location: string;
  }>;

  const insC = db.prepare(
    `INSERT INTO candidates (date, candidate, dept, role, source, owner, status, rating, notes, location)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const c of rawC) {
    const rating =
      c.rating === "" || c.rating === null || c.rating === undefined
        ? null
        : Number(c.rating);
    insC.run(
      c.date,
      c.candidate,
      c.dept,
      c.role,
      c.source,
      c.owner,
      c.status,
      rating,
      c.notes ?? "",
      c.location ?? "",
    );
  }

  const rawO = JSON.parse(
    fs.readFileSync(path.join(process.cwd(), "lib", "seed-offers.json"), "utf8"),
  ) as Offer[];
  const insO = db.prepare(
    `INSERT INTO offers (id, name, role, dept, status, offerdate, joindate, notes)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const o of rawO) {
    insO.run(
      o.id,
      o.name,
      o.role,
      o.dept,
      o.status,
      o.offerdate ?? "",
      o.joindate ?? "",
      o.notes ?? "",
    );
  }

  const insH = db.prepare(`INSERT INTO hiring_targets (role, target, location) VALUES (?, ?, ?)`);
  for (const [role, v] of Object.entries(DEFAULT_HIRING_TARGETS)) {
    insH.run(role, v.target, v.location);
  }
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

async function loadFromLibsql(client: Client): Promise<DashboardState> {
  await ensureLibsqlSchemaAndSeed(client);

  const candRes = await client.execute(
    "SELECT id, date, candidate, dept, role, source, owner, status, rating, notes, location FROM candidates ORDER BY date DESC, id DESC",
  );
  const candidates = candRes.rows.map((row: Record<string, unknown>) => mapCandidateRow(row));

  const offRes = await client.execute(
    "SELECT id, name, role, dept, status, offerdate, joindate, notes FROM offers ORDER BY id",
  );
  const offers = offRes.rows.map((row: Record<string, unknown>) => mapOfferRow(row));

  const eodRes = await client.execute(
    "SELECT id, date, recruiter, location, payload FROM eod_reports ORDER BY date DESC, id DESC",
  );
  const eodReports: EodReport[] = eodRes.rows.map((row: Record<string, unknown>) => {
    const p = JSON.parse(String(row.payload ?? "{}")) as Omit<EodReport, "id" | "date" | "recruiter" | "location">;
    return {
      id: num(row.id),
      date: String(row.date ?? ""),
      recruiter: String(row.recruiter ?? ""),
      location: String(row.location ?? ""),
      ...p,
    };
  });

  const htRes = await client.execute("SELECT role, target, location FROM hiring_targets");
  const hiringTargets: Record<string, { target: number; location: string }> = {};
  for (const row of htRes.rows) {
    const r = row as Record<string, unknown>;
    hiringTargets[String(r.role)] = {
      target: num(r.target),
      location: String(r.location ?? ""),
    };
  }

  return { candidates, offers, eodReports, hiringTargets };
}

function loadFromLocalSqlite(db: SqliteDb): DashboardState {
  const candidates = db
    .prepare(
      `SELECT id, date, candidate, dept, role, source, owner, status, rating, notes, location FROM candidates ORDER BY date DESC, id DESC`,
    )
    .all() as Candidate[];

  const offers = db
    .prepare(
      `SELECT id, name, role, dept, status, offerdate, joindate, notes FROM offers ORDER BY id`,
    )
    .all() as Offer[];

  const eodRows = db
    .prepare(
      `SELECT id, date, recruiter, location, payload FROM eod_reports ORDER BY date DESC, id DESC`,
    )
    .all() as { id: number; date: string; recruiter: string; location: string; payload: string }[];

  const eodReports: EodReport[] = eodRows.map((r) => {
    const p = JSON.parse(r.payload) as Omit<EodReport, "id" | "date" | "recruiter" | "location">;
    return {
      id: r.id,
      date: r.date,
      recruiter: r.recruiter,
      location: r.location ?? "",
      ...p,
    };
  });

  const htRows = db.prepare(`SELECT role, target, location FROM hiring_targets`).all() as {
    role: string;
    target: number;
    location: string;
  }[];
  const hiringTargets: Record<string, { target: number; location: string }> = {};
  for (const row of htRows) {
    hiringTargets[row.role] = { target: row.target, location: row.location ?? "" };
  }

  return { candidates, offers, eodReports, hiringTargets };
}

export async function loadDashboardState(): Promise<DashboardState> {
  if (tursoConfigured()) {
    return loadFromLibsql(getLibsql());
  }
  return loadFromLocalSqlite(getLocalDb());
}

export async function deleteOffer(id: number): Promise<void> {
  if (tursoConfigured()) {
    const client = getLibsql();
    await ensureLibsqlSchemaAndSeed(client);
    await client.execute({ sql: "DELETE FROM offers WHERE id = ?", args: [id] });
    return;
  }
  getLocalDb().prepare("DELETE FROM offers WHERE id = ?").run(id);
}

export async function upsertEodReport(entry: {
  date: string;
  recruiter: string;
  location: string;
  payload: string;
}): Promise<number> {
  if (tursoConfigured()) {
    const client = getLibsql();
    await ensureLibsqlSchemaAndSeed(client);
    await client.execute({
      sql: `INSERT INTO eod_reports (date, recruiter, location, payload) VALUES (?, ?, ?, ?)
            ON CONFLICT(recruiter, date) DO UPDATE SET
              location = excluded.location,
              payload = excluded.payload`,
      args: [entry.date, entry.recruiter, entry.location, entry.payload],
    });
    const sel = await client.execute({
      sql: "SELECT id FROM eod_reports WHERE recruiter = ? AND date = ?",
      args: [entry.recruiter, entry.date],
    });
    const row = sel.rows[0] as Record<string, unknown> | undefined;
    return row ? num(row.id) : 0;
  }
  const db = getLocalDb();
  db.prepare(
    `INSERT INTO eod_reports (date, recruiter, location, payload) VALUES (?, ?, ?, ?)
     ON CONFLICT(recruiter, date) DO UPDATE SET
       location = excluded.location,
       payload = excluded.payload`,
  ).run(entry.date, entry.recruiter, entry.location, entry.payload);
  const row = db
    .prepare("SELECT id FROM eod_reports WHERE recruiter = ? AND date = ?")
    .get(entry.recruiter, entry.date) as { id: number };
  return row.id;
}

export async function deleteEodReport(id: number): Promise<void> {
  if (tursoConfigured()) {
    const client = getLibsql();
    await ensureLibsqlSchemaAndSeed(client);
    await client.execute({ sql: "DELETE FROM eod_reports WHERE id = ?", args: [id] });
    return;
  }
  getLocalDb().prepare("DELETE FROM eod_reports WHERE id = ?").run(id);
}

export async function replaceHiringTargets(
  targets: Record<string, { target: number; location: string }>,
): Promise<void> {
  if (tursoConfigured()) {
    const client = getLibsql();
    await ensureLibsqlSchemaAndSeed(client);
    await client.execute("DELETE FROM hiring_targets");
    for (const [role, v] of Object.entries(targets)) {
      await client.execute({
        sql: `INSERT INTO hiring_targets (role, target, location) VALUES (?, ?, ?)`,
        args: [role, v.target ?? 0, v.location ?? ""],
      });
    }
    return;
  }
  const db = getLocalDb();
  db.exec("DELETE FROM hiring_targets");
  const ins = db.prepare(`INSERT INTO hiring_targets (role, target, location) VALUES (?, ?, ?)`);
  for (const [role, v] of Object.entries(targets)) {
    ins.run(role, v.target ?? 0, v.location ?? "");
  }
}
