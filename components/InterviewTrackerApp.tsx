"use client";

import type { DashboardState, EodReport } from "@/lib/types";
import {
  ASSIGNMENT_TYPES,
  DEPTS,
  LOCATIONS,
  OWNERS,
  ROLES,
  SOURCES,
  STATUSES,
} from "@/lib/constants";
import {
  CLRS,
  FUNNEL_STAGES,
  OF_STATUS_BG,
  OF_STATUS_CLR,
  STAGE_COLS,
  computeKpis,
  eodFilteredReports,
  eodRecruiterChoices,
  filterCandidates,
  funnelStageCounts,
  hiringSummaryKpis,
  hsGetRoleData,
  hsHexToRgb,
  mergeHiringTargets,
  sortOffersForTable,
  sortedEntries,
  type FilterState,
} from "@/lib/interview-logic";
import { VolumeChart } from "@/components/VolumeChart";
import type { ReactNode } from "react";
import { useCallback, useMemo, useState } from "react";

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows
    .map((r) => r.map((x) => `"${String(x ?? "").replace(/"/g, '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function BarList({ entries }: { entries: [string, number][] }) {
  if (!entries.length) {
    return <div style={{ color: "var(--muted)", fontSize: "0.75rem", padding: "0.5rem" }}>No data</div>;
  }
  const max = Math.max(...entries.map((e) => e[1]));
  return (
    <>
      {entries.map((e, i) => {
        const pct = max ? Math.round((e[1] / max) * 100) : 0;
        const clr = CLRS[i % CLRS.length];
        return (
          <div
            key={e[0]}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.4rem" }}
          >
            <div
              style={{
                fontSize: "0.68rem",
                color: "var(--muted2)",
                width: 110,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {e[0]}
            </div>
            <div
              style={{
                flex: 1,
                background: "var(--surface2)",
                borderRadius: 4,
                height: 8,
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  width: `${pct}%`,
                  background: clr,
                  height: "100%",
                  borderRadius: 4,
                }}
              />
            </div>
            <div
              style={{
                fontSize: "0.68rem",
                color: "var(--muted2)",
                width: 22,
                textAlign: "right",
              }}
            >
              {e[1]}
            </div>
          </div>
        );
      })}
    </>
  );
}

type EodForm = {
  date: string;
  recruiter: string;
  location: string;
  rsProfile: string;
  rsScreened: string;
  rsShortlisted: string;
  scProfile: string;
  scCalls: string;
  scShortlisted: string;
  vrProfile: string;
  vrRounds: string;
  vrShortlisted: string;
  arProfile: string;
  arType: string;
  arConducted: string;
  arSelected: string;
  frProfile: string;
  frRounds: string;
  frSelected: string;
  other: string;
};

function EodStageCell({
  title,
  rows,
  color,
}: {
  title: string;
  rows: [string, string | number][];
  color: string;
}) {
  return (
    <div style={{ padding: "0.7rem 0.8rem", borderRight: "1px solid var(--border)" }}>
      <div
        style={{
          fontSize: "0.62rem",
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          marginBottom: "0.5rem",
        }}
      >
        {title}
      </div>
      {rows.map(([k, v]) => {
        const isNum = typeof v === "number";
        return (
          <div
            key={k}
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.3rem",
            }}
          >
            <span style={{ fontSize: "0.67rem", color: "var(--muted2)" }}>{k}</span>
            <span
              style={{
                fontSize: "0.72rem",
                fontWeight: isNum ? 700 : 500,
                color: isNum ? color : "var(--text)",
              }}
            >
              {v}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function EodSection({
  eodForm,
  setEodForm,
  eodActiveRec,
  setEodActiveRec,
  eodList,
  eodMsg,
  eodMsgColor,
  submitEod,
  clearEodForm,
  deleteEod,
  editEod,
  eodExportCsv,
  dateLabel,
}: {
  eodForm: EodForm;
  setEodForm: React.Dispatch<React.SetStateAction<EodForm>>;
  eodActiveRec: string;
  setEodActiveRec: (s: string) => void;
  eodList: EodReport[];
  eodMsg: string;
  eodMsgColor: string;
  submitEod: () => void;
  clearEodForm: () => void;
  deleteEod: (id: number) => void;
  editEod: (r: EodReport) => void;
  eodExportCsv: () => void;
  dateLabel: string;
}) {
  const recruiterChoices = eodRecruiterChoices(eodList);
  const recs = ["All", ...recruiterChoices];
  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.2rem",
          flexWrap: "wrap",
          gap: "0.6rem",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "0.64rem",
              textTransform: "uppercase",
              letterSpacing: "0.14em",
              color: "var(--accent)",
              fontWeight: 600,
              marginBottom: "0.2rem",
            }}
          >
            EOD Report Logger
          </div>
          <div style={{ fontSize: "0.8rem", color: "var(--muted2)" }}>{dateLabel}</div>
        </div>
        <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
          {recs.map((r) => {
            const isAll = r === "All";
            const active = isAll ? eodActiveRec === "" : eodActiveRec === r;
            const recVal = isAll ? "" : r;
            return (
              <button
                key={r}
                type="button"
                className={`eod-rec-tab${active ? " active" : ""}`}
                onClick={() => {
                  setEodActiveRec(recVal);
                  if (!isAll) setEodForm((f) => ({ ...f, recruiter: r }));
                }}
              >
                {r}
              </button>
            );
          })}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.2rem" }}>
        <div>
          <div className="card" style={{ marginBottom: 0 }}>
            <div className="card-title" style={{ color: "var(--accent)" }}>
              📋 Submit Daily Report
            </div>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr 1fr",
                gap: "0.8rem",
                marginBottom: "1.2rem",
              }}
            >
              <div>
                <div className="iv-label">Date</div>
                <input
                  type="date"
                  className="iv-field"
                  value={eodForm.date}
                  onChange={(e) => setEodForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
              <div>
                <div className="iv-label">Recruiter</div>
                <input
                  type="text"
                  className="iv-field"
                  list="iv-eod-recruiters-datalist"
                  placeholder="Type or select name"
                  autoComplete="off"
                  value={eodForm.recruiter}
                  onChange={(e) => setEodForm((f) => ({ ...f, recruiter: e.target.value }))}
                />
                <datalist id="iv-eod-recruiters-datalist">
                  {recruiterChoices.map((o) => (
                    <option key={o} value={o} />
                  ))}
                </datalist>
              </div>
              <div>
                <div className="iv-label">Location</div>
                <select
                  className="iv-field"
                  value={eodForm.location}
                  onChange={(e) => setEodForm((f) => ({ ...f, location: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {LOCATIONS.map((o) => (
                    <option key={o}>{o}</option>
                  ))}
                </select>
              </div>
            </div>

            <SectionHeader icon="📄" label="1. Resume Shortlisting" color="#60a5fa" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "0.8rem",
                marginBottom: "1.2rem",
              }}
            >
              <FieldSelect
                label="Job Profile"
                value={eodForm.rsProfile}
                onChange={(v) => setEodForm((f) => ({ ...f, rsProfile: v }))}
              />
              <FieldNum
                label="Resumes Screened"
                value={eodForm.rsScreened}
                onChange={(v) => setEodForm((f) => ({ ...f, rsScreened: v }))}
              />
              <FieldNum
                label="Resumes Shortlisted"
                value={eodForm.rsShortlisted}
                onChange={(v) => setEodForm((f) => ({ ...f, rsShortlisted: v }))}
              />
            </div>

            <SectionHeader icon="📞" label="2. Screening Calls" color="#a78bfa" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "0.8rem",
                marginBottom: "1.2rem",
              }}
            >
              <FieldSelect
                label="Job Profile"
                value={eodForm.scProfile}
                onChange={(v) => setEodForm((f) => ({ ...f, scProfile: v }))}
              />
              <FieldNum
                label="Connected Calls"
                value={eodForm.scCalls}
                onChange={(v) => setEodForm((f) => ({ ...f, scCalls: v }))}
              />
              <FieldNum
                label="Candidates Shortlisted"
                value={eodForm.scShortlisted}
                onChange={(v) => setEodForm((f) => ({ ...f, scShortlisted: v }))}
              />
            </div>

            <SectionHeader icon="💻" label="3. 1st Virtual Rounds" color="#f97316" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "0.8rem",
                marginBottom: "1.2rem",
              }}
            >
              <FieldSelect
                label="Job Profile"
                value={eodForm.vrProfile}
                onChange={(v) => setEodForm((f) => ({ ...f, vrProfile: v }))}
              />
              <FieldNum
                label="No. of Rounds"
                value={eodForm.vrRounds}
                onChange={(v) => setEodForm((f) => ({ ...f, vrRounds: v }))}
              />
              <FieldNum
                label="Candidates Shortlisted"
                value={eodForm.vrShortlisted}
                onChange={(v) => setEodForm((f) => ({ ...f, vrShortlisted: v }))}
              />
            </div>

            <SectionHeader icon="📝" label="4. Assignment Round" color="#fbbf24" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(4,1fr)",
                gap: "0.8rem",
                marginBottom: "1.2rem",
              }}
            >
              <FieldSelect
                label="Job Profile"
                value={eodForm.arProfile}
                onChange={(v) => setEodForm((f) => ({ ...f, arProfile: v }))}
              />
              <div>
                <div className="iv-label">Type of Assignment</div>
                <select
                  className="iv-field"
                  value={eodForm.arType}
                  onChange={(e) => setEodForm((f) => ({ ...f, arType: e.target.value }))}
                >
                  <option value="">Select...</option>
                  {ASSIGNMENT_TYPES.map((t) => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </div>
              <FieldNum
                label="Assignments Conducted"
                value={eodForm.arConducted}
                onChange={(v) => setEodForm((f) => ({ ...f, arConducted: v }))}
              />
              <FieldNum
                label="Candidates Selected"
                value={eodForm.arSelected}
                onChange={(v) => setEodForm((f) => ({ ...f, arSelected: v }))}
              />
            </div>

            <SectionHeader icon="🏁" label="5. Final Round" color="#34d399" />
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(3,1fr)",
                gap: "0.8rem",
                marginBottom: "1.2rem",
              }}
            >
              <FieldSelect
                label="Job Profile"
                value={eodForm.frProfile}
                onChange={(v) => setEodForm((f) => ({ ...f, frProfile: v }))}
              />
              <FieldNum
                label="No. of Rounds"
                value={eodForm.frRounds}
                onChange={(v) => setEodForm((f) => ({ ...f, frRounds: v }))}
              />
              <FieldNum
                label="Candidates Selected"
                value={eodForm.frSelected}
                onChange={(v) => setEodForm((f) => ({ ...f, frSelected: v }))}
              />
            </div>

            <SectionHeader icon="✅" label="6. Other Tasks Performed" color="#94a3b8" />
            <div style={{ marginBottom: "1.2rem" }}>
              <textarea
                className="iv-field"
                rows={2}
                placeholder="Describe any other tasks, follow-ups, escalations or blockers..."
                value={eodForm.other}
                onChange={(e) => setEodForm((f) => ({ ...f, other: e.target.value }))}
                style={{ resize: "vertical", minHeight: 60 }}
              />
            </div>
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center" }}>
              <button
                type="button"
                style={{
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 8,
                  padding: "0.5rem 1.4rem",
                  color: "#fff",
                  fontFamily: "var(--font-dm), 'DM Sans', sans-serif",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
                onClick={submitEod}
              >
                Submit EOD
              </button>
              <button
                type="button"
                style={{
                  background: "none",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  padding: "0.5rem 1rem",
                  color: "var(--muted2)",
                  fontFamily: "var(--font-dm), 'DM Sans', sans-serif",
                  fontSize: "0.78rem",
                  cursor: "pointer",
                }}
                onClick={clearEodForm}
              >
                Clear
              </button>
              <span style={{ fontSize: "0.73rem", color: eodMsgColor }}>{eodMsg}</span>
            </div>
          </div>
        </div>
        <div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.7rem",
            }}
          >
            <div
              style={{
                fontSize: "0.7rem",
                color: "var(--muted2)",
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              Submitted Reports
            </div>
            <button
              type="button"
              style={{
                background: "var(--surface2)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "0.28rem 0.65rem",
                color: "var(--muted2)",
                fontSize: "0.68rem",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
              onClick={eodExportCsv}
            >
              ⬇ Export CSV
            </button>
          </div>
          <div>
            {!eodList.length ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "1.5rem",
                  color: "var(--muted2)",
                  fontSize: "0.78rem",
                }}
              >
                No EOD reports submitted yet.
              </div>
            ) : (
              eodList.map((r) => {
                const rs = r.resumeShortlisting || {};
                const sc = r.screeningCalls || {};
                const vr = r.virtualRounds || {};
                const ar = r.assignment || {};
                const fr = r.finalRound || {};
                return (
                  <div
                    key={r.id}
                    style={{
                      background: "var(--surface2)",
                      borderRadius: 12,
                      marginBottom: "0.8rem",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "0.7rem 1rem",
                        background: "var(--surface3)",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.8rem" }}>
                        <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.82rem" }}>
                          {r.recruiter}
                        </span>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            color: "var(--muted2)",
                            background: "var(--surface2)",
                            padding: "0.15rem 0.5rem",
                            borderRadius: 4,
                          }}
                        >
                          {r.date}
                        </span>
                        {r.location ? (
                          <span
                            style={{
                              fontSize: "0.68rem",
                              color: "#2dd4bf",
                              background: "rgba(45,212,191,0.1)",
                              padding: "0.15rem 0.5rem",
                              borderRadius: 4,
                            }}
                          >
                            {r.location}
                          </span>
                        ) : null}
                        <span style={{ fontSize: "0.65rem", color: "var(--muted2)" }}>{r.submittedAt}</span>
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem" }}>
                        <button
                          type="button"
                          style={{
                            background: "none",
                            border: "1px solid var(--border)",
                            borderRadius: 6,
                            padding: "0.22rem 0.65rem",
                            color: "var(--muted2)",
                            fontSize: "0.68rem",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                          onClick={() => editEod(r)}
                        >
                          ✏ Edit
                        </button>
                        <button
                          type="button"
                          style={{
                            background: "none",
                            border: "1px solid rgba(248,113,113,0.3)",
                            borderRadius: 6,
                            padding: "0.22rem 0.65rem",
                            color: "#f87171",
                            fontSize: "0.68rem",
                            cursor: "pointer",
                            fontFamily: "inherit",
                          }}
                          onClick={() => deleteEod(r.id)}
                        >
                          ✕ Delete
                        </button>
                      </div>
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(5,1fr)",
                        gap: 0,
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      <EodStageCell
                        title="📄 Resume"
                        color="#60a5fa"
                        rows={[
                          [" Profile", rs.profile || "—"],
                          ["Screened", rs.screened || 0],
                          ["Shortlisted", rs.shortlisted || 0],
                        ]}
                      />
                      <EodStageCell
                        title="📞 Screening"
                        color="#a78bfa"
                        rows={[
                          ["Profile", sc.profile || "—"],
                          ["Calls", sc.calls || 0],
                          ["Shortlisted", sc.shortlisted || 0],
                        ]}
                      />
                      <EodStageCell
                        title="💻 Virtual"
                        color="#f97316"
                        rows={[
                          ["Profile", vr.profile || "—"],
                          ["Rounds", vr.rounds || 0],
                          ["Shortlisted", vr.shortlisted || 0],
                        ]}
                      />
                      <EodStageCell
                        title="📝 Assignment"
                        color="#fbbf24"
                        rows={[
                          ["Profile", ar.profile || "—"],
                          ["Type", ar.type || "—"],
                          ["Conducted", ar.conducted || 0],
                          ["Selected", ar.selected || 0],
                        ]}
                      />
                      <EodStageCell
                        title="🏁 Final"
                        color="#34d399"
                        rows={[
                          ["Profile", fr.profile || "—"],
                          ["Rounds", fr.rounds || 0],
                          ["Selected", fr.selected || 0],
                        ]}
                      />
                    </div>
                    {r.otherTasks ? (
                      <div style={{ padding: "0.6rem 1rem", fontSize: "0.72rem", color: "var(--muted2)" }}>
                        <span style={{ color: "var(--muted)", fontWeight: 600, marginRight: "0.4rem" }}>
                          Other:
                        </span>
                        {r.otherTasks}
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ icon, label, color }: { icon: string; label: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.55rem 0.8rem",
        background: "var(--surface3)",
        borderRadius: 8,
        marginBottom: "0.8rem",
      }}
    >
      <span style={{ fontSize: "0.9rem" }}>{icon}</span>
      <span
        style={{
          fontSize: "0.72rem",
          fontWeight: 700,
          color,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
        }}
      >
        {label}
      </span>
    </div>
  );
}

function FieldSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="iv-label">{label}</div>
      <select className="iv-field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Select...</option>
        {ROLES.map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    </div>
  );
}

function FieldNum({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <div className="iv-label">{label}</div>
      <input
        type="number"
        min={0}
        placeholder="0"
        className="iv-field"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function HiringSection({
  hsKpis,
  roles,
  roleData,
  localHiring,
  setLocalHiring,
  persistHiring,
  newRoleInput,
  setNewRoleInput,
  hsTargetMsg,
  setHsTargetMsg,
  todayReports,
  stageChartTotals,
  SHOW,
  maxV,
  LABELS,
  COLORS,
  sortedRoles,
}: {
  hsKpis: ReturnType<typeof hiringSummaryKpis>;
  roles: string[];
  roleData: ReturnType<typeof hsGetRoleData>;
  localHiring: Record<string, { target: number; location: string }>;
  setLocalHiring: React.Dispatch<React.SetStateAction<Record<string, { target: number; location: string }>>>;
  persistHiring: (t: Record<string, { target: number; location: string }>) => Promise<void>;
  newRoleInput: string;
  setNewRoleInput: (s: string) => void;
  hsTargetMsg: string;
  setHsTargetMsg: (s: string) => void;
  todayReports: EodReport[];
  stageChartTotals: Record<string, number>;
  SHOW: string[];
  maxV: number;
  LABELS: Record<string, string>;
  COLORS: Record<string, string>;
  sortedRoles: string[];
}) {
  const LOCS = ["", "Noida", "Pune", "Indore"];

  const updateTarget = (role: string, target: number) => {
    setLocalHiring((h) => ({ ...h, [role]: { ...h[role], target } }));
  };
  const updateLoc = (role: string, location: string) => {
    setLocalHiring((h) => ({ ...h, [role]: { ...h[role], location } }));
  };

  const deleteRole = async (role: string) => {
    if (!window.confirm(`Remove "${role}" from hiring targets?`)) return;
    const next = { ...localHiring };
    delete next[role];
    setLocalHiring(next);
    await persistHiring(next);
  };

  const addRoleInline = async () => {
    const role = newRoleInput.trim();
    if (!role) return;
    if (localHiring[role] !== undefined) return;
    const next = { ...localHiring, [role]: { target: 0, location: "" } };
    setNewRoleInput("");
    setLocalHiring(next);
    await persistHiring(next);
  };

  const saveTargets = async () => {
    await persistHiring(localHiring);
    setHsTargetMsg("✓ All targets saved!");
    setTimeout(() => setHsTargetMsg(""), 2000);
  };

  return (
    <div>
      <div className="iv-kpi-strip iv-kpi-strip-5" style={{ marginTop: "0.8rem", marginBottom: "1.4rem" }}>
        <div className="iv-kpi">
          <div className="iv-kpi-val">{hsKpis.rolesCount}</div>
          <div className="iv-kpi-lbl">Active Roles</div>
        </div>
        <div className="iv-kpi">
          <div className="iv-kpi-val">{hsKpis.totalOpen}</div>
          <div className="iv-kpi-lbl">Open Positions</div>
        </div>
        <div className="iv-kpi">
          <div className="iv-kpi-val">{hsKpis.totalPipeline}</div>
          <div className="iv-kpi-lbl">In Pipeline</div>
        </div>
        <div className="iv-kpi">
          <div className="iv-kpi-val">{hsKpis.totalJoined}</div>
          <div className="iv-kpi-lbl">Hired (MTD)</div>
        </div>
        <div className="iv-kpi">
          <div className="iv-kpi-val">{hsKpis.fillRate}%</div>
          <div className="iv-kpi-lbl">Fill Rate</div>
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "1.2rem" }}>
        <div>
          <div className="card" style={{ marginBottom: "1.2rem" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1.2rem",
              }}
            >
              <div className="card-title">🎯 Active Job Posts & Pipeline</div>
              <button
                type="button"
                style={{
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 7,
                  padding: "0.3rem 0.9rem",
                  color: "#000",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                }}
                onClick={addRoleInline}
              >
                + Add Role
              </button>
            </div>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "0.73rem" }}>
                <thead>
                  <tr>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.6rem",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        letterSpacing: "0.08em",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Role
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "0.4rem 0.5rem",
                        fontSize: "0.6rem",
                        color: "#2dd4bf",
                        textTransform: "uppercase",
                        borderBottom: "1px solid var(--border)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      Location
                    </th>
                    <th
                      style={{
                        textAlign: "center",
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.6rem",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Target
                    </th>
                    {STAGE_COLS.map((sc) => (
                      <th
                        key={sc.label}
                        style={{
                          textAlign: "center",
                          padding: "0.4rem 0.5rem",
                          fontSize: "0.6rem",
                          color: sc.color,
                          textTransform: "uppercase",
                          borderBottom: "1px solid var(--border)",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {sc.label}
                      </th>
                    ))}
                    <th
                      style={{
                        textAlign: "left",
                        padding: "0.4rem 0.6rem",
                        fontSize: "0.6rem",
                        color: "var(--muted)",
                        textTransform: "uppercase",
                        borderBottom: "1px solid var(--border)",
                      }}
                    >
                      Progress
                    </th>
                    <th style={{ padding: "0.4rem 0.4rem", borderBottom: "1px solid var(--border)" }} />
                  </tr>
                </thead>
                <tbody>
                  {sortedRoles.map((role, i) => {
                    const d = roleData[role];
                    const td = localHiring[role] || { target: 0, location: "" };
                    const bg = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.015)";
                    const target = td.target || 0;
                    const joined = d.joined || 0;
                    const location = td.location || "";
                    const pct = target > 0 ? Math.min(100, Math.round((joined / target) * 100)) : 0;
                    const pctColor = pct >= 80 ? "#34d399" : pct >= 40 ? "#fbbf24" : "#f87171";
                    return (
                      <tr key={role} style={{ background: bg }}>
                        <td
                          style={{
                            padding: "0.5rem 0.6rem",
                            color: "var(--text)",
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {role}
                        </td>
                        <td style={{ padding: "0.5rem 0.5rem", textAlign: "center" }}>
                          {location ? (
                            <span
                              style={{
                                display: "inline-block",
                                padding: "0.13rem 0.5rem",
                                borderRadius: 20,
                                fontSize: "0.63rem",
                                fontWeight: 600,
                                background: "rgba(45,212,191,0.12)",
                                color: "#2dd4bf",
                                border: "1px solid rgba(45,212,191,0.2)",
                              }}
                            >
                              {location}
                            </span>
                          ) : (
                            <span style={{ color: "var(--muted2)", fontSize: "0.68rem" }}>—</span>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem 0.6rem", textAlign: "center", color: "var(--muted2)" }}>
                          {target || "—"}
                        </td>
                        {STAGE_COLS.map((sc) => {
                          const cnt = sc.keys.reduce((a, k) => a + (d.pipeline[k] || 0), 0);
                          return (
                            <td key={sc.label} style={{ padding: "0.5rem 0.5rem", textAlign: "center" }}>
                              {cnt > 0 ? (
                                <span
                                  style={{
                                    display: "inline-block",
                                    minWidth: 22,
                                    padding: "0.1rem 0.4rem",
                                    background: `rgba(${hsHexToRgb(sc.color)},0.15)`,
                                    color: sc.color,
                                    borderRadius: 4,
                                    fontWeight: 700,
                                    fontSize: "0.71rem",
                                  }}
                                >
                                  {cnt}
                                </span>
                              ) : (
                                <span style={{ color: "var(--muted2)", fontSize: "0.68rem" }}>—</span>
                              )}
                            </td>
                          );
                        })}
                        <td style={{ padding: "0.5rem 0.8rem", minWidth: 130 }}>
                          {target > 0 ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                              <div
                                style={{
                                  flex: 1,
                                  height: 6,
                                  background: "var(--surface3)",
                                  borderRadius: 3,
                                  overflow: "hidden",
                                }}
                              >
                                <div
                                  style={{
                                    height: "100%",
                                    width: `${pct}%`,
                                    background: pctColor,
                                    borderRadius: 3,
                                    transition: "width 0.3s",
                                  }}
                                />
                              </div>
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  color: pctColor,
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {joined}/{target}
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: "0.68rem", color: "var(--muted2)" }}>No target</span>
                          )}
                        </td>
                        <td style={{ padding: "0.5rem 0.4rem", textAlign: "center" }}>
                          <button
                            type="button"
                            className="del-btn"
                            title="Remove job post"
                            onClick={() => void deleteRole(role)}
                          >
                            ✕
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card">
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "1rem",
              }}
            >
              <div className="card-title">🕐 Today&apos;s EOD Activity</div>
              <span style={{ fontSize: "0.68rem", color: "var(--muted2)" }}>
                {new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "short" })}
              </span>
            </div>
            {!todayReports.length ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "1.2rem",
                  color: "var(--muted2)",
                  fontSize: "0.75rem",
                }}
              >
                No EOD reports submitted for today yet.
                <br />
                <span style={{ fontSize: "0.68rem" }}>Switch to EOD Reports tab to log activity.</span>
              </div>
            ) : (
              <>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3,1fr)",
                    gap: "0.6rem",
                    marginBottom: "1rem",
                  }}
                >
                  {[
                    { label: "Resumes Screened", color: "#60a5fa", fn: (r: EodReport) => r.resumeShortlisting?.screened || 0 },
                    { label: "Calls Connected", color: "#a78bfa", fn: (r: EodReport) => r.screeningCalls?.calls || 0 },
                    {
                      label: "Shortlisted (SC)",
                      color: "#f97316",
                      fn: (r: EodReport) => r.screeningCalls?.shortlisted || 0,
                    },
                    { label: "Virtual Rounds", color: "#fbbf24", fn: (r: EodReport) => r.virtualRounds?.rounds || 0 },
                    { label: "Assignments", color: "#34d399", fn: (r: EodReport) => r.assignment?.conducted || 0 },
                    { label: "Final Selected", color: "#2dd4bf", fn: (r: EodReport) => r.finalRound?.selected || 0 },
                  ].map((m) => {
                    const total = todayReports.reduce((a, r) => a + m.fn(r), 0);
                    return (
                      <div
                        key={m.label}
                        style={{ background: "var(--surface3)", borderRadius: 8, padding: "0.6rem 0.7rem" }}
                      >
                        <div
                          style={{
                            fontSize: "0.6rem",
                            color: "var(--muted2)",
                            textTransform: "uppercase",
                            letterSpacing: "0.08em",
                            marginBottom: "0.2rem",
                          }}
                        >
                          {m.label}
                        </div>
                        <div style={{ fontSize: "1.1rem", fontWeight: 700, color: m.color }}>{total}</div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                  {todayReports.map((r) => (
                    <div
                      key={r.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.8rem",
                        padding: "0.5rem 0.7rem",
                        background: "var(--surface3)",
                        borderRadius: 8,
                      }}
                    >
                      <span style={{ fontWeight: 700, color: "var(--accent)", fontSize: "0.75rem", minWidth: 80 }}>
                        {r.recruiter.split(" ")[0]}
                      </span>
                      {r.location ? (
                        <span
                          style={{
                            fontSize: "0.65rem",
                            color: "#2dd4bf",
                            background: "rgba(45,212,191,0.1)",
                            padding: "0.1rem 0.4rem",
                            borderRadius: 4,
                          }}
                        >
                          {r.location}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1.2rem" }}>
          <div className="card">
            <div className="card-title" style={{ marginBottom: "1rem" }}>
              ⚙️ Set Hiring Targets
            </div>
            <div style={{ fontSize: "0.68rem", color: "var(--muted2)", marginBottom: "0.8rem" }}>
              Adjust targets to instantly update the pipeline table. Add or remove roles as needed.
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
                maxHeight: 320,
                overflowY: "auto",
                paddingRight: "0.3rem",
                marginBottom: "0.8rem",
              }}
            >
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 56px 90px 22px",
                  gap: "0.4rem",
                  padding: "0.2rem 0.5rem",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.6rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--muted)",
                  }}
                >
                  Role
                </span>
                <span
                  style={{
                    fontSize: "0.6rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--muted)",
                    textAlign: "center",
                  }}
                >
                  Target
                </span>
                <span
                  style={{
                    fontSize: "0.6rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.08em",
                    color: "var(--muted)",
                  }}
                >
                  Location
                </span>
              </div>
              {[...roles].sort().map((role) => {
                const td = localHiring[role] || { target: 0, location: "" };
                return (
                  <div
                    key={role}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 56px 90px 22px",
                      gap: "0.4rem",
                      padding: "0.3rem 0.5rem",
                      background: "var(--surface3)",
                      borderRadius: 7,
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                      title={role}
                    >
                      {role}
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={td.target}
                      onChange={(e) => updateTarget(role, parseInt(e.target.value, 10) || 0)}
                      style={{
                        width: "100%",
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "0.25rem 0.4rem",
                        color: "var(--text)",
                        fontSize: "0.75rem",
                        textAlign: "center",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    />
                    <select
                      value={td.location}
                      onChange={(e) => updateLoc(role, e.target.value)}
                      style={{
                        width: "100%",
                        background: "var(--surface2)",
                        border: "1px solid var(--border)",
                        borderRadius: 6,
                        padding: "0.24rem 0.3rem",
                        color: "var(--text)",
                        fontSize: "0.72rem",
                        outline: "none",
                        fontFamily: "inherit",
                      }}
                    >
                      {LOCS.map((l) => (
                        <option key={l || "any"} value={l}>
                          {l || "Any"}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => void deleteRole(role)}
                      style={{
                        background: "none",
                        border: "1px solid transparent",
                        color: "var(--muted)",
                        cursor: "pointer",
                        fontSize: "1rem",
                        width: 22,
                        height: 22,
                        borderRadius: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                      title="Remove role"
                    >
                      ×
                    </button>
                  </div>
                );
              })}
            </div>
            <div
              style={{
                display: "flex",
                gap: "0.4rem",
                alignItems: "center",
                paddingTop: "0.6rem",
                borderTop: "1px solid var(--border)",
              }}
            >
              <input
                type="text"
                placeholder="New role name…"
                value={newRoleInput}
                onChange={(e) => setNewRoleInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void addRoleInline();
                }}
                style={{
                  flex: 1,
                  background: "var(--surface3)",
                  border: "1px solid var(--border)",
                  borderRadius: 7,
                  padding: "0.32rem 0.6rem",
                  color: "var(--text)",
                  fontFamily: "var(--font-dm), 'DM Sans', sans-serif",
                  fontSize: "0.73rem",
                  outline: "none",
                }}
              />
              <button
                type="button"
                onClick={() => void addRoleInline()}
                style={{
                  background: "var(--accent)",
                  border: "none",
                  borderRadius: 7,
                  padding: "0.32rem 0.75rem",
                  color: "#000",
                  fontSize: "0.72rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "inherit",
                  whiteSpace: "nowrap",
                }}
              >
                + Add
              </button>
            </div>
            <button
              type="button"
              onClick={() => void saveTargets()}
              style={{
                marginTop: "0.8rem",
                width: "100%",
                background: "var(--accent)",
                border: "none",
                borderRadius: 8,
                padding: "0.45rem",
                color: "#000",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Save Targets
            </button>
            <span
              style={{
                fontSize: "0.68rem",
                color: "var(--green)",
                display: "block",
                marginTop: "0.4rem",
                textAlign: "center",
              }}
            >
              {hsTargetMsg}
            </span>
          </div>
          <div className="card">
            <div className="card-title" style={{ marginBottom: "1rem" }}>
              📈 Pipeline by Stage
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {SHOW.map((s) => {
                const v = stageChartTotals[s] || 0;
                const w = Math.round((v / maxV) * 100);
                return (
                  <div key={s} style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <span
                      style={{
                        fontSize: "0.65rem",
                        color: "var(--muted2)",
                        width: 58,
                        textAlign: "right",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {LABELS[s]}
                    </span>
                    <div
                      style={{
                        flex: 1,
                        height: 14,
                        background: "var(--surface3)",
                        borderRadius: 4,
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          width: `${w}%`,
                          background: COLORS[s],
                          borderRadius: 4,
                        }}
                      />
                    </div>
                    <span style={{ fontSize: "0.7rem", fontWeight: 700, color: COLORS[s], width: 20 }}>{v}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = { initial: DashboardState };

export function InterviewTrackerApp({ initial }: Props) {
  const [data, setData] = useState(initial);
  const [view, setView] = useState<"offers" | "eod" | "hiring">("offers");
  const [filters, setFilters] = useState<FilterState>({
    q: "",
    dept: "",
    role: "",
    status: "",
    source: "",
    owner: "",
    location: "",
    todayOnly: false,
  });
  const [eodActiveRec, setEodActiveRec] = useState("");
  const [localHiring, setLocalHiring] = useState(() => mergeHiringTargets(initial.hiringTargets));
  const [eodMsg, setEodMsg] = useState("");
  const [eodMsgColor, setEodMsgColor] = useState("var(--green)");
  const [hsTargetMsg, setHsTargetMsg] = useState("");
  const [newRoleInput, setNewRoleInput] = useState("");

  const [eodForm, setEodForm] = useState({
    date: "",
    recruiter: "",
    location: "",
    rsProfile: "",
    rsScreened: "",
    rsShortlisted: "",
    scProfile: "",
    scCalls: "",
    scShortlisted: "",
    vrProfile: "",
    vrRounds: "",
    vrShortlisted: "",
    arProfile: "",
    arType: "",
    arConducted: "",
    arSelected: "",
    frProfile: "",
    frRounds: "",
    frSelected: "",
    other: "",
  });

  const applyDashboard = useCallback((next: DashboardState) => {
    setData(next);
    setLocalHiring(mergeHiringTargets(next.hiringTargets));
  }, []);

  const refresh = useCallback(async () => {
    const r = await fetch("/api/state");
    applyDashboard(await r.json());
  }, [applyDashboard]);

  const filtered = useMemo(() => filterCandidates(data.candidates, filters), [data.candidates, filters]);
  const kpis = useMemo(() => computeKpis(filtered), [filtered]);

  const persistHiring = async (next: Record<string, { target: number; location: string }>) => {
    await fetch("/api/hiring-targets", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targets: next }),
    });
    await refresh();
  };

  const dateDisplay = useMemo(
    () =>
      new Date().toLocaleDateString("en-IN", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }) + " · Recruitment",
    [],
  );

  const exportPipelineCsv = () => {
    const hdr = ["Date", "Candidate", "Department", "Role", "Source", "Owner", "Status", "Rating", "Location", "Notes"];
    const rows = filtered.map((c) => [
      c.date,
      c.candidate,
      c.dept,
      c.role,
      c.source,
      c.owner,
      c.status,
      c.rating ?? "",
      c.location,
      c.notes,
    ]);
    downloadCsv("pipeline.csv", [hdr, ...rows]);
  };

  const offerExport = () => {
    const hdr = ["Name", "Role", "Dept", "Offer Date", "Joining Date", "Status", "Notes"];
    const rows = data.offers.map((o) => [
      o.name,
      o.role,
      o.dept,
      o.offerdate || "",
      o.joindate || "",
      o.status,
      o.notes || "",
    ]);
    downloadCsv("onboardings.csv", [hdr, ...rows]);
  };

  const deleteOfferRow = async (id: number) => {
    await fetch(`/api/offers?id=${id}`, { method: "DELETE" });
    await refresh();
  };

  const allForFunnel = data.candidates;
  const stageCounts = useMemo(() => funnelStageCounts(allForFunnel), [allForFunnel]);
  const maxCount = Math.max(...FUNNEL_STAGES.map((s) => stageCounts[s.key] || 0), 1);
  const screeningTotal = stageCounts.screening || 0;

  const convItems = [
    { label: "Screening → R1", from: "screening" as const, to: "r1" as const },
    { label: "R1 → R2", from: "r1", to: "r2" },
    { label: "R2 → Final", from: "r2", to: "final" },
    { label: "Final → Offer", from: "final", to: "offer" },
    { label: "Offer → Joined", from: "offer", to: "joined" },
    { label: "Overall", from: "screening", to: "joined" },
  ];

  const srcCounts: Record<string, number> = {};
  const deptCounts: Record<string, number> = {};
  for (const c of filtered) {
    srcCounts[c.source] = (srcCounts[c.source] || 0) + 1;
    deptCounts[c.dept] = (deptCounts[c.dept] || 0) + 1;
  }

  const fStages: [string, string][] = [
    ["Applied", "var(--muted2)"],
    ["Screening", "var(--blue)"],
    ["Shortlisted", "var(--accent)"],
    ["Interview Scheduled", "var(--purple)"],
    ["Rejected", "var(--red)"],
    ["Withdrawn", "var(--muted)"],
    ["DNP", "var(--yellow)"],
  ];
  const tot = filtered.length || 1;

  const own: Record<
    string,
    { t: number; advanced: number; offers: number; joined: number; r: number }
  > = {};
  for (const c of filtered) {
    if (!own[c.owner]) own[c.owner] = { t: 0, advanced: 0, offers: 0, joined: 0, r: 0 };
    const d = own[c.owner];
    d.t++;
    if (
      [
        "Round 1 - Virtual Interview",
        "Round 2 - Assessment",
        "Final Round",
        "Offer Made",
        "Offer Accepted",
        "Joined",
      ].includes(c.status)
    )
      d.advanced++;
    if (["Offer Made", "Offer Accepted", "Joined"].includes(c.status)) d.offers++;
    if (c.status === "Joined") d.joined++;
    if (c.status.includes("Rejected") || c.status === "DNP" || c.status === "Withdrawn") d.r++;
  }

  const rated = filtered.filter((c) => c.rating != null);
  const bk = [0, 0, 0, 0, 0];
  for (const c of rated) {
    const rr = Math.round(c.rating as number) - 1;
    if (rr >= 0 && rr < 5) bk[rr]++;
  }
  const mx2 = Math.max(...bk, 1);
  const RC = ["#f87171", "#fb923c", "#fbbf24", "#60a5fa", "#34d399"];

  const roles = useMemo(() => Object.keys(localHiring).sort(), [localHiring]);
  const roleData = useMemo(
    () => hsGetRoleData(data.candidates, localHiring),
    [data.candidates, localHiring],
  );
  const hsKpis = useMemo(
    () => hiringSummaryKpis(roles, roleData, localHiring),
    [roles, roleData, localHiring],
  );

  const todayIso = new Date().toISOString().slice(0, 10);
  const todayReports = data.eodReports.filter((r) => r.date === todayIso);

  const eodList = eodFilteredReports(data.eodReports, eodActiveRec);

  const initEodTab = () => {
    const today = new Date().toISOString().slice(0, 10);
    setEodForm((f) => ({ ...f, date: today }));
  };

  const submitEod = async () => {
    if (!eodForm.recruiter || !eodForm.date) {
      setEodMsg("⚠ Please enter recruiter name and date.");
      setEodMsgColor("var(--red)");
      return;
    }
    const gi = (s: string) => parseInt(s, 10) || 0;
    const body = {
      date: eodForm.date,
      recruiter: eodForm.recruiter,
      location: eodForm.location,
      resumeShortlisting: {
        profile: eodForm.rsProfile,
        screened: gi(eodForm.rsScreened),
        shortlisted: gi(eodForm.rsShortlisted),
      },
      screeningCalls: {
        profile: eodForm.scProfile,
        calls: gi(eodForm.scCalls),
        shortlisted: gi(eodForm.scShortlisted),
      },
      virtualRounds: {
        profile: eodForm.vrProfile,
        rounds: gi(eodForm.vrRounds),
        shortlisted: gi(eodForm.vrShortlisted),
      },
      assignment: {
        profile: eodForm.arProfile,
        type: eodForm.arType,
        conducted: gi(eodForm.arConducted),
        selected: gi(eodForm.arSelected),
      },
      finalRound: {
        profile: eodForm.frProfile,
        rounds: gi(eodForm.frRounds),
        selected: gi(eodForm.frSelected),
      },
      otherTasks: eodForm.other,
      submittedAt: new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
    };
    await fetch("/api/eod", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEodMsg("✓ EOD report submitted!");
    setEodMsgColor("var(--green)");
    setTimeout(() => setEodMsg(""), 3000);
    await refresh();
  };

  const clearEodForm = () => {
    setEodForm((f) => ({
      ...f,
      location: "",
      rsProfile: "",
      rsScreened: "",
      rsShortlisted: "",
      scProfile: "",
      scCalls: "",
      scShortlisted: "",
      vrProfile: "",
      vrRounds: "",
      vrShortlisted: "",
      arProfile: "",
      arType: "",
      arConducted: "",
      arSelected: "",
      frProfile: "",
      frRounds: "",
      frSelected: "",
      other: "",
    }));
    setEodMsg("");
  };

  const deleteEod = async (id: number) => {
    await fetch(`/api/eod?id=${id}`, { method: "DELETE" });
    await refresh();
  };

  const editEod = async (r: EodReport) => {
    await fetch(`/api/eod?id=${r.id}`, { method: "DELETE" });
    await refresh();
    setEodForm({
      date: r.date,
      recruiter: r.recruiter,
      location: r.location || "",
      rsProfile: r.resumeShortlisting?.profile || "",
      rsScreened: String(r.resumeShortlisting?.screened ?? ""),
      rsShortlisted: String(r.resumeShortlisting?.shortlisted ?? ""),
      scProfile: r.screeningCalls?.profile || "",
      scCalls: String(r.screeningCalls?.calls ?? ""),
      scShortlisted: String(r.screeningCalls?.shortlisted ?? ""),
      vrProfile: r.virtualRounds?.profile || "",
      vrRounds: String(r.virtualRounds?.rounds ?? ""),
      vrShortlisted: String(r.virtualRounds?.shortlisted ?? ""),
      arProfile: r.assignment?.profile || "",
      arType: r.assignment?.type || "",
      arConducted: String(r.assignment?.conducted ?? ""),
      arSelected: String(r.assignment?.selected ?? ""),
      frProfile: r.finalRound?.profile || "",
      frRounds: String(r.finalRound?.rounds ?? ""),
      frSelected: String(r.finalRound?.selected ?? ""),
      other: r.otherTasks || "",
    });
    setEodMsg("Editing — resubmit to save");
    setEodMsgColor("var(--yellow)");
  };

  const eodExportCsv = () => {
    if (!data.eodReports.length) {
      window.alert("No EOD reports to export.");
      return;
    }
    const headers = [
      "Date",
      "Recruiter",
      "Location",
      "RS-Screened",
      "RS-Shortlisted",
      "SC-Calls",
      "SC-Shortlisted",
      "VR-Rounds",
      "VR-Shortlisted",
      "AR-Conducted",
      "AR-Selected",
      "FR-Rounds",
      "FR-Selected",
      "Other Tasks",
    ];
    const rows = data.eodReports.map((r) => {
      const rs = r.resumeShortlisting || {};
      const sc = r.screeningCalls || {};
      const vr = r.virtualRounds || {};
      const ar = r.assignment || {};
      const fr = r.finalRound || {};
      return [
        r.date,
        r.recruiter,
        r.location || "",
        rs.screened || 0,
        rs.shortlisted || 0,
        sc.calls || 0,
        sc.shortlisted || 0,
        vr.rounds || 0,
        vr.shortlisted || 0,
        ar.conducted || 0,
        ar.selected || 0,
        fr.rounds || 0,
        fr.selected || 0,
        r.otherTasks || "",
      ];
    });
    downloadCsv(`EOD_Report_${todayIso}.csv`, [headers, ...rows]);
  };

  const sortedOffers = useMemo(() => sortOffersForTable(data.offers), [data.offers]);

  const stageChartTotals: Record<string, number> = {
    Screening: 0,
    "Round 1 - Virtual Interview": 0,
    "Round 2 - Assessment": 0,
    "Final Round": 0,
    "Offer Made": 0,
    Joined: 0,
  };
  const SHOW = Object.keys(stageChartTotals) as (keyof typeof stageChartTotals)[];
  for (const r of roles) {
    for (const s of SHOW) {
      stageChartTotals[s] += roleData[r]?.pipeline[s] || 0;
    }
  }
  const maxV = Math.max(...SHOW.map((s) => stageChartTotals[s]), 1);
  const LABELS: Record<string, string> = {
    Screening: "Screening",
    "Round 1 - Virtual Interview": "Round 1",
    "Round 2 - Assessment": "Round 2",
    "Final Round": "Final",
    "Offer Made": "Offer",
    Joined: "Joined",
  };
  const COLORS: Record<string, string> = {
    Screening: "#60a5fa",
    "Round 1 - Virtual Interview": "#a78bfa",
    "Round 2 - Assessment": "#f97316",
    "Final Round": "#fbbf24",
    "Offer Made": "#34d399",
    Joined: "#2dd4bf",
  };

  return (
    <div className="interview-track">
      <div className="ambient" />
      <div className="noise" />
      <div className="main">
        <div className="top-bar">
          <div>
            <div className="dept-label">Recruitment Operations</div>
            <h1>Interview Tracker</h1>
            <div className="date-display">{dateDisplay}</div>
          </div>
          <div className="top-right">
            <button type="button" className="iv-export-btn" onClick={exportPipelineCsv}>
              ⬇ Export CSV
            </button>
            <div className="badge">
              <div className="badge-dot" />
              Live Data
            </div>
          </div>
        </div>

        <div className="iv-top-bar">
          <div className="iv-view-toggle">
            <button
              type="button"
              className={`iv-view-btn${view === "offers" ? " active" : ""}`}
              onClick={() => {
                setView("offers");
              }}
            >
              📊 Recruitment Overview
            </button>
            <button
              type="button"
              className={`iv-view-btn${view === "eod" ? " active" : ""}`}
              onClick={() => {
                setView("eod");
                initEodTab();
              }}
            >
              📝 EOD Reports
            </button>
            <button
              type="button"
              className={`iv-view-btn${view === "hiring" ? " active" : ""}`}
              onClick={() => setView("hiring")}
            >
              🎯 Hiring Status
            </button>
          </div>
          <div className="iv-filter-row">
            <div className="iv-search">
              <span>🔍</span>
              <input
                type="text"
                placeholder="Search..."
                value={filters.q}
                onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
              />
            </div>
            <select
              value={filters.dept}
              onChange={(e) => setFilters((f) => ({ ...f, dept: e.target.value }))}
            >
              <option value="">All Depts</option>
              {DEPTS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              value={filters.role}
              onChange={(e) => setFilters((f) => ({ ...f, role: e.target.value }))}
            >
              <option value="">All Roles</option>
              {ROLES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            >
              <option value="">All Status</option>
              {STATUSES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              value={filters.source}
              onChange={(e) => setFilters((f) => ({ ...f, source: e.target.value }))}
            >
              <option value="">All Sources</option>
              {SOURCES.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              value={filters.owner}
              onChange={(e) => setFilters((f) => ({ ...f, owner: e.target.value }))}
            >
              <option value="">All Owners</option>
              {OWNERS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <select
              value={filters.location}
              onChange={(e) => setFilters((f) => ({ ...f, location: e.target.value }))}
            >
              <option value="">All Locations</option>
              {LOCATIONS.map((d) => (
                <option key={d}>{d}</option>
              ))}
            </select>
            <button
              type="button"
              className={`iv-today-btn${filters.todayOnly ? " active" : ""}`}
              onClick={() => setFilters((f) => ({ ...f, todayOnly: !f.todayOnly }))}
            >
              📅 Today
            </button>
            <button type="button" className="iv-export-btn" onClick={exportPipelineCsv}>
              ⬇ CSV
            </button>
          </div>
        </div>

        <div className="iv-kpi-strip iv-kpi-strip-10">
          <div className="iv-kpi">
            <div className="iv-kpi-val">{kpis.total}</div>
            <div className="iv-kpi-lbl">Total</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "var(--blue)" }}>
              {kpis.screening}
            </div>
            <div className="iv-kpi-lbl">Screening</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "#818cf8" }}>
              {kpis.r1}
            </div>
            <div className="iv-kpi-lbl">Round 1</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "#a78bfa" }}>
              {kpis.r2}
            </div>
            <div className="iv-kpi-lbl">Round 2</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "var(--accent)" }}>
              {kpis.final}
            </div>
            <div className="iv-kpi-lbl">Final</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "#34d399" }}>
              {kpis.offer}
            </div>
            <div className="iv-kpi-lbl">Offers</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "var(--green)" }}>
              {kpis.joined}
            </div>
            <div className="iv-kpi-lbl">Joined</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "var(--red)" }}>
              {kpis.rejected}
            </div>
            <div className="iv-kpi-lbl">Rejected</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "var(--yellow)" }}>
              {kpis.dnp}
            </div>
            <div className="iv-kpi-lbl">DNP</div>
          </div>
          <div className="iv-kpi">
            <div className="iv-kpi-val" style={{ color: "var(--green)" }}>
              {kpis.offerRate}
            </div>
            <div className="iv-kpi-lbl">Offer Rate</div>
          </div>
        </div>

        {view === "eod" && (
          <EodSection
            eodForm={eodForm}
            setEodForm={setEodForm}
            eodActiveRec={eodActiveRec}
            setEodActiveRec={setEodActiveRec}
            eodList={eodList}
            eodMsg={eodMsg}
            eodMsgColor={eodMsgColor}
            submitEod={submitEod}
            clearEodForm={clearEodForm}
            deleteEod={deleteEod}
            editEod={editEod}
            eodExportCsv={eodExportCsv}
            dateLabel={dateDisplay}
          />
        )}

        {view === "hiring" && (
          <HiringSection
            hsKpis={hsKpis}
            roles={roles}
            roleData={roleData}
            localHiring={localHiring}
            setLocalHiring={setLocalHiring}
            persistHiring={persistHiring}
            newRoleInput={newRoleInput}
            setNewRoleInput={setNewRoleInput}
            hsTargetMsg={hsTargetMsg}
            setHsTargetMsg={setHsTargetMsg}
            todayReports={todayReports}
            stageChartTotals={stageChartTotals}
            SHOW={SHOW}
            maxV={maxV}
            LABELS={LABELS}
            COLORS={COLORS}
            sortedRoles={[...roles].sort((a, b) => (roleData[b]?.total || 0) - (roleData[a]?.total || 0))}
          />
        )}

        {view === "offers" && (
          <>
            <div className="card" style={{ marginBottom: "1.2rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "1.2rem",
                }}
              >
                <div className="card-title">🎯 Interview Pipeline Funnel</div>
                <div style={{ fontSize: "0.72rem", color: "var(--muted2)" }}>
                  {screeningTotal} total candidates in pipeline
                </div>
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: "0.5rem",
                  height: 160,
                  padding: "0 0.5rem",
                }}
              >
                {FUNNEL_STAGES.map((s) => {
                  const n = stageCounts[s.key] || 0;
                  const barH = Math.max(Math.round((n / maxCount) * 140), n > 0 ? 8 : 3);
                  return (
                    <div
                      key={s.key}
                      style={{
                        flex: 1,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "flex-end",
                        gap: "0.3rem",
                      }}
                    >
                      <div style={{ fontSize: "0.85rem", fontWeight: 700, color: s.color }}>{n}</div>
                      <div
                        style={{
                          width: "100%",
                          background: s.color,
                          borderRadius: "6px 6px 0 0",
                          height: barH,
                          opacity: 0.85,
                          minHeight: 4,
                        }}
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.8rem", padding: "0 0.5rem" }}>
                {FUNNEL_STAGES.map((s) => (
                  <div
                    key={s.key}
                    style={{ flex: 1, textAlign: "center", fontSize: "0.63rem", color: "var(--muted2)" }}
                  >
                    {s.label}
                  </div>
                ))}
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "0.5rem",
                  marginTop: "1rem",
                  paddingTop: "0.9rem",
                  borderTop: "1px solid var(--border)",
                }}
              >
                {convItems.map((cv) => {
                  const fromN = stageCounts[cv.from] || 0;
                  const toN = stageCounts[cv.to] || 0;
                  const pct = fromN > 0 ? Math.round((toN / fromN) * 100) : 0;
                  const clr = pct >= 50 ? "var(--green)" : pct >= 20 ? "var(--yellow)" : "var(--red)";
                  return (
                    <div key={cv.label} style={{ flex: 1, textAlign: "center" }}>
                      <div style={{ fontSize: "0.95rem", fontWeight: 700, color: clr }}>{pct}%</div>
                      <div style={{ fontSize: "0.6rem", color: "var(--muted2)", marginTop: "0.1rem" }}>
                        {cv.label}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="iv-analytics-grid">
              <div className="card">
                <div className="card-title">Applications by Source</div>
                <BarList entries={sortedEntries(srcCounts)} />
              </div>
              <div className="card">
                <div className="card-title">By Department</div>
                <BarList entries={sortedEntries(deptCounts)} />
              </div>
              <div className="card" style={{ gridColumn: "span 2" }}>
                <div className="card-title">Daily Application Volume</div>
                <VolumeChart data={filtered} />
              </div>
              <div className="card">
                <div className="card-title">Pipeline Funnel</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginTop: "0.4rem" }}>
                  {fStages.map((fs) => {
                    const cnt = filtered.filter(
                      (c) => c.status === fs[0] || c.status === `${fs[0]} (Post-Interview)`,
                    ).length;
                    const pct = Math.round((cnt / tot) * 100);
                    return (
                      <div key={fs[0]}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            marginBottom: "0.2rem",
                          }}
                        >
                          <span style={{ fontSize: "0.7rem", color: "var(--muted2)" }}>{fs[0]}</span>
                          <span style={{ fontSize: "0.7rem", fontWeight: 600, color: fs[1] }}>
                            {cnt} ({pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            background: "var(--surface2)",
                            borderRadius: 4,
                            height: 8,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: "100%",
                              background: fs[1],
                              borderRadius: 4,
                              opacity: 0.8,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div className="card">
                <div className="card-title">Recruiter Performance</div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.4rem" }}>
                  {Object.entries(own)
                    .sort((a, b) => b[1].t - a[1].t)
                    .map(([name, d], i) => {
                      const advPct = d.t > 0 ? Math.round((d.advanced / d.t) * 100) : 0;
                      return (
                        <div
                          key={name}
                          style={{
                            background: "var(--surface2)",
                            borderRadius: 10,
                            padding: "0.7rem",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              marginBottom: "0.5rem",
                            }}
                          >
                            <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{name}</span>
                            <span style={{ fontSize: "0.68rem", color: "var(--muted2)" }}>{d.t} sourced</span>
                          </div>
                          <div style={{ display: "flex", gap: "0.8rem", flexWrap: "wrap" }}>
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: "0.63rem",
                                  color: "var(--muted2)",
                                  marginBottom: "0.1rem",
                                }}
                              >
                                Advanced
                              </div>
                              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: CLRS[i % 3] }}>
                                {d.advanced}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: "0.63rem",
                                  color: "var(--muted2)",
                                  marginBottom: "0.1rem",
                                }}
                              >
                                Offers
                              </div>
                              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#34d399" }}>
                                {d.offers}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: "0.63rem",
                                  color: "var(--muted2)",
                                  marginBottom: "0.1rem",
                                }}
                              >
                                Joined
                              </div>
                              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--green)" }}>
                                {d.joined}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: "0.63rem",
                                  color: "var(--muted2)",
                                  marginBottom: "0.1rem",
                                }}
                              >
                                Drop-off
                              </div>
                              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--red)" }}>
                                {d.r}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: "0.63rem",
                                  color: "var(--muted2)",
                                  marginBottom: "0.1rem",
                                }}
                              >
                                Adv%
                              </div>
                              <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--yellow)" }}>
                                {advPct}%
                              </div>
                            </div>
                          </div>
                          <div
                            style={{
                              marginTop: "0.5rem",
                              background: "var(--surface3)",
                              borderRadius: 4,
                              height: 5,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${advPct}%`,
                                height: "100%",
                                background: CLRS[i % 3],
                                borderRadius: 4,
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
              <div className="card" style={{ gridColumn: "span 2" }}>
                <div className="card-title">Rating Distribution</div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: "0.6rem",
                    height: 80,
                    marginTop: "0.8rem",
                    padding: "0 0.5rem",
                  }}
                >
                  {bk.map((count, ri) => {
                    const bh = Math.round((count / mx2) * 72) || 2;
                    return (
                      <div
                        key={ri}
                        style={{
                          flex: 1,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: "0.3rem",
                        }}
                      >
                        <div style={{ fontSize: "0.65rem", color: "var(--muted2)" }}>{count}</div>
                        <div
                          style={{
                            width: "100%",
                            height: bh,
                            background: RC[ri],
                            borderRadius: "4px 4px 0 0",
                          }}
                        />
                        <div style={{ fontSize: "0.68rem", color: "var(--muted2)" }}>{ri + 1}★</div>
                      </div>
                    );
                  })}
                </div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--muted2)",
                    textAlign: "center",
                    marginTop: "0.5rem",
                  }}
                >
                  {rated.length} of {filtered.length} rated
                </div>
              </div>
            </div>

            <div className="card" style={{ marginTop: "1.2rem" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "0.9rem",
                }}
              >
                <div className="card-title" style={{ fontSize: "1rem" }}>
                  📅 Upcoming & Recent Onboardings
                </div>
                <button type="button" className="iv-export-btn" onClick={offerExport}>
                  ⬇ Export CSV
                </button>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="iv-table" style={{ width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Role</th>
                      <th>Dept</th>
                      <th>Offer Date</th>
                      <th>Joining Date</th>
                      <th>Status</th>
                      <th>Notes</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {!sortedOffers.length ? (
                      <tr>
                        <td colSpan={8} className="no-entries">
                          <div className="no-entries-icon">📅</div>No entries
                        </td>
                      </tr>
                    ) : (
                      sortedOffers.map((o) => {
                        const bg = OF_STATUS_BG[o.status] || "rgba(100,116,139,0.1)";
                        const clr = OF_STATUS_CLR[o.status] || "var(--muted2)";
                        let daysLabel: ReactNode = null;
                        if (o.joindate) {
                          const diff = Math.round(
                            (new Date(o.joindate).getTime() - new Date(todayIso).getTime()) / 86400000,
                          );
                          if (diff > 0) {
                            daysLabel = (
                              <span
                                style={{
                                  fontSize: "0.6rem",
                                  background: "rgba(52,211,153,0.15)",
                                  color: "var(--green)",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: 8,
                                  marginLeft: "0.4rem",
                                }}
                              >
                                in {diff}d
                              </span>
                            );
                          } else if (diff === 0) {
                            daysLabel = (
                              <span
                                style={{
                                  fontSize: "0.6rem",
                                  background: "rgba(251,191,36,0.2)",
                                  color: "var(--yellow)",
                                  padding: "0.1rem 0.35rem",
                                  borderRadius: 8,
                                  marginLeft: "0.4rem",
                                }}
                              >
                                Today!
                              </span>
                            );
                          }
                        }
                        return (
                          <tr key={o.id}>
                            <td style={{ fontWeight: 600, fontSize: "0.8rem" }}>{o.name}</td>
                            <td style={{ fontSize: "0.73rem" }}>
                              <span
                                style={{
                                  background: "var(--surface2)",
                                  padding: "0.1rem 0.4rem",
                                  borderRadius: 4,
                                }}
                              >
                                {o.role}
                              </span>
                            </td>
                            <td style={{ fontSize: "0.72rem", color: "var(--muted2)" }}>{o.dept}</td>
                            <td style={{ fontSize: "0.72rem", color: "var(--muted2)" }}>
                              {o.offerdate || "—"}
                            </td>
                            <td style={{ fontSize: "0.72rem" }}>
                              {o.joindate ? (
                                <>
                                  {o.joindate}
                                  {daysLabel}
                                </>
                              ) : (
                                "—"
                              )}
                            </td>
                            <td>
                              <span
                                style={{
                                  display: "inline-block",
                                  padding: "0.15rem 0.55rem",
                                  borderRadius: 20,
                                  fontSize: "0.63rem",
                                  fontWeight: 600,
                                  background: bg,
                                  color: clr,
                                }}
                              >
                                {o.status}
                              </span>
                            </td>
                            <td
                              style={{
                                fontSize: "0.7rem",
                                color: "var(--muted2)",
                                maxWidth: 180,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {o.notes || "—"}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="del-btn"
                                title="Remove"
                                onClick={() => deleteOfferRow(o.id)}
                              >
                                ✕
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
