/** sample: 화면 확인용 가짜 수치 / live: 실제 수집 데이터 */
export type DataMode = "sample" | "live";

export type Channel = "website" | "instagram" | "kakao";

export type DailyPoint = { date: string; value: number };

export type Kpi = {
  label: string;
  /** API가 제공하지 않으면 null. 0으로 채우지 않는다 */
  value: number | null;
  prev: number | null;
  unit?: string;
  decimals?: number;
};

export type RankedItem = { label: string; value: number };

export type ContentRow = {
  id: string;
  date: string;
  title: string;
  type: string;
  reach: number | null;
  likes: number | null;
  comments: number | null;
  saves: number | null;
  shares: number | null;
  /** 원본 게시물 주소 (있으면 링크) */
  permalink?: string;
  views?: number | null;
};

export type ChannelData<T> = {
  mode: DataMode;
  /** 마지막 수집 시각 (ISO). 샘플이면 null */
  collectedAt: string | null;
  rangeDays: number;
  data: T;
};
