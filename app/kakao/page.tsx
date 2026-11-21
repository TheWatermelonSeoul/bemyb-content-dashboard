import RangeSwitch from "../components/RangeSwitch";
import { getKakaoData, type RangeDays } from "@/lib/data/source";
import { fmt } from "@/lib/format";
import LineChart from "../components/LineChart";
import { DataBanner, KpiGrid } from "../components/ui";


async function View({ range }: { range: RangeDays }) {
  const { mode, collectedAt, data } = await getKakaoData(range);
  const live = mode === "live";

  return (
    <>
      <DataBanner mode={mode} collectedAt={collectedAt} source="카카오비즈니스 파트너센터 인사이트" />
      {live && data.period && (
        <p style={{ margin: "-8px 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>
          분석 기간 {data.period.start} ~ {data.period.end} (수집된 마지막 날짜 기준) · 노출률·클릭률은 기간 안에 발송된 메시지 기준
        </p>
      )}
      <KpiGrid kpis={data.kpis} />

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>일별 신규 친구</h2>
          <p className="sub">{data.prevFriends ? `점선은 바로 이전 ${range}일` : ""}</p>
          <LineChart current={data.friends} previous={data.prevFriends} label="신규 친구" />
        </div>

        {live ? (
          <div className="card">
            <h2>메시지별 성과</h2>
            <p className="sub">최근 발송 {data.recent?.length ?? 0}건 · 노출률 = 노출÷발송 · 클릭률 = 클릭÷노출</p>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>발송일</th><th>메시지</th><th style={{ textAlign: "right" }}>발송</th><th>노출</th><th>노출률</th><th>클릭</th><th>클릭률</th><th>공유</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent?.map((m) => (
                    <tr key={m.id}>
                      <td>{m.date}</td>
                      <td style={{ textAlign: "left", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis" }} title={m.title}>{m.title}</td>
                      <td style={{ textAlign: "right" }}>{fmt(m.send)}</td>
                      <td>{fmt(m.imp)}</td>
                      <td>{fmt(m.send ? (m.imp / m.send) * 100 : null, 1, "%")}</td>
                      <td>{fmt(m.click)}</td>
                      <td>{fmt(m.imp ? (m.click / m.imp) * 100 : null, 1, "%")}</td>
                      <td>{fmt(m.share)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="card">
            <h2>연동 상태 <span className="tag off">데이터 없음</span></h2>
            <p className="empty">npm run kakao:import 로 내보내기 파일을 가져오면 실제 데이터로 바뀝니다.</p>
          </div>
        )}
      </div>
    </>
  );
}

export default async function KakaoPage() {
  const [v7, v30] = await Promise.all([View({ range: 7 }), View({ range: 30 })]);
  return <RangeSwitch title="카카오톡 채널" desc="친구·메시지 반응" v7={v7} v30={v30} />;
}
