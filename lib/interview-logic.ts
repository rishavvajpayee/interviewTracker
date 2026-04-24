import type { Candidate, EodReport, Offer } from "./types";
import { HS_ACTIVE_STAGES, HS_PIPELINE_STAGES, OWNERS } from "./constants";

export const SBG: Record<string, string> = {
  Applied: "rgba(148,163,184,0.15)",
  Screening: "rgba(96,165,250,0.15)",
  Shortlisted: "rgba(249,115,22,0.15)",
  "Interview Scheduled": "rgba(167,139,250,0.15)",
  "Call Back": "rgba(251,191,36,0.15)",
  "On Hold": "rgba(251,191,36,0.12)",
  Rejected: "rgba(248,113,113,0.1)",
  "Rejected (Post-Interview)": "rgba(248,113,113,0.15)",
  Withdrawn: "rgba(100,116,139,0.1)",
  DNP: "rgba(251,191,36,0.1)",
  "Round 1 - Virtual Interview": "rgba(129,140,248,0.15)",
  "Round 2 - Assessment": "rgba(167,139,250,0.15)",
  "Final Round": "rgba(249,115,22,0.15)",
  "Offer Made": "rgba(52,211,153,0.2)",
  "Offer Accepted": "rgba(52,211,153,0.25)",
  Joined: "rgba(16,185,129,0.2)",
};

export const SCL: Record<string, string> = {
  Applied: "var(--muted2)",
  Screening: "var(--blue)",
  Shortlisted: "var(--accent)",
  "Interview Scheduled": "var(--purple)",
  "Call Back": "var(--yellow)",
  "On Hold": "var(--yellow)",
  Rejected: "var(--red)",
  "Rejected (Post-Interview)": "var(--red)",
  Withdrawn: "var(--muted2)",
  DNP: "var(--yellow)",
  "Round 1 - Virtual Interview": "#818cf8",
  "Round 2 - Assessment": "var(--purple)",
  "Final Round": "var(--accent)",
  "Offer Made": "#34d399",
  "Offer Accepted": "var(--green)",
  Joined: "#10b981",
};

export const OF_STATUS_CLR: Record<string, string> = {
  "Offer Made": "#34d399",
  "Offer Accepted": "var(--green)",
  Joined: "#10b981",
  "Offer Declined": "var(--red)",
};

export const OF_STATUS_BG: Record<string, string> = {
  "Offer Made": "rgba(52,211,153,0.15)",
  "Offer Accepted": "rgba(52,211,153,0.25)",
  Joined: "rgba(16,185,129,0.2)",
  "Offer Declined": "rgba(248,113,113,0.12)",
};

export type FilterState = {
  q: string;
  dept: string;
  role: string;
  status: string;
  source: string;
  owner: string;
  location: string;
  todayOnly: boolean;
};

export function filterCandidates(candidates: Candidate[], f: FilterState): Candidate[] {
  const today = new Date().toISOString().slice(0, 10);
  const q = f.q.toLowerCase();
  return candidates.filter((c) => {
    if (f.todayOnly && c.date !== today) return false;
    if (f.dept && c.dept !== f.dept) return false;
    if (f.role && c.role !== f.role) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.source && c.source !== f.source) return false;
    if (f.owner && c.owner !== f.owner) return false;
    if (f.location && c.location !== f.location) return false;
    if (q) {
      const hay = `${c.candidate}${c.role}${c.dept}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

export type KpiCounts = {
  total: number;
  screening: number;
  r1: number;
  r2: number;
  final: number;
  offer: number;
  joined: number;
  rejected: number;
  dnp: number;
  offerRate: string;
};

export function computeKpis(data: Candidate[]): KpiCounts {
  let scr = 0,
    r1 = 0,
    r2 = 0,
    fin = 0,
    offer = 0,
    joined = 0,
    rej = 0,
    dnp = 0;
  for (const c of data) {
    const s = c.status;
    if (
      s === "Screening" ||
      s === "Shortlisted" ||
      s === "Interview Scheduled" ||
      s === "Call Back"
    )
      scr++;
    if (s === "Round 1 - Virtual Interview") r1++;
    if (s === "Round 2 - Assessment") r2++;
    if (s === "Final Round") fin++;
    if (s === "Offer Made" || s === "Offer Accepted") offer++;
    if (s === "Joined") joined++;
    if (s === "Rejected" || s === "Rejected (Post-Interview)") rej++;
    if (s === "DNP") dnp++;
  }
  const t = data.length;
  const totalOffers = offer + joined;
  return {
    total: t,
    screening: scr,
    r1,
    r2,
    final: fin,
    offer,
    joined,
    rejected: rej,
    dnp,
    offerRate: t > 0 ? `${Math.round((totalOffers / t) * 100)}%` : "-",
  };
}

export const FUNNEL_STAGES = [
  {
    key: "screening" as const,
    label: "Screening",
    color: "#60a5fa",
    statuses: ["Screening", "Shortlisted", "Interview Scheduled", "Call Back"],
  },
  {
    key: "r1" as const,
    label: "Round 1",
    color: "#818cf8",
    statuses: ["Round 1 - Virtual Interview"],
  },
  {
    key: "r2" as const,
    label: "Round 2",
    color: "#a78bfa",
    statuses: ["Round 2 - Assessment"],
  },
  {
    key: "final" as const,
    label: "Final Round",
    color: "#f97316",
    statuses: ["Final Round"],
  },
  {
    key: "offer" as const,
    label: "Offers",
    color: "#34d399",
    statuses: ["Offer Made", "Offer Accepted"],
  },
  { key: "joined" as const, label: "Joined", color: "#10b981", statuses: ["Joined"] },
];

export function funnelStageCounts(all: Candidate[]) {
  const stageCounts: Record<string, number> = {};
  for (const s of FUNNEL_STAGES) {
    stageCounts[s.key] = all.filter((c) => s.statuses.includes(c.status)).length;
  }
  return stageCounts;
}

export const CLRS = ["#f97316", "#60a5fa", "#34d399", "#a78bfa", "#fbbf24", "#f87171"];

export function sortedEntries(counts: Record<string, number>): [string, number][] {
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

export function stars(r: number | null): string {
  if (r == null || Number.isNaN(r)) return "-";
  let s = "";
  const n = Math.round(r);
  for (let i = 1; i <= 5; i++) s += i <= n ? "★" : "☆";
  return s;
}

export function rClr(r: number | null): string {
  if (r == null || Number.isNaN(r)) return "var(--muted)";
  if (r >= 4) return "var(--green)";
  if (r >= 3) return "var(--yellow)";
  return "var(--red)";
}

export type RolePipeline = Record<string, number>;

export type RoleData = {
  target: number;
  location: string;
  pipeline: RolePipeline;
  joined: number;
  total: number;
};

export function hsGetRoleData(
  cands: Candidate[],
  targets: Record<string, { target: number; location: string }>,
): Record<string, RoleData> {
  const roles = Object.keys(targets);
  const roleData: Record<string, RoleData> = {};
  for (const r of roles) {
    const td = targets[r] ?? { target: 0, location: "" };
    const pipeline: RolePipeline = {};
    for (const s of HS_PIPELINE_STAGES) pipeline[s] = 0;
    roleData[r] = {
      target: td.target,
      location: td.location,
      pipeline,
      joined: 0,
      total: 0,
    };
  }
  for (const c of cands) {
    if (!roleData[c.role]) continue;
    roleData[c.role].total++;
    if (roleData[c.role].pipeline[c.status] !== undefined) {
      roleData[c.role].pipeline[c.status]++;
    }
    if (c.status === "Joined") roleData[c.role].joined++;
  }
  return roleData;
}

/** Hiring targets from persistence only — candidate rows do not implicitly create job posts. */
export function mergeHiringTargets(
  base: Record<string, { target: number; location: string }>,
): Record<string, { target: number; location: string }> {
  return { ...base };
}

export const STAGE_COLS = [
  {
    label: "Applied/Screening",
    keys: ["Applied", "Screening", "Shortlisted", "Interview Scheduled", "Call Back"],
    color: "#60a5fa",
  },
  { label: "Round 1", keys: ["Round 1 - Virtual Interview"], color: "#a78bfa" },
  { label: "Round 2", keys: ["Round 2 - Assessment"], color: "#f97316" },
  { label: "Final", keys: ["Final Round"], color: "#fbbf24" },
  { label: "Offer", keys: ["Offer Made", "Offer Accepted"], color: "#34d399" },
  { label: "Joined", keys: ["Joined"], color: "#2dd4bf" },
] as const;

export function hsHexToRgb(hex: string): string {
  const h = hex.slice(1);
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r},${g},${b}`;
}

export function hiringSummaryKpis(
  roles: string[],
  roleData: Record<string, RoleData>,
  targets: Record<string, { target: number; location: string }>,
) {
  let totalOpen = 0,
    totalPipeline = 0,
    totalJoined = 0,
    totalTarget = 0;
  for (const r of roles) {
    const d = roleData[r];
    const filled = d.joined;
    const tgt = targets[r]?.target ?? 0;
    totalOpen += Math.max(0, tgt - filled);
    totalTarget += tgt;
    totalPipeline += HS_ACTIVE_STAGES.reduce((a, s) => a + (d.pipeline[s] ?? 0), 0);
    totalJoined += filled;
  }
  const fillRate = totalTarget > 0 ? Math.round((totalJoined / totalTarget) * 100) : 0;
  return { totalOpen, totalPipeline, totalJoined, totalTarget, fillRate, rolesCount: roles.length };
}

export function sortOffersForTable(offers: Offer[]): Offer[] {
  return offers.slice().sort((a, b) => {
    const aj = a.joindate || "9999";
    const bj = b.joindate || "9999";
    return aj < bj ? -1 : aj > bj ? 1 : 0;
  });
}

export function eodFilteredReports(reports: EodReport[], activeRec: string): EodReport[] {
  if (!activeRec) return reports;
  return reports.filter((r) => r.recruiter === activeRec);
}

/** Suggested recruiters for EOD: default owners plus any names already saved on reports. */
export function eodRecruiterChoices(reports: EodReport[]): string[] {
  const ownerSet = new Set<string>(OWNERS);
  const extra = new Set<string>();
  for (const r of reports) {
    const name = r.recruiter.trim();
    if (name && !ownerSet.has(name)) extra.add(name);
  }
  return [...OWNERS, ...[...extra].sort((a, b) => a.localeCompare(b))];
}
