/**
 * 샘플 데이터 — 실제 계정 수치가 아님.
 * 화면 구조 확인용이며, 실제 데이터가 연결되면 lib/data/source.ts 에서 live 데이터로 교체된다.
 */
import type { ContentRow, DailyPoint, Kpi, RankedItem } from "./types";

const END = new Date("2026-11-20T00:00:00+09:00");

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function series(days: number, base: number, spread: number, seed: number, offsetDays = 0): DailyPoint[] {
  const r = rng(seed);
  const out: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(END);
    d.setDate(d.getDate() - i - offsetDays);
    const weekday = d.getDay();
    const weekendDip = weekday === 0 || weekday === 6 ? 0.75 : 1;
    out.push({
      date: d.toISOString().slice(0, 10),
      value: Math.round((base + (r() - 0.5) * spread) * weekendDip),
    });
  }
  return out;
}

const sum = (s: DailyPoint[]) => s.reduce((a, p) => a + p.value, 0);

export function sampleWebsite(days: number) {
  const visits = series(days, 300, 160, 11);
  const prevVisits = series(days, 270, 160, 12, days);
  const pv = visits.map((p) => ({ ...p, value: Math.round(p.value * 1.6) }));
  const prevPv = prevVisits.map((p) => ({ ...p, value: Math.round(p.value * 1.55) }));
  const kpis: Kpi[] = [
    { label: "방문수", value: sum(visits), prev: sum(prevVisits) },
    { label: "페이지뷰", value: sum(pv), prev: sum(prevPv) },
    { label: "신규 방문 비율", value: 83.2, prev: 85.1, unit: "%", decimals: 1 },
    { label: "방문당 페이지뷰", value: 1.6, prev: 1.55, decimals: 2 },
  ];
  const topPages: RankedItem[] = [
    { label: "/ (메인)", value: Math.round(sum(pv) * 0.31) },
    { label: "/letter (마이비레터)", value: Math.round(sum(pv) * 0.18) },
    { label: "/session (세션 안내)", value: Math.round(sum(pv) * 0.14) },
    { label: "/brand-of-month", value: Math.round(sum(pv) * 0.09) },
    { label: "/about", value: Math.round(sum(pv) * 0.05) },
  ];
  const sources: RankedItem[] = [
    { label: "직접 유입", value: Math.round(sum(visits) * 0.38) },
    { label: "인스타그램", value: Math.round(sum(visits) * 0.27) },
    { label: "네이버 검색", value: Math.round(sum(visits) * 0.16) },
    { label: "카카오톡", value: Math.round(sum(visits) * 0.11) },
    { label: "구글 검색", value: Math.round(sum(visits) * 0.08) },
  ];
  return { kpis, visits, prevVisits, topPages, sources };
}

export function sampleInstagram(days: number) {
  const reach = series(days, 2400, 1800, 21);
  const prevReach = series(days, 2200, 1800, 22, days);
  const kpis: Kpi[] = [
    { label: "팔로워", value: 12500, prev: 12380 },
    { label: "도달", value: sum(reach), prev: sum(prevReach) },
    { label: "프로필 방문", value: Math.round(sum(reach) * 0.04), prev: Math.round(sum(prevReach) * 0.038) },
    { label: "링크 클릭", value: null, prev: null },
  ];
  const r = rng(23);
  const types = ["릴스", "캐러셀", "이미지"];
  const titles = [
    "이달의브랜드 11월 후보 공개",
    "세션 리캡: 브랜드 경험 설계",
    "마이비레터 이번 주 큐레이션",
    "올해의브랜드 투표 안내",
    "편집력 시리즈 오픈",
    "브랜드 해례 굿즈 소개",
    "세션 예고: 사운드 브랜딩",
    "이달의브랜드 10월 결과",
  ];
  const contents: ContentRow[] = titles.map((title, i) => {
    const d = new Date(END);
    d.setDate(d.getDate() - i * 3 - 1);
    const reachV = Math.round(1500 + r() * 6000);
    return {
      id: `sample-${i + 1}`,
      date: d.toISOString().slice(0, 10),
      title,
      type: types[i % 3],
      reach: reachV,
      likes: Math.round(reachV * (0.03 + r() * 0.04)),
      comments: Math.round(reachV * r() * 0.006),
      saves: Math.round(reachV * r() * 0.02),
      shares: Math.round(reachV * r() * 0.01),
    };
  });
  const cutoff = new Date(END);
  cutoff.setDate(cutoff.getDate() - days);
  const inRange = contents.filter((c) => c.date > cutoff.toISOString().slice(0, 10));
  return { kpis, reach, prevReach, contents: inRange };
}

export function sampleKakao(days: number) {
  const friends = series(days, 6, 8, 31).map((p) => ({ ...p, value: Math.max(0, p.value) }));
  const kpis: Kpi[] = [
    { label: "친구 수", value: 4120, prev: 4035 },
    { label: "메시지 발송", value: 6, prev: 5 },
    { label: "평균 열람률", value: 41.5, prev: 39.8, unit: "%", decimals: 1 },
    { label: "평균 클릭률", value: 6.2, prev: 6.9, unit: "%", decimals: 1 },
  ];
  return { kpis, friends };
}
