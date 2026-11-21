import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { DailyPoint, Kpi, RankedItem } from "./types";

/** scripts/acecounter/collect.mjs 가 저장한 실제 데이터를 읽는다. 없으면 null */

const DIR = path.join(process.cwd(), "data", "acecounter");

type DailyRow = { date: string; visits?: number | null; newVisits?: number | null; returnVisits?: number | null; pageviews?: number | null };
type DayFile = {
  date: string;
  pages: { url: string; name: string | null; pageviews: number | null }[];
  sources: { source: string; visits: number | null }[];
  domains: { domain: string; visits: number | null }[];
};

function readJson<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function addDays(s: string, n: number) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dates(from: string, to: string) {
  const out: string[] = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

function sumBy<T>(items: T[], key: (t: T) => string, val: (t: T) => number | null) {
  const m = new Map<string, number>();
  for (const it of items) m.set(key(it), (m.get(key(it)) ?? 0) + (val(it) ?? 0));
  return [...m.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
}

const SITES = [
  { key: "pc", label: "PC (dub.imweb.me)" },
  { key: "mobile", label: "모바일 (bemyb.kr)" },
] as const;

/** PC·모바일 일별 수치를 날짜별로 더한다 */
function mergeDaily(list: Record<string, DailyRow>[]) {
  const out: Record<string, DailyRow> = {};
  for (const daily of list) {
    for (const [d, r] of Object.entries(daily)) {
      const o = (out[d] ||= { date: d });
      for (const k of ["visits", "newVisits", "returnVisits", "pageviews"] as const) {
        if (typeof r[k] === "number") o[k] = (o[k] ?? 0) + (r[k] as number);
      }
    }
  }
  return out;
}

export function loadAceCounter(days: number) {
  const perSite = SITES.map((s) => ({
    ...s,
    daily: readJson<Record<string, DailyRow>>(path.join(DIR, s.key, "daily.json")) ?? {},
  }));
  const daily = mergeDaily(perSite.map((s) => s.daily));
  if (Object.keys(daily).length === 0) return null;

  const all = Object.keys(daily).sort();
  const end = all[all.length - 1];
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));

  const pick = (from: string, to: string) => dates(from, to).map((d) => daily[d] ?? { date: d });
  const cur = pick(start, end);
  const prev = pick(prevStart, prevEnd);
  const total = (rows: DailyRow[], k: keyof DailyRow) => {
    const vals = rows.map((r) => r[k]).filter((v): v is number => typeof v === "number");
    return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
  };
  const ratio = (a: number | null, b: number | null, mul = 1) => (a !== null && b ? (a / b) * mul : null);

  const v = total(cur, "visits"), pv = total(cur, "pageviews"), nv = total(cur, "newVisits");
  const vP = total(prev, "visits"), pvP = total(prev, "pageviews"), nvP = total(prev, "newVisits");
  const prevHasData = prev.some((r) => typeof r.visits === "number");

  const kpis: Kpi[] = [
    { label: "방문수", value: v, prev: prevHasData ? vP : null },
    { label: "페이지뷰", value: pv, prev: prevHasData ? pvP : null },
    { label: "신규 방문 비율", value: ratio(nv, v, 100), prev: prevHasData ? ratio(nvP, vP, 100) : null, unit: "%", decimals: 1 },
    { label: "방문당 페이지뷰", value: ratio(pv, v), prev: prevHasData ? ratio(pvP, vP) : null, decimals: 2 },
  ];

  const toSeries = (rows: DailyRow[]): DailyPoint[] => rows.map((r) => ({ date: r.date, value: r.visits ?? 0 }));

  // 날짜별 파일에서 페이지·유입 합산
  const dayFiles = SITES.flatMap((site) =>
    dates(start, end)
      .map((d) => readJson<DayFile>(path.join(DIR, site.key, "by-date", `${d}.json`)))
      .filter((f): f is DayFile => f !== null),
  );
  const pages = dayFiles.flatMap((f) => f.pages);
  const domains = dayFiles.flatMap((f) => f.domains);
  const sources = dayFiles.flatMap((f) => f.sources);

  const topPages: RankedItem[] = sumBy(pages, (p) => p.name ? `${p.name} (${p.url})` : p.url, (p) => p.pageviews).slice(0, 10);

  // 게시물별 조회수: 주소에 idx=번호 가 남아 있는 페이지만 (에이스카운터 동적페이지 설정 이후)
  const posts = readJson<Record<string, { title: string }>>(path.join(process.cwd(), "data", "bemyb", "posts.json")) ?? {};
  const postPages = pages.filter((p) => /idx=\d+/.test(p.url));
  const topPosts: RankedItem[] = sumBy(
    postPages,
    (p) => {
      const idx = p.url.match(/idx=(\d+)/)![1];
      return posts[idx]?.title ?? `게시물 ${idx}`;
    },
    (p) => p.pageviews,
  ).slice(0, 15);
  const postsKnown = Object.keys(posts).length;
  const topDomains: RankedItem[] = sumBy(domains, (d) => d.domain, (d) => d.visits).slice(0, 10);
  const sourceTypes: RankedItem[] = sumBy(sources, (s) => s.source, (s) => s.visits);

  // 방문수 0 인 날 = 수집 공백 가능성 (서비스 기간 만료 등)
  const zeroDays = cur.filter((r) => r.visits === 0).map((r) => r.date);
  const missingDetail = dates(start, end).length * SITES.length - dayFiles.length;

  // PC·모바일 비중 (방문수)
  const deviceSplit: RankedItem[] = perSite.map((s) => ({
    label: s.label,
    value: dates(start, end).reduce((a, d) => a + (s.daily[d]?.visits ?? 0), 0),
  }));

  const logs = readJson<{ finishedAt?: string }[]>(path.join(DIR, "sync_runs.json")) ?? [];
  const collectedAt = logs.length ? logs[logs.length - 1].finishedAt ?? null : null;

  return {
    period: { start, end },
    collectedAt,
    kpis,
    visits: toSeries(cur),
    prevVisits: prevHasData ? toSeries(prev) : undefined,
    topPages,
    topDomains,
    sourceTypes,
    zeroDays,
    missingDetail,
    deviceSplit,
    topPosts,
    postsKnown,
  };
}
