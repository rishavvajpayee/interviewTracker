"use client";

import type { Candidate } from "@/lib/types";
import { useEffect, useRef, useState } from "react";

type Props = { data: Candidate[] };

export function VolumeChart({ data }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(500);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setW(Math.max(el.offsetWidth || 500, 200)));
    ro.observe(el);
    setW(Math.max(el.offsetWidth || 500, 200));
    return () => ro.disconnect();
  }, []);

  const days: Record<string, number> = {};
  for (const c of data) {
    days[c.date] = (days[c.date] || 0) + 1;
  }
  const sorted = Object.entries(days).sort((a, b) => (a[0] > b[0] ? 1 : -1));
  if (sorted.length <= 1) {
    return (
      <div ref={wrapRef} style={{ height: 140 }}>
        <div style={{ color: "var(--muted)", fontSize: "0.75rem", padding: "0.5rem" }}>
          Add more dates to see volume trend
        </div>
      </div>
    );
  }

  const H = 140;
  const PL = 30,
    PR = 16,
    PT = 14,
    PB = 28;
  const cW = W - PL - PR;
  const cH = H - PT - PB;
  const vals = sorted.map((e) => e[1]);
  const n = sorted.length;
  const mx = (Math.max(...vals) || 1) * 1.2;
  const xp = (i: number) => PL + (n > 1 ? (i / (n - 1)) * cW : cW / 2);
  const yp = (v: number) => PT + cH - (v / mx) * cH;
  const step = n <= 10 ? 1 : n <= 20 ? 2 : 3;

  let area = `M ${xp(0)},${H - PB}`;
  sorted.forEach((_, i) => {
    area += ` L ${xp(i)},${yp(vals[i])}`;
  });
  area += ` L ${xp(n - 1)},${H - PB} Z`;

  let line = "";
  sorted.forEach((_, i) => {
    line += (i === 0 ? "M " : "L ") + `${xp(i)},${yp(vals[i])} `;
  });

  const gridLines: React.ReactNode[] = [];
  for (let ri = 0; ri <= 3; ri++) {
    const ry = PT + (ri / 3) * cH;
    gridLines.push(
      <line
        key={ri}
        x1={PL}
        y1={ry}
        x2={PL + cW}
        y2={ry}
        stroke="rgba(255,255,255,0.04)"
        strokeWidth={1}
      />,
    );
    gridLines.push(
      <text key={`t${ri}`} x={PL - 4} y={ry + 3} textAnchor="end" fill="#64748b" fontSize={8}>
        {Math.round(mx * (1 - ri / 3))}
      </text>,
    );
  }

  const xLabels: React.ReactNode[] = [];
  sorted.forEach((e, i) => {
    if (i % step === 0 || i === n - 1) {
      xLabels.push(
        <text
          key={i}
          x={xp(i)}
          y={H - 5}
          textAnchor="middle"
          fill="#64748b"
          fontSize={8}
        >
          {e[0].slice(5)}
        </text>,
      );
    }
  });

  const circles = sorted.map((_, i) => (
    <circle
      key={i}
      cx={xp(i)}
      cy={yp(vals[i])}
      r={3}
      fill="#f97316"
      stroke="#080b14"
      strokeWidth={1.5}
    />
  ));

  return (
    <div ref={wrapRef} style={{ height: 140 }}>
      <svg width="100%" height={140} viewBox={`0 0 ${W} ${H}`}>
        <defs>
          <linearGradient id="ivgrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f97316" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#f97316" stopOpacity="0" />
          </linearGradient>
        </defs>
        {gridLines}
        {xLabels}
        <path d={area} fill="url(#ivgrad)" />
        <path d={line} fill="none" stroke="#f97316" strokeWidth={2} />
        {circles}
      </svg>
    </div>
  );
}
