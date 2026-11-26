import { changePct, fmt } from "@/lib/format";
import type { DataMode, Kpi, RankedItem } from "@/lib/data/types";

export function DataBanner({ mode, collectedAt, source }: { mode: DataMode; collectedAt: string | null; source: string }) {
  if (mode === "sample") {
    return (
      <div className="banner">
        <strong>샘플 데이터</strong> — 아래 수치는 화면 확인용으로 만든 가짜 값이며 실제 {source} 성과가 아닙니다.
      </div>
    );
  }
  return (
    <div className="banner live">
      <strong>실제 데이터</strong> — {source} · 마지막 수집 {collectedAt ? new Date(collectedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) : "기록 없음"}
    </div>
  );
}

export function KpiGrid({ kpis }: { kpis: Kpi[] }) {
  return (
    <div className="grid kpis">
      {kpis.map((k) => {
        const pct = changePct(k.value, k.prev);
        return (
          <div className="card" key={k.label}>
            <div className="kpi-label">{k.label}</div>
            <div className="kpi-value">{fmt(k.value, k.decimals ?? 0, k.unit ?? "")}</div>
            <div className="kpi-delta">
              {k.value === null ? (
                "API 제공 여부 확인 필요"
              ) : pct === null ? (
                "비교 데이터 없음"
              ) : (
                <>
                  이전 기간 대비{" "}
                  <span className={pct >= 0 ? "up" : "down"}>
                    {pct >= 0 ? "▲" : "▼"} {Math.abs(pct).toFixed(1)}%
                  </span>
                </>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function BarList({ items }: { items: RankedItem[] }) {
  const max = Math.max(...items.map((i) => i.value), 1);
  return (
    <div className="bars">
      {items.map((i) => (
        <div className="bar-row" key={i.label} title={`${i.label}: ${fmt(i.value)}`}>
          <span className="bar-label">{i.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(i.value / max) * 100}%` }} />
          </div>
          <span className="bar-value">{fmt(i.value)}</span>
        </div>
      ))}
    </div>
  );
}
