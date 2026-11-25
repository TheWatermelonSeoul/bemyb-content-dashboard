import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { ContentRow, DailyPoint, Kpi } from "./types";

const DIR = path.join(process.cwd(), "data", "instagram");

type Day = {
  date: string;
  reach?: number | null;
  profile_views?: number | null;
  website_clicks?: number | null;
  accounts_engaged?: number | null;
  total_interactions?: number | null;
  views?: number | null;
  follower_count?: number | null;
};
type Media = ContentRow & { permalink?: string; views?: number | null };

function readJson<T>(f: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(path.join(DIR, f), "utf8")) as T;
  } catch {
    return null;
  }
}
const addDays = (s: string, n: number) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export function loadInstagram(days: number) {
  const daily = readJson<Record<string, Day>>("daily.json");
  const account = readJson<{ collectedAt: string; followers: number; username: string }>("account.json");
  if (!daily || !account || !Object.keys(daily).length) return null;
  const media = Object.values(readJson<{ items: Record<string, Media> }>("media.json")?.items ?? {});

  const dates = Object.keys(daily).sort();
  const end = dates[dates.length - 1];
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  const rows = (a: string, b: string) => {
    const out: Day[] = [];
    for (let d = a; d <= b; d = addDays(d, 1)) out.push(daily[d] ?? { date: d });
    return out;
  };
  const cur = rows(start, end);
  const prev = rows(prevStart, prevEnd);
  // 하루라도 값이 없으면 합계를 내지 않는다 (0으로 채우지 않음)
  const total = (rs: Day[], k: keyof Day) =>
    rs.every((r) => typeof r[k] === "number") ? rs.reduce((a, r) => a + (r[k] as number), 0) : null;

  const newFollowers = total(cur, "follower_count");
  const kpis: Kpi[] = [
    { label: "팔로워", value: account.followers, prev: newFollowers !== null ? account.followers - newFollowers : null },
    { label: "도달 (일별 합계)", value: total(cur, "reach"), prev: total(prev, "reach") },
    { label: "프로필 방문", value: total(cur, "profile_views"), prev: total(prev, "profile_views") },
    { label: "링크 클릭", value: total(cur, "website_clicks"), prev: total(prev, "website_clicks") },
  ];
  const series = (rs: Day[]): DailyPoint[] => rs.map((r) => ({ date: r.date, value: r.reach ?? 0 }));

  const contents = media
    .filter((m) => m.date >= start)
    .sort((a, b) => b.date.localeCompare(a.date));

  return {
    collectedAt: account.collectedAt,
    username: account.username,
    period: { start, end },
    kpis,
    reach: series(cur),
    prevReach: prev.some((r) => typeof r.reach === "number") ? series(prev) : [],
    contents,
  };
}
