import RangeSwitch from "../components/RangeSwitch";
import { loadImwebPosts } from "@/lib/data/imweb";
import { getWebsiteData, type RangeDays } from "@/lib/data/source";
import { fmt } from "@/lib/format";
import LineChart from "../components/LineChart";
import { BarList, DataBanner, KpiGrid } from "../components/ui";


async function View({ range }: { range: RangeDays }) {
  const { mode, collectedAt, data } = await getWebsiteData(range);
  const live = mode === "live";
  const imweb = loadImwebPosts(range);

  return (
    <>
      <DataBanner mode={mode} collectedAt={collectedAt} source="에이스카운터 (PC dub.imweb.me + 모바일 bemyb.kr 합산)" />
      {live && data.period && (
        <p style={{ margin: "-8px 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>
          분석 기간 {data.period.start} ~ {data.period.end} (수집된 마지막 날짜 기준)
        </p>
      )}
      {live && (data.zeroDays?.length || data.missingDetail) ? (
        <div className="banner">
          <strong>확인 필요</strong>
          {data.zeroDays?.length ? <> — 방문수가 0으로 기록된 날: {data.zeroDays.join(", ")} (분석 서비스 중단 등 수집 공백일 수 있음)</> : null}
          {data.missingDetail ? <> — 페이지·유입 상세가 빠진 건수 {data.missingDetail}건 (PC·모바일 각각 계산)</> : null}
        </div>
      ) : null}
      <KpiGrid kpis={data.kpis} />

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>일별 방문수</h2>
          <p className="sub">{data.prevVisits ? `점선은 바로 이전 ${range}일` : "이전 기간 데이터 없음"}</p>
          <LineChart current={data.visits} previous={data.prevVisits} label="방문수" />
        </div>
      </div>

      <div className="grid two" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>인기 페이지</h2>
          <p className="sub">페이지뷰 기준 상위 {data.topPages.length}개{live ? " · 페이지명이 없으면 주소로 표시" : ""}</p>
          {data.topPages.length ? <BarList items={data.topPages} /> : <p className="empty">상세 데이터 없음</p>}
        </div>
        <div className="card">
          <h2>{live ? "유입 도메인" : "유입경로"}</h2>
          <p className="sub">방문수 기준 상위 {data.sources.length}개</p>
          {data.sources.length ? <BarList items={data.sources} /> : <p className="empty">상세 데이터 없음</p>}
        </div>
      </div>

      {live ? (
        <div className="grid two" style={{ marginTop: 16 }}>
          <div className="card">
            <h2>PC · 모바일 방문 비중</h2>
            <p className="sub">에이스카운터 서비스별 방문수</p>
            <BarList items={data.deviceSplit ?? []} />
          </div>
          <div className="card">
            <h2>유입 유형</h2>
            <p className="sub">직접유입·검색엔진·SNS·외부도메인 등</p>
            {data.sourceTypes?.length ? <BarList items={data.sourceTypes} /> : <p className="empty">상세 데이터 없음</p>}
          </div>
        </div>
      ) : null}
      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>
            게시물별 조회수 <span className="tag" style={imweb ? { background: "#eaf7ee", borderColor: "#9fd3b0", color: "#0a5a2d" } : undefined}>{imweb ? "실제 · 아임웹" : "수집 전"}</span>
          </h2>
          {imweb ? (
            <>
              <p className="sub">
                아임웹 관리자 기준 누적 조회수 · 전체 {imweb.total}건 · {imweb.snapshotDate} 수집
                {imweb.baseDate ? ` · 기간 증가 = ${imweb.baseDate} 대비` : " · 기간 증가는 이틀 이상 수집되면 표시"}
              </p>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>작성일</th><th>제목</th><th>게시판</th><th style={{ textAlign: "right" }}>누적 조회수</th><th>기간 증가</th><th>좋아요</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(imweb.topGain.length ? imweb.topGain : imweb.recent).map((p) => (
                      <tr key={p.code ?? p.title}>
                        <td>{p.date}</td>
                        <td style={{ maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis" }} title={p.title}>{p.title}</td>
                        <td>{p.board}</td>
                        <td style={{ textAlign: "right" }}>{fmt(p.views)}</td>
                        <td>{p.gain === null ? "—" : `+${fmt(p.gain)}`}</td>
                        <td>{fmt(p.likes)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="sub" style={{ marginTop: 10 }}>
                {imweb.topGain.length ? "기간 중 조회수가 많이 늘어난 순" : "최근 작성 15건"} · 누적 조회수 상위:{" "}
                {imweb.topCumulative.slice(0, 3).map((p) => `${p.title.slice(0, 18)}(${fmt(p.views)})`).join(", ")}
              </p>
            </>
          ) : (
            <p className="empty">npm run imweb:login → npm run imweb:collect 를 실행하면 아임웹 게시물별 누적 조회수가 표시됩니다.</p>
          )}
        </div>
      </div>

      {live ? (
        <div className="grid" style={{ marginTop: 16 }}>
          <div className="card">
            <h2>게시물별 페이지뷰 (에이스카운터)</h2>
            <p className="sub">PC·모바일 합산 · 2026-11-21 동적페이지 설정 이후 방문분부터 집계 · 제목은 홈페이지 공개 목록 기준 ({data.postsKnown ?? 0}건)</p>
            {data.topPosts?.length ? (
              <BarList items={data.topPosts} />
            ) : (
              <p className="empty">아직 집계된 데이터가 없습니다. 11/23 이후 수집분부터 표시됩니다.</p>
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}

export default async function WebsitePage() {
  const [v7, v30] = await Promise.all([View({ range: 7 }), View({ range: 30 })]);
  return <RangeSwitch title="홈페이지" desc="에이스카운터 기준 방문·유입" v7={v7} v30={v30} />;
}
