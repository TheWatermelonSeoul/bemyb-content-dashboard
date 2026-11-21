import "server-only";
import fs from "node:fs";
import path from "node:path";

/** scripts/imweb/collect.mjs 가 저장한 게시물별 누적 조회수 스냅샷을 읽는다 */

const DIR = path.join(process.cwd(), "data", "imweb");

type Post = { code: string | null; board: string; title: string; likes: number | null; views: number | null; date: string | null };
type Snapshot = { date: string; collectedAt: string; count: number; posts: Post[] };

function read<T>(file: string): T | null {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

export type ImwebPostRow = Post & { gain: number | null };

export function loadImwebPosts(days: number) {
  const latest = read<Snapshot>(path.join(DIR, "latest.json"));
  if (!latest) return null;

  // 기간 시작 시점(또는 그 이전 가장 가까운) 스냅샷과 비교해 기간 증가분 계산
  const snapDir = path.join(DIR, "snapshots");
  const dates = fs.existsSync(snapDir)
    ? fs.readdirSync(snapDir).map((f) => f.replace(/\.json$/, "")).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d)).sort()
    : [];
  const start = new Date(`${latest.date}T00:00:00Z`);
  start.setUTCDate(start.getUTCDate() - days);
  const startStr = start.toISOString().slice(0, 10);
  const baseDate = [...dates].reverse().find((d) => d <= startStr && d < latest.date) ?? null;
  const base = baseDate ? read<Snapshot>(path.join(snapDir, `${baseDate}.json`)) : null;
  const baseMap = new Map((base?.posts ?? []).map((p) => [p.code ?? p.title, p.views]));

  const rows: ImwebPostRow[] = latest.posts.map((p) => {
    const before = baseMap.get(p.code ?? p.title);
    return { ...p, gain: base && typeof before === "number" && typeof p.views === "number" ? p.views - before : null };
  });

  const byViews = [...rows].sort((a, b) => (b.views ?? 0) - (a.views ?? 0));
  const byGain = base ? [...rows].filter((r) => (r.gain ?? 0) > 0).sort((a, b) => (b.gain ?? 0) - (a.gain ?? 0)) : [];
  const recent = [...rows].sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 15);
  const boards = [...new Set(rows.map((r) => r.board))];

  return {
    snapshotDate: latest.date,
    collectedAt: latest.collectedAt,
    baseDate,
    total: rows.length,
    boards,
    topCumulative: byViews.slice(0, 15),
    topGain: byGain.slice(0, 15),
    recent,
  };
}
