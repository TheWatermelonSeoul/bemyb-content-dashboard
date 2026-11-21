import RangeSwitch from "./components/RangeSwitch";
import Link from "next/link";
import { getInstagramData, getKakaoData, getWebsiteData, type RangeDays } from "@/lib/data/source";
import { KpiGrid } from "./components/ui";


async function View({ range }: { range: RangeDays }) {
  const [web, ig, kakao] = await Promise.all([getWebsiteData(range), getInstagramData(range), getKakaoData(range)]);

  const sections = [
    { title: "홈페이지", href: "/website", d: web },
    { title: "인스타그램 (오가닉)", href: "/instagram", d: ig },
    { title: "카카오톡 채널", href: "/kakao", d: kakao },
  ];

  return (
    <>
      <div className="banner">
        <strong>데이터 구분</strong> — 홈페이지 {web.mode === "live" ? "실제" : "샘플"} · 인스타그램 {ig.mode === "live" ? "실제" : "샘플"} · 카카오톡 {kakao.mode === "live" ? "실제" : "샘플"}. 섹션 제목 옆 표시를 확인하세요.
      </div>
      {sections.map((s) => (
        <section key={s.href}>
          <h2 className="section-title">
            <Link href={`${s.href}?range=${range}`}>{s.title} →</Link>
            <span className="tag" style={s.d.mode === "live" ? { background: "#eaf7ee", borderColor: "#9fd3b0", color: "#0a5a2d" } : undefined}>{s.d.mode === "sample" ? "샘플" : "실제"}</span>
          </h2>
          <KpiGrid kpis={s.d.data.kpis} />
        </section>
      ))}
    </>
  );
}

export default async function Home() {
  const [v7, v30] = await Promise.all([View({ range: 7 }), View({ range: 30 })]);
  return <RangeSwitch title="통합 요약" desc="세 채널의 핵심 지표" v7={v7} v30={v30} />;
}
