/**
 * 아임웹 관리자 > 게시물 목록에서 게시물별 누적 조회수를 읽는다 (Playwright)
 *   npm run imweb:login     최초 1회: 열린 창에서 직접 아임웹 관리자 로그인 → 세션 저장
 *   npm run imweb:collect   전체 게시물의 조회수·좋아요를 오늘 날짜 스냅샷으로 저장
 *
 * - 관리자 화면에 보이는 표를 그대로 읽는다. 게시물 수정·삭제 기능은 건드리지 않는다.
 * - 매일 스냅샷끼리 빼면 하루 조회수가 된다.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STATE = path.join(ROOT, ".secrets", "imweb-state.json");
const OUT = path.join(ROOT, "data", "imweb");
const BASE = "https://dub.imweb.me";
const PAGE_SIZE = 100;
const listUrl = (page) =>
  `${BASE}/admin/contents/post/list?page=${page}&page_size=${PAGE_SIZE}&keyword=&code=&idx=&board_code=&idx_order=desc&status=&type=&board_keyword=&mode=&temp_code=`;
const mode = process.argv[2];
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launch(headless) {
  try {
    return await chromium.launch({ channel: "msedge", headless });
  } catch {
    return await chromium.launch({ headless });
  }
}

const kstToday = () => new Date(Date.now() + 9 * 3600e3).toISOString().slice(0, 10);

async function readRows(page) {
  // 게시물 표는 /_/site-content/ 프레임 안에 그려진다
  const frame = await (async () => {
    for (let i = 0; i < 40; i++) {
      const f = page.frames().find((fr) => fr.url().includes("/_/site-content/"));
      if (f) return f;
      await sleep(500);
    }
    throw new Error("게시물 표를 찾지 못했습니다");
  })();
  await frame.waitForSelector("tbody tr", { timeout: 30000 });
  await sleep(1000);
  return frame.evaluate(() =>
    Array.from(document.querySelectorAll("tbody tr")).map((tr) => {
      const c = Array.from(tr.querySelectorAll("td")).map((td) => td.innerText.replace(/\s+/g, " ").trim());
      const href = tr.querySelector('a[href*="post/view"]')?.getAttribute("href") || "";
      const num = (s) => {
        const n = Number(String(s || "").replace(/,/g, ""));
        return Number.isFinite(n) ? n : null;
      };
      const m = (c[8] || "").match(/^(\d{2})\.(\d{2})\.(\d{2})$/);
      return {
        code: (href.match(/code=([\w-]+)/) || [])[1] || null,
        board: c[3] || "",
        title: c[4] || "",
        author: c[5] || "",
        likes: num(c[6]),
        views: num(c[7]),
        date: m ? `20${m[1]}-${m[2]}-${m[3]}` : c[8] || null,
      };
    }),
  );
}

if (mode === "login") {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  const browser = await launch(false);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(listUrl(1));
  console.log("열린 창에서 아임웹 관리자 계정으로 직접 로그인하세요. 로그인 후 창은 자동으로 닫힙니다. (최대 10분 대기)");
  await page.waitForURL((u) => u.pathname.startsWith("/admin/contents/post/list"), { timeout: 10 * 60 * 1000 });
  await ctx.storageState({ path: STATE });
  console.log("로그인 세션을 저장했습니다:", path.relative(ROOT, STATE));
  await browser.close();
} else if (mode === "collect") {
  if (!fs.existsSync(STATE)) {
    console.error("로그인 세션이 없습니다. 먼저 `npm run imweb:login` 을 실행하세요.");
    process.exit(1);
  }
  const browser = await launch(true);
  const ctx = await browser.newContext({ storageState: STATE });
  const page = await ctx.newPage();
  const all = [];
  let prevFirst = "";
  try {
    for (let p = 1; p <= 50; p++) {
      await page.goto(listUrl(p));
      if (!page.url().includes("/admin/contents/post/list")) throw new Error("SESSION_EXPIRED");
      const rows = await readRows(page);
      const key = rows[0] ? `${rows[0].code}|${rows[0].title}` : "";
      if (!rows.length || key === prevFirst) break;
      prevFirst = key;
      all.push(...rows);
      console.log(`  ${p}페이지: ${rows.length}건`);
      if (rows.length < PAGE_SIZE) break;
      await sleep(1500);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(msg === "SESSION_EXPIRED" ? "로그인 세션이 만료됐습니다. `npm run imweb:login` 을 다시 실행하세요." : `수집 오류: ${msg}`);
    await browser.close();
    process.exit(2);
  }
  await browser.close();

  const today = kstToday();
  fs.mkdirSync(path.join(OUT, "snapshots"), { recursive: true });
  const snap = { date: today, collectedAt: new Date().toISOString(), count: all.length, posts: all };
  fs.writeFileSync(path.join(OUT, "snapshots", `${today}.json`), JSON.stringify(snap));
  fs.writeFileSync(path.join(OUT, "latest.json"), JSON.stringify(snap));
  console.log(`수집 완료: 게시물 ${all.length}건 (${today} 스냅샷)`);
} else {
  console.log("사용법: npm run imweb:login | npm run imweb:collect");
}
