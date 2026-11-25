/**
 * 인스타그램(Meta Graph API) 수집 — 회사 PC에서 실행
 *   npm run meta:collect                 빠진 날짜 + 최근 3일 계정 지표, 최근 게시물 성과
 *   npm run meta:collect -- --days 60    계정 지표를 최근 60일까지 채움
 * .env.local 의 META_GRAPH_API_VERSION, META_ACCESS_TOKEN 을 사용한다. 토큰은 출력·저장하지 않는다.
 *
 * 저장 위치 (data/instagram)
 *   account.json  계정 정보 (팔로워 수 등, 수집 시점 기준)
 *   daily.json    날짜별 계정 지표 { "YYYY-MM-DD": { reach, profile_views, ... } }
 *   media.json    게시물별 성과 (수집 시점 누적값)
 */
import fs from "node:fs";
import path from "node:path";

const version = process.env.META_GRAPH_API_VERSION?.trim();
const token = process.env.META_ACCESS_TOKEN?.trim();
if (!version || !token) {
  console.error(".env.local 에 META_GRAPH_API_VERSION 과 META_ACCESS_TOKEN 을 입력하세요.");
  process.exit(1);
}
const OUT = path.join(process.cwd(), "data", "instagram");
fs.mkdirSync(OUT, { recursive: true });

const scrub = (s) => String(s).split(token).join("[토큰 숨김]");
const opt = (k) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : undefined;
};
async function get(p, params = {}) {
  const url = `https://graph.facebook.com/${version}/${p}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(scrub(body.error?.message ?? `HTTP ${res.status}`));
  return body;
}
const readJson = (f, d) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
  } catch {
    return d;
  }
};
const writeJson = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 1));

// 한국 시간 기준 날짜
const KST = 9 * 3600e3;
const ymd = (ms) => new Date(ms + KST).toISOString().slice(0, 10);
const addDays = (s, n) => {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const kstStartSec = (s) => Math.floor((Date.parse(`${s}T00:00:00Z`) - KST) / 1000);

// 1) 계정 찾기
const fields = "id,name,instagram_business_account{id,username}";
let pages = (await get("me/accounts", { fields })).data ?? [];
if (!pages.length && process.env.META_PAGE_ID) pages = [await get(process.env.META_PAGE_ID, { fields })];
const igId = process.env.META_IG_USER_ID || pages.find((p) => p.instagram_business_account)?.instagram_business_account?.id;
if (!igId) {
  console.error("인스타그램 계정 ID를 찾지 못했습니다.");
  process.exit(1);
}
const acct = await get(igId, { fields: "username,followers_count,follows_count,media_count" });
const collectedAt = new Date().toISOString();
writeJson("account.json", { collectedAt, id: igId, username: acct.username, followers: acct.followers_count, media: acct.media_count });
console.log(`계정 @${acct.username} · 팔로워 ${acct.followers_count}`);

// 2) 날짜별 계정 지표 (어제까지)
const daily = readJson("daily.json", {});
const yesterday = addDays(ymd(Date.now()), -1);
const backfill = Number(opt("days") || (Object.keys(daily).length ? 0 : 60));
let from = addDays(yesterday, -2);
if (backfill) from = addDays(yesterday, -(backfill - 1));
// 최근 30일 안에 빠진 날짜가 있으면 그 날부터
for (let d = addDays(yesterday, -29); d < from; d = addDays(d, 1)) if (!daily[d]) { from = d; break; }

const TOTAL_METRICS = ["reach", "profile_views", "website_clicks", "accounts_engaged", "total_interactions", "views"];
async function dayTotals(d) {
  const params = { period: "day", metric_type: "total_value", since: kstStartSec(d), until: kstStartSec(addDays(d, 1)) };
  const out = {};
  try {
    const r = await get(`${igId}/insights`, { ...params, metric: TOTAL_METRICS.join(",") });
    for (const m of r.data ?? []) out[m.name] = m.total_value?.value ?? null;
  } catch {
    for (const metric of TOTAL_METRICS) {
      try {
        const r = await get(`${igId}/insights`, { ...params, metric });
        out[metric] = r.data?.[0]?.total_value?.value ?? null;
      } catch {
        out[metric] = null;
      }
    }
  }
  return out;
}
let n = 0;
for (let d = from; d <= yesterday; d = addDays(d, 1)) {
  daily[d] = { ...(daily[d] ?? {}), date: d, ...(await dayTotals(d)) };
  n++;
}
// 신규 팔로워 (최근 30일만 제공)
try {
  const since = kstStartSec(addDays(yesterday, -28));
  const r = await get(`${igId}/insights`, { metric: "follower_count", period: "day", since, until: kstStartSec(addDays(yesterday, 1)) });
  for (const v of r.data?.[0]?.values ?? []) {
    const d = addDays(ymd(Date.parse(v.end_time)), -1);
    if (daily[d]) daily[d].follower_count = v.value;
  }
} catch (e) {
  console.log("신규 팔로워 지표 실패:", e.message);
}
writeJson("daily.json", Object.fromEntries(Object.entries(daily).sort(([a], [b]) => a.localeCompare(b))));
console.log(`계정 지표 ${from} ~ ${yesterday} (${n}일) 저장`);

// 3) 게시물별 성과 (최근 100개)
const mediaFields = "id,caption,media_type,media_product_type,timestamp,permalink,like_count,comments_count";
let list = [];
let next = await get(`${igId}/media`, { fields: mediaFields, limit: "50" });
while (next && list.length < 100) {
  list.push(...(next.data ?? []));
  const after = next.paging?.cursors?.after;
  next = next.paging?.next && after ? await get(`${igId}/media`, { fields: mediaFields, limit: "50", after }) : null;
}
const MEDIA_METRICS = ["reach", "saved", "shares", "views", "total_interactions"];
const prevMedia = readJson("media.json", { items: {} }).items ?? {};
const items = { ...prevMedia };
for (const m of list.slice(0, 100)) {
  const ins = {};
  try {
    const r = await get(`${m.id}/insights`, { metric: MEDIA_METRICS.join(",") });
    for (const x of r.data ?? []) ins[x.name] = x.values?.[0]?.value ?? x.total_value?.value ?? null;
  } catch {
    for (const metric of MEDIA_METRICS) {
      try {
        const r = await get(`${m.id}/insights`, { metric });
        ins[metric] = r.data?.[0]?.values?.[0]?.value ?? r.data?.[0]?.total_value?.value ?? null;
      } catch {
        ins[metric] = null;
      }
    }
  }
  items[m.id] = {
    id: m.id,
    date: ymd(Date.parse(m.timestamp)),
    type: m.media_product_type === "REELS" ? "릴스" : m.media_type === "CAROUSEL_ALBUM" ? "캐러셀" : m.media_type === "VIDEO" ? "동영상" : "이미지",
    title: (m.caption ?? "").split("\n")[0].trim().slice(0, 60) || "(캡션 없음)",
    permalink: m.permalink,
    likes: m.like_count ?? null,
    comments: m.comments_count ?? null,
    reach: ins.reach ?? null,
    saves: ins.saved ?? null,
    shares: ins.shares ?? null,
    views: ins.views ?? null,
    updatedAt: collectedAt,
  };
}
writeJson("media.json", { collectedAt, items });
console.log(`게시물 ${Math.min(list.length, 100)}개 성과 저장`);
console.log("인스타그램 수집 완료");
