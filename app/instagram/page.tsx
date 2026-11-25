import RangeSwitch from "../components/RangeSwitch";
import { getInstagramData, type RangeDays } from "@/lib/data/source";
import { fmt } from "@/lib/format";
import LineChart from "../components/LineChart";
import { DataBanner, KpiGrid } from "../components/ui";


async function View({ range }: { range: RangeDays }) {
  const { mode, collectedAt, data } = await getInstagramData(range);
  const rows = [...data.contents].sort((a, b) => (b.reach ?? 0) - (a.reach ?? 0));
  const live = mode === "live";

  return (
    <>
      <DataBanner mode={mode} collectedAt={collectedAt} source={live ? `인스타그램 Graph API (@${data.username})` : "인스타그램"} />
      {live && data.period && (
        <p style={{ margin: "-8px 0 16px", fontSize: 13, color: "var(--text-secondary)" }}>
          분석 기간 {data.period.start} ~ {data.period.end} · 도달은 날짜별 도달 수를 더한 값이라 같은 사람이 여러 날 보면 중복으로 셉니다
        </p>
      )}
      <KpiGrid kpis={data.kpis} />

      <div className="grid" style={{ marginTop: 16 }}>
        <div className="card">
          <h2>일별 도달</h2>
          <p className="sub">점선은 바로 이전 {range}일</p>
          <LineChart current={data.reach} previous={data.prevReach} label="도달" />
        </div>

        <div className="card">
          <h2>콘텐츠별 성과</h2>
          <p className="sub">이 기간에 올린 게시물 · 도달 높은 순 · 수치는 수집 시점까지의 누적 · 참여율 = (좋아요+댓글+저장+공유) ÷ 도달</p>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>게시일</th><th>콘텐츠</th><th>유형</th><th>도달</th><th>좋아요</th><th>댓글</th><th>저장</th><th>공유</th><th>참여율</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const inter = [r.likes, r.comments, r.saves, r.shares];
                  const rate = r.reach && inter.every((v) => v !== null)
                    ? (inter.reduce((a, v) => a! + v!, 0)! / r.reach) * 100
                    : null;
                  return (
                    <tr key={r.id}>
                      <td>{r.date}</td>
                      <td>{r.permalink ? <a href={r.permalink} target="_blank" rel="noreferrer">{r.title}</a> : r.title}</td>
                      <td>{r.type}</td>
                      <td>{fmt(r.reach)}</td>
                      <td>{fmt(r.likes)}</td>
                      <td>{fmt(r.comments)}</td>
                      <td>{fmt(r.saves)}</td>
                      <td>{fmt(r.shares)}</td>
                      <td>{fmt(rate, 1, "%")}</td>
                    </tr>
                  );
                })}
                {!rows.length && (
                  <tr><td colSpan={9} className="empty">이 기간에 올린 게시물이 없습니다.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h2>광고 성과 <span className="tag off">미연결</span></h2>
          <p className="empty">
            광고 성과는 오가닉 연결이 끝난 뒤 별도 단계로 연결합니다.<br />
            광고비·노출·클릭·CTR·CPC는 오가닉 수치와 섞지 않고 이 영역에만 표시합니다.
          </p>
        </div>
      </div>
    </>
  );
}

export default async function InstagramPage() {
  const [v7, v30] = await Promise.all([View({ range: 7 }), View({ range: 30 })]);
  return <RangeSwitch title="인스타그램" desc="오가닉 성과 (광고와 분리)" v7={v7} v30={v30} />;
}
