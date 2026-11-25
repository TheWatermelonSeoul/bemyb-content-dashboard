import "server-only";
import fs from "node:fs";
import path from "node:path";
import type { DailyPoint, Kpi } from "./types";

const DIR = path.join(process.cwd(), "data", "kakao");

type FriendRow = { date: string; friendCount: number | null; friendAdd: number | null };
export type KakaoMessage = { id: number; at: number; send: number; imp: number; click: number; share: number; title: string };

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
const kstDate = (ms: number) => new Date(ms + 9 * 3600e3).toISOString().slice(0, 10);

export function loadKakao(days: number) {
  const friends = readJson<Record<string, FriendRow>>("friends.json");
  if (!friends || !Object.keys(friends).length) return null;
  const messages = Object.values(readJson<Record<string, KakaoMessage>>("messages.json") ?? {});
  const meta = readJson<{ importedAt?: string }>("meta.json");

  const dates = Object.keys(friends).sort();
  const end = dates[dates.length - 1];
  const start = addDays(end, -(days - 1));
  const prevEnd = addDays(start, -1);
  const prevStart = addDays(prevEnd, -(days - 1));
  const range = (a: string, b: string) => {
    const out: FriendRow[] = [];
    for (let d = a; d <= b; d = addDays(d, 1)) out.push(friends[d] ?? { date: d, friendCount: null, friendAdd: null });
    return out;
  };
  const cur = range(start, end);
  const prev = range(prevStart, prevEnd);
  const sum = (rows: FriendRow[]) => rows.reduce((a, r) => a + (r.friendAdd ?? 0), 0);
  const last = (rows: FriendRow[]) => [...rows].reverse().find((r) => r.friendCount !== null)?.friendCount ?? null;
  const first = (rows: FriendRow[]) => rows.find((r) => r.friendCount !== null)?.friendCount ?? null;
  const net = (rows: FriendRow[]) => {
    const a = first(rows), b = last(rows);
    return a !== null && b !== null ? b - a : null;
  };
  const prevHas = prev.some((r) => r.friendCount !== null);

  const inRange = (m: KakaoMessage, a: string, b: string) => {
    const d = kstDate(m.at);
    return d >= a && d <= b;
  };
  const msgCur = messages.filter((m) => inRange(m, start, end));
  const msgPrev = messages.filter((m) => inRange(m, prevStart, prevEnd));
  // 발송 직후에는 통계가 -1(집계 중)로 온다 — 비율 계산에서 뺀다
  const rate = (all: KakaoMessage[], num: keyof KakaoMessage, den: keyof KakaoMessage) => {
    const ms = all.filter((m) => m.send >= 0 && m.imp >= 0 && m.click >= 0);
    const n = ms.reduce((a, m) => a + (m[num] as number), 0);
    const d = ms.reduce((a, m) => a + (m[den] as number), 0);
    return d ? (n / d) * 100 : null;
  };

  const kpis: Kpi[] = [
    { label: "친구 수", value: last(cur), prev: prevHas ? last(prev) : null },
    { label: "신규 친구 (기간 합계)", value: sum(cur), prev: prevHas ? sum(prev) : null },
    { label: "친구 순증감", value: net(cur), prev: prevHas ? net(prev) : null },
    { label: "메시지 발송", value: msgCur.length, prev: msgPrev.length },
    { label: "노출률 (노출÷발송)", value: rate(msgCur, "imp", "send"), prev: rate(msgPrev, "imp", "send"), unit: "%", decimals: 1 },
    { label: "클릭률 (클릭÷노출)", value: rate(msgCur, "click", "imp"), prev: rate(msgPrev, "click", "imp"), unit: "%", decimals: 1 },
  ];

  const friendAdds: DailyPoint[] = cur.map((r) => ({ date: r.date, value: r.friendAdd ?? 0 }));
  const prevAdds: DailyPoint[] | undefined = prevHas ? prev.map((r) => ({ date: r.date, value: r.friendAdd ?? 0 })) : undefined;

  const recent = [...messages]
    .sort((a, b) => b.at - a.at)
    .slice(0, 20)
    .map((m) => {
      const v = (x: number) => (x < 0 ? null : x);
      return { ...m, date: kstDate(m.at), send: v(m.send), imp: v(m.imp), click: v(m.click), share: v(m.share) };
    });

  return { period: { start, end }, collectedAt: meta?.importedAt ?? null, kpis, friendAdds, prevAdds, recent };
}
