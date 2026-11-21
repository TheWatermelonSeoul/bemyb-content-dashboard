"use client";

import { useState } from "react";
import type { DailyPoint } from "@/lib/data/types";

type Props = {
  current: DailyPoint[];
  previous?: DailyPoint[];
  label: string;
};

const W = 900;
const H = 260;
const PAD = { top: 12, right: 12, bottom: 28, left: 48 };

export default function LineChart({ current, previous, label }: Props) {
  const [hover, setHover] = useState<number | null>(null);
  const all = [...current, ...(previous ?? [])].map((p) => p.value);
  const max = Math.max(...all, 1) * 1.1;
  const n = current.length;
  const x = (i: number) => PAD.left + (n === 1 ? 0 : (i / (n - 1)) * (W - PAD.left - PAD.right));
  const y = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
  const path = (pts: DailyPoint[]) => pts.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const ticks = [0, 0.5, 1].map((t) => Math.round((max / 1.1) * t));
  const labelEvery = Math.max(1, Math.round(n / 6));

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = ((e.clientX - rect.left) / rect.width) * W;
    const i = Math.round(((rel - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1));
    setHover(Math.min(n - 1, Math.max(0, i)));
  }

  return (
    <div className="chart">
      {previous && (
        <div className="legend">
          <span><i style={{ background: "var(--series-1)" }} />이번 기간</span>
          <span><i style={{ background: "var(--series-prev)" }} />이전 기간</span>
        </div>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label} 일별 추이`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} fontSize={11} textAnchor="end" fill="var(--text-muted)">
              {t.toLocaleString("ko-KR")}
            </text>
          </g>
        ))}
        {current.map((p, i) =>
          i % labelEvery === 0 ? (
            <text key={p.date} x={x(i)} y={H - 8} fontSize={11} textAnchor="middle" fill="var(--text-muted)">
              {p.date.slice(5).replace("-", ".")}
            </text>
          ) : null,
        )}
        {previous && <path d={path(previous)} fill="none" stroke="var(--series-prev)" strokeWidth={2} strokeDasharray="4 3" />}
        <path d={path(current)} fill="none" stroke="var(--series-1)" strokeWidth={2} strokeLinejoin="round" />
        {hover !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={H - PAD.bottom} stroke="var(--text-muted)" strokeWidth={1} />
            <circle cx={x(hover)} cy={y(current[hover].value)} r={4.5} fill="var(--series-1)" stroke="var(--surface-1)" strokeWidth={2} />
          </g>
        )}
        <rect
          x={PAD.left}
          y={PAD.top}
          width={W - PAD.left - PAD.right}
          height={H - PAD.top - PAD.bottom}
          fill="transparent"
          onMouseMove={onMove}
          onMouseLeave={() => setHover(null)}
        />
      </svg>
      {hover !== null && (
        <div className="tooltip" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(current[hover].value) / H) * 100}%` }}>
          {current[hover].date} · {label} {current[hover].value.toLocaleString("ko-KR")}
          {previous?.[hover] && <><br />이전 기간 같은 순번 {previous[hover].value.toLocaleString("ko-KR")}</>}
        </div>
      )}
    </div>
  );
}
