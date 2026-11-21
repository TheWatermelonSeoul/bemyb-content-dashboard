"use client";

import { useEffect, useState, type ReactNode } from "react";

/** 기간(7일/30일) 화면을 미리 둘 다 만들어 두고 버튼으로 바꿔 보여준다 (정적 사이트용) */
export default function RangeSwitch({ title, desc, v7, v30 }: { title: string; desc: string; v7: ReactNode; v30: ReactNode }) {
  const [range, setRange] = useState<7 | 30>(30);
  useEffect(() => {
    const r = new URLSearchParams(window.location.search).get("range");
    if (r === "7") setRange(7);
  }, []);
  function pick(r: 7 | 30) {
    setRange(r);
    const url = new URL(window.location.href);
    url.searchParams.set("range", String(r));
    window.history.replaceState(null, "", url);
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{title}</h1>
          <p>{desc} · 최근 {range}일, 이전 {range}일과 비교</p>
        </div>
        <div className="tabs" role="tablist" aria-label="기간 선택">
          {([7, 30] as const).map((d) => (
            <a key={d} href={`?range=${d}`} className={d === range ? "active" : ""} onClick={(e) => { e.preventDefault(); pick(d); }}>
              최근 {d}일
            </a>
          ))}
        </div>
      </div>
      <div style={{ display: range === 7 ? "block" : "none" }}>{v7}</div>
      <div style={{ display: range === 30 ? "block" : "none" }}>{v30}</div>
    </>
  );
}
