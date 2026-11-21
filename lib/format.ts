export function fmt(v: number | null, decimals = 0, unit = ""): string {
  if (v === null) return "—";
  return v.toLocaleString("ko-KR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals }) + unit;
}

/** 이전 기간 대비 변화율(%). 비교 불가면 null */
export function changePct(value: number | null, prev: number | null): number | null {
  if (value === null || prev === null || prev === 0) return null;
  return ((value - prev) / prev) * 100;
}
