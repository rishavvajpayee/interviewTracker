import fs from "fs";
import path from "path";
import Sqlite from "better-sqlite3";
import type { Candidate, DashboardState, EodReport, Offer } from "./types";
import { DEFAULT_HIRING_TARGETS } from "./constants";

/** better-sqlite3 merges class + namespace; use instance type for annotations */
type SqliteDb = InstanceType<typeof Sqlite>;

let dbInstance: SqliteDb | null = null;

function dbPath() {
  const dir = path.join(process.cwd(), "data");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, "interviewtrack.db");
}

export function getDb(): SqliteDb {
  if (dbInstance) return dbInstance;
  dbInstance = new Sqlite(dbPath());
  initSchema(dbInstance);
  seedIfEmpty(dbInstance);
  return dbInstance;
}

function initSchema(db: SqliteDb) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS candidates (
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
    );
    CREATE TABLE IF NOT EXISTS offers (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      dept TEXT NOT NULL,
      status TEXT NOT NULL,
      offerdate TEXT,
      joindate TEXT,
      notes TEXT
    );
    CREATE TABLE IF NOT EXISTS eod_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL,
      recruiter TEXT NOT NULL,
      location TEXT,
      payload TEXT NOT NULL,
      UNIQUE(recruiter, date)
    );
    CREATE TABLE IF NOT EXISTS hiring_targets (
      role TEXT PRIMARY KEY,
      target INTEGER NOT NULL DEFAULT 0,
      location TEXT NOT NULL DEFAULT ''
    );
  `);
}

function seedIfEmpty(db: SqliteDb) {
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

export function loadDashboardState(): DashboardState {
  const db = getDb();
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

export function deleteOffer(id: number) {
  getDb().prepare("DELETE FROM offers WHERE id = ?").run(id);
}

export function upsertEodReport(entry: {
  date: string;
  recruiter: string;
  location: string;
  payload: string;
}) {
  const db = getDb();
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

export function deleteEodReport(id: number) {
  getDb().prepare("DELETE FROM eod_reports WHERE id = ?").run(id);
}

export function replaceHiringTargets(targets: Record<string, { target: number; location: string }>) {
  const db = getDb();
  db.exec("DELETE FROM hiring_targets");
  const ins = db.prepare(
    `INSERT INTO hiring_targets (role, target, location) VALUES (?, ?, ?)`,
  );
  for (const [role, v] of Object.entries(targets)) {
    ins.run(role, v.target ?? 0, v.location ?? "");
  }
}
