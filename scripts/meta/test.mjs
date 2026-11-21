/**
 * Meta(인스타그램) API 연결 시험 — 회사 PC에서 실행
 *   npm run meta:test
 * .env.local 의 META_GRAPH_API_VERSION, META_ACCESS_TOKEN 을 사용한다. 토큰은 화면에 출력하지 않는다.
 */
const version = process.env.META_GRAPH_API_VERSION?.trim();
const token = process.env.META_ACCESS_TOKEN?.trim();
if (!version || !token) {
  console.error(".env.local 에 META_GRAPH_API_VERSION 과 META_ACCESS_TOKEN 을 입력하세요.");
  process.exit(1);
}
const scrub = (s) => String(s).split(token).join("[토큰 숨김]");
async function get(path, params = {}) {
  const url = `https://graph.facebook.com/${version}/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(scrub(body.error?.message ?? `HTTP ${res.status}`));
  return body;
}
try {
  const fields = "id,name,instagram_business_account{id,username}";
  let pages = (await get("me/accounts", { fields })).data ?? [];
  if (!pages.length && process.env.META_PAGE_ID) pages = [await get(process.env.META_PAGE_ID, { fields })];
  console.log("페이지:", pages.map((p) => `${p.name} (${p.id})`).join(", ") || "없음");
  const ig = process.env.META_IG_USER_ID || pages.find((p) => p.instagram_business_account)?.instagram_business_account?.id;
  if (!ig) throw new Error("인스타그램 계정 ID를 찾지 못했습니다.");
  console.log("인스타그램 계정 ID:", ig);
  const media = (await get(`${ig}/media`, { fields: "id,caption,media_type,timestamp", limit: "5" })).data;
  for (const m of media) console.log(` - ${m.timestamp?.slice(0, 10)} ${m.media_type} ${(m.caption ?? "").slice(0, 30)}`);
  for (const metric of ["reach", "likes", "comments", "saved", "shares"]) {
    try {
      const r = await get(`${media[0].id}/insights`, { metric });
      console.log(`   ${metric}:`, r.data?.[0]?.values?.[0]?.value ?? "-");
    } catch (e) {
      console.log(`   ${metric}: 실패 (${e.message})`);
    }
  }
} catch (e) {
  console.error("실패:", e.message);
  process.exit(1);
}
