/**
 * 화면이 데이터를 가져오는 유일한 입구.
 * 지금은 모든 채널이 sample 모드다. 실제 수집이 붙으면 채널별로 live 분기를 추가한다.
 * 화면 코드에는 수치를 직접 쓰지 않는다.
 */
import { loadAceCounter } from "./acecounter";
import { loadKakao } from "./kakao";
import { sampleInstagram, sampleKakao, sampleWebsite } from "./sample";
import type { ChannelData, DailyPoint, Kpi, RankedItem } from "./types";

export type WebsiteView = {
  kpis: Kpi[];
  visits: DailyPoint[];
  prevVisits?: DailyPoint[];
  topPages: RankedItem[];
  sources: RankedItem[];
  sourceTypes?: RankedItem[];
  period?: { start: string; end: string };
  zeroDays?: string[];
  missingDetail?: number;
  deviceSplit?: RankedItem[];
  topPosts?: RankedItem[];
  postsKnown?: number;
};

export const RANGE_OPTIONS = [7, 30] as const;
export type RangeDays = (typeof RANGE_OPTIONS)[number];

export function parseRange(v: string | string[] | undefined): RangeDays {
  return v === "7" ? 7 : 30;
}

export async function getWebsiteData(days: RangeDays): Promise<ChannelData<WebsiteView>> {
  const live = loadAceCounter(days);
  if (live) {
    return {
      mode: "live",
      collectedAt: live.collectedAt,
      rangeDays: days,
      data: {
        kpis: live.kpis,
        visits: live.visits,
        prevVisits: live.prevVisits,
        topPages: live.topPages,
        sources: live.topDomains,
        sourceTypes: live.sourceTypes,
        period: live.period,
        zeroDays: live.zeroDays,
        missingDetail: live.missingDetail,
        deviceSplit: live.deviceSplit,
        topPosts: live.topPosts,
        postsKnown: live.postsKnown,
      },
    };
  }
  return { mode: "sample", collectedAt: null, rangeDays: days, data: sampleWebsite(days) };
}

export async function getInstagramData(days: RangeDays): Promise<ChannelData<ReturnType<typeof sampleInstagram>>> {
  return { mode: "sample", collectedAt: null, rangeDays: days, data: sampleInstagram(days) };
}

export type KakaoView = {
  kpis: Kpi[];
  friends: DailyPoint[];
  prevFriends?: DailyPoint[];
  period?: { start: string; end: string };
  recent?: { id: number; date: string; title: string; send: number; imp: number; click: number; share: number }[];
};

export async function getKakaoData(days: RangeDays): Promise<ChannelData<KakaoView>> {
  const live = loadKakao(days);
  if (live) {
    return {
      mode: "live",
      collectedAt: live.collectedAt,
      rangeDays: days,
      data: { kpis: live.kpis, friends: live.friendAdds, prevFriends: live.prevAdds, period: live.period, recent: live.recent },
    };
  }
  return { mode: "sample", collectedAt: null, rangeDays: days, data: sampleKakao(days) };
}
