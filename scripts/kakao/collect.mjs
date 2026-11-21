/**
 * 카카오톡 채널 통계 자동 수집 (Playwright) — 회사 휴대전화 인증이 가능해진 뒤 사용
 *   npm run kakao:login     최초 1회: 열린 창에서 직접 카카오 로그인(휴대전화 인증 포함) → 세션 저장
 *   npm run kakao:collect   최근 14일 친구 통계 + 최근 2개월 메시지 통계 수집
 * 파트너센터 인사이트 화면이 쓰는 주소를 같은 방식으로 호출한다. 비밀번호는 저장하지 않는다.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STATE = path.join(ROOT, ".secrets", "kakao-state.json");
const OUT = path.join(ROOT, "data", "kakao");
const SPACE = process.env.KAKAO_SPACE_ID || "10285427";
const PROFILE = process.env.KAKAO_PROFILE_ID || "_xlZxlQT";
const REPORT_URL = `https://business.kakao.com/space/${SPACE}/channel/${PROFILE}/statistics/reports`;
const mode = process.argv[2];

async function launch(headless) {
  try {
    return await chromium.launch({ channel: "msedge", headless });
  } catch {
    return await chromium.launch({ headless });
  }
}
const read = (f, d) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
  } catch {
    return d;
  }
};

if (mode === "login") {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  const browser = await launch(false);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(REPORT_URL);
  console.log("열린 창에서 카카오 계정으로 직접 로그인하세요. (최대 10분 대기)");
  await page.waitForURL((u) => u.hostname === "business.kakao.com" && u.pathname.includes("/statistics"), { timeout: 10 * 60 * 1000 });
  await ctx.storageState({ path: STATE });
  console.log("로그인 세션을 저장했습니다:", path.relative(ROOT, STATE));
  await browser.close();
} else if (mode === "collect") {
  if (!fs.existsSync(STATE)) {
    console.error("로그인 세션이 없습니다. 먼저 `npm run kakao:login` 을 실행하세요.");
    process.exit(1);
  }
  const browser = await launch(true);
  const ctx = await browser.newContext({ storageState: STATE });
  const page = await ctx.newPage();
  await page.goto(REPORT_URL);
  if (!page.url().startsWith("https://business.kakao.com")) {
    console.error("로그인 세션이 만료됐습니다. `npm run kakao:login` 을 다시 실행하세요.");
    await browser.close();
    process.exit(2);
  }
  const data = await page.evaluate(async (profile) => {
    const base = `/api/statistics/profiles/${profile}/`;
    const ymd = (d) => d.toISOString().slice(0, 10);
    const today = new Date(Date.now() + 9 * 3600e3);
    const end = new Date(today); end.setUTCDate(end.getUTCDate() - 1);
    const start = new Date(end); start.setUTCDate(start.getUTCDate() - 13);
    const f = await (await fetch(`${base}friends?startAt=${ymd(start)}&endAt=${ymd(end)}`, { credentials: "include" })).json();
    const msgs = {};
    for (let back = 1; back >= 0; back--) {
      const y = end.getUTCFullYear(), m = end.getUTCMonth() - back;
      const s = new Date(Date.UTC(y, m, 1)), e = new Date(Date.UTC(y, m + 1, 0));
      const j = await (await fetch(`${base}messages?startAt=${ymd(s)}&endAt=${ymd(e)}&since=0&limit=50`, { credentials: "include" })).json();
      for (const i of j.items) {
        msgs[i.message_id] = {
          id: i.message_id,
          at: i.message?.send_start_at || i.message?.created_at || 0,
          send: i.send_count, imp: i.impress_count, click: i.click_count, share: i.share_count,
          title: (i.message?.text_message || "").replace(/\s+/g, " ").slice(0, 100),
        };
      }
    }
    return { friends: f.items, messages: Object.values(msgs) };
  }, PROFILE);

  const friends = read("friends.json", {});
  const messages = read("messages.json", {});
  for (const r of data.friends) friends[r.date] = { date: r.date, friendCount: r.friend_count, friendAdd: r.friend_add_count };
  for (const m of data.messages) messages[m.id] = m;
  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "friends.json"), JSON.stringify(friends, null, 1));
  fs.writeFileSync(path.join(OUT, "messages.json"), JSON.stringify(messages, null, 1));
  fs.writeFileSync(path.join(OUT, "meta.json"), JSON.stringify({ importedAt: new Date().toISOString(), source: "kakao:collect" }, null, 1));
  console.log(`수집 완료: 친구 ${data.friends.length}일 · 메시지 ${data.messages.length}건`);
  await browser.close();
} else {
  console.log("사용법: npm run kakao:login | npm run kakao:collect");
}
