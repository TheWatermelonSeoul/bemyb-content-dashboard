/**
 * 에이스카운터 수집기 (Playwright)
 *
 *   npm run ace:login                       최초 1회: 브라우저가 열리면 직접 로그인 → 세션 저장
 *   npm run ace:collect                     최근 3일 수집 (매일 실행용)
 *   npm run ace:collect -- --from 2026-06-18 --to 2026-11-20   기간 지정 수집
 *   npm run ace:collect -- --force          이미 받은 날짜도 다시 수집
 *   npm run ace:collect -- --site mobile    PC(pc)·모바일(mobile) 중 하나만 수집
 *
 * - 비밀번호는 저장하지 않는다. 로그인 세션(쿠키)만 .secrets/ 에 저장한다.
 * - 에이스카운터 화면의 '리포트저장 > 엑셀' 기능과 같은 주소를 호출한다.
 * - 요청 사이에 간격을 두어 서버에 부담을 주지 않는다.
 */
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const STATE = path.join(ROOT, ".secrets", "acecounter-state.json");
const OUT = path.join(ROOT, "data", "acecounter");
const BASE = "https://www.acecounter.com";
// 에이스카운터에 등록된 두 서비스: PC 와 모바일
const SITES = [
  { key: "pc", id: "105874", kind: "P", label: "[Pro] dub.imweb.me (PC)" },
  { key: "mobile", id: "105875", kind: "M", label: "[mWeb] bemyb.kr (모바일)" },
];
const DELAY_MS = 1500;

const args = process.argv.slice(2);
const mode = args[0];
const opt = (name) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const force = args.includes("--force");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ymd = (d) => d.toISOString().slice(0, 10);
function kstToday() {
  return new Date(Date.now() + 9 * 3600 * 1000);
}
function addDays(s, n) {
  const d = new Date(`${s}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return ymd(d);
}
function daysBetween(from, to) {
  const out = [];
  for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
  return out;
}

async function launch(headless) {
  // 회사 PC에 기본 설치된 Edge 를 먼저 쓰고, 없으면 Playwright 크로미움을 쓴다.
  try {
    return await chromium.launch({ channel: "msedge", headless });
  } catch {
    return await chromium.launch({ headless });
  }
}

/* ---------------- login ---------------- */
async function login() {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  const browser = await launch(false);
  const ctx = await browser.newContext();
  const page = await ctx.newPage();
  await page.goto(`${BASE}/www2/login/login.amz?gotype=go_target&turl=${encodeURIComponent(`${BASE}/stat/my/my_notice.amz`)}`);
  console.log("열린 브라우저에서 에이스카운터에 직접 로그인하세요. 로그인 후 창은 자동으로 닫힙니다. (최대 10분 대기)");
  // 로그인 화면을 벗어나 에이스카운터 안쪽 화면으로 이동하면 성공으로 본다
  await page.waitForURL((url) => url.hostname.endsWith("acecounter.com") && !/login/i.test(url.pathname), {
    timeout: 10 * 60 * 1000,
  });
  await page.waitForLoadState("domcontentloaded");
  await ctx.storageState({ path: STATE });
  console.log("로그인 세션을 저장했습니다:", path.relative(ROOT, STATE));
  await browser.close();
}

/* ---------------- parse (브라우저 안에서 실행) ---------------- */
function parseAce({ html, kind }) {
  const d = new DOMParser().parseFromString(html, "text/html");
  const rows = Array.from(d.querySelectorAll("tr")).map((tr) =>
    Array.from(tr.querySelectorAll("td,th")).map((c) => c.textContent.replace(/\s+/g, " ").trim()),
  );
  const num = (s) => {
    const m = String(s || "").replace(/,/g, "").match(/^-?\d+(\.\d+)?/);
    return m ? Number(m[0]) : null;
  };
  const dateOf = (s) => {
    const m = String(s || "").match(/^(\d{4})\.(\d{2})\.(\d{2})/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : null;
  };
  const after = (first) => {
    const idx = rows.findIndex((r) => r[0] === first);
    if (idx < 0) return [];
    const n = rows[idx].length;
    const out = [];
    for (let k = idx + 1; k < rows.length; k++) {
      const r = rows[k];
      if (r.length !== n || /^합계/.test(r[0])) {
        if (out.length) break;
        continue;
      }
      out.push(r);
    }
    return out;
  };
  // 하루만 조회하면 '시간으로보기'로 바뀌므로 날짜별로 합산한다
  const byDate = (cols) => {
    let rs = after("일간으로보기");
    if (!rs.length) rs = after("시간으로보기");
    const m = {};
    for (const r of rs) {
      const dt = dateOf(r[0]);
      if (!dt) continue;
      m[dt] = m[dt] || { date: dt };
      for (const [name, idx] of cols) m[dt][name] = (m[dt][name] || 0) + (num(r[idx]) || 0);
    }
    return Object.values(m);
  };
  switch (kind) {
    case "visits":
      return byDate([["visits", 1], ["newVisits", 2], ["returnVisits", 3]]);
    case "pageviews":
      return byDate([["pageviews", 1]]);
    case "pages":
      return after("URL").map((r) => ({ url: r[0], name: r[1] === "--" ? null : r[1], pageviews: num(r[2]) }));
    case "sources":
      return after("방문유입출처").map((r) => ({ source: r[0], visits: num(r[1]) }));
    case "domains":
      return after("유입도메인").map((r) => ({ domain: r[0], visits: num(r[1]) }));
    default:
      return [];
  }
}

/* ---------------- collect ---------------- */
const REPORTS = {
  visits: [2, 3],
  pageviews: [2, 2],
  pages: [8, 2],
  sources: [3, 2],
  domains: [3, 7],
};

function reportUrl(kind, from, to, serviceKind) {
  const [a, b] = REPORTS[kind];
  const p = new URLSearchParams({
    OUTPUT_WAY: "xls",
    rpt_total: "n",
    srt_date: from,
    end_date: to,
    MENU_A: String(a),
    MENU_B: String(b),
    SELF: `/stat/view/statview${a}_${b}.amz`,
    vtype: "d",
    top_limit: "500",
    sort_no: "0",
    sort_order: "asc",
    seg_opt: "all",
    SITE_SERVICE_KIND: serviceKind,
  });
  return `${BASE}/stat/control/${a}_${b}.amz?${p}`;
}

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJson(file, data) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 1));
}

async function collect() {
  if (!fs.existsSync(STATE)) {
    console.error("로그인 세션이 없습니다. 먼저 `npm run ace:login` 을 실행하세요.");
    process.exit(1);
  }
  const yesterday = addDays(ymd(kstToday()), -1);
  const to = opt("to") || yesterday;
  const only = opt("site"); // pc | mobile (생략하면 둘 다)
  const sites = SITES.filter((s) => !only || s.key === only);
  // 기본 시작일: 최근 3일과 '빠진 날짜' 중 더 이른 날 (최대 60일 전까지) — 며칠 쉬어도 공백이 생기지 않게
  let from = opt("from");
  if (!from) {
    from = addDays(to, -2);
    const floor = addDays(to, -60);
    for (const s of sites) {
      const dir = path.join(OUT, s.key, "by-date");
      const have = new Set(fs.existsSync(dir) ? fs.readdirSync(dir).map((f) => f.replace(".json", "")) : []);
      if (!have.size) continue;
      const last = [...have].sort().pop();
      for (const d of daysBetween(addDays(last, -14) < floor ? floor : addDays(last, -14), to)) {
        if (!have.has(d) && d < from) { from = d; break; }
      }
    }
  }
  console.log(`수집 기간: ${from} ~ ${to} · 대상: ${sites.map((s) => s.label).join(", ")}`);

  const browser = await launch(true);
  const ctx = await browser.newContext({ storageState: STATE });
  const page = await ctx.newPage();
  const parser = await ctx.newPage(); // 파싱 전용 빈 페이지 (사이트 스크립트 영향 없음)
  await parser.goto("about:blank");

  let failed = false;
  for (const site of sites) {
    const OUT_SITE = path.join(OUT, site.key);
    const runLog = { site: site.key, startedAt: new Date().toISOString(), from, to, ok: [], failed: [] };

    async function fetchReport(kind, f, t) {
      const res = await ctx.request.get(reportUrl(kind, f, t, site.kind));
      if (!res.ok()) throw new Error(`${kind} ${f}~${t}: HTTP ${res.status()}`);
      const html = new TextDecoder("utf-8").decode(await res.body());
      if (!/리포트/.test(html.slice(0, 8000))) throw new Error("SESSION_EXPIRED");
      await sleep(DELAY_MS);
      return html;
    }

    try {
      // 서비스(사이트) 선택 + 세션 확인
      await page.goto(`${BASE}/change_site.amz?chsid=${site.id}`);
      if (/login/.test(page.url())) throw new Error("SESSION_EXPIRED");
      console.log(`[${site.label}]`);

      // 1) 일별 방문수·페이지뷰: 한 달 단위로 묶어서 요청
      const dailyFile = path.join(OUT_SITE, "daily.json");
      const daily = readJson(dailyFile, {});
      for (let s = from; s <= to; ) {
        const e = [addDays(s, 30), to].sort()[0];
        for (const kind of ["visits", "pageviews"]) {
          const html = await fetchReport(kind, s, e);
          fs.mkdirSync(path.join(OUT_SITE, "raw"), { recursive: true });
          fs.writeFileSync(path.join(OUT_SITE, "raw", `${kind}_${s}_${e}.html`), html);
          const rows = await parser.evaluate(parseAce, { html, kind });
          for (const r of rows) daily[r.date] = { ...(daily[r.date] || {}), ...r };
        }
        console.log(`  일별 지표 ${s} ~ ${e} 완료`);
        s = addDays(e, 1);
      }
      writeJson(dailyFile, daily);

      // 2) 날짜별 페이지·유입출처·유입도메인
      for (const date of daysBetween(from, to)) {
        const file = path.join(OUT_SITE, "by-date", `${date}.json`);
        if (!force && fs.existsSync(file) && date < addDays(to, -2)) continue;
        const day = { date, collectedAt: new Date().toISOString() };
        for (const kind of ["pages", "sources", "domains"]) {
          const html = await fetchReport(kind, date, date);
          day[kind] = await parser.evaluate(parseAce, { html, kind });
        }
        writeJson(file, day);
        runLog.ok.push(date);
        console.log(`  ${date} 페이지 ${day.pages.length}개 · 유입도메인 ${day.domains.length}개`);
      }
    } catch (e) {
      failed = true;
      const msg = e instanceof Error ? e.message : String(e);
      runLog.failed.push(msg);
      if (msg === "SESSION_EXPIRED") console.error("로그인 세션이 만료됐습니다. `npm run ace:login` 을 다시 실행하세요.");
      else console.error(`[${site.key}] 수집 중 오류:`, msg);
    } finally {
      runLog.finishedAt = new Date().toISOString();
      const logFile = path.join(OUT, "sync_runs.json");
      const logs = readJson(logFile, []);
      logs.push(runLog);
      writeJson(logFile, logs.slice(-300));
    }
    if (runLog.failed.includes("SESSION_EXPIRED")) break;
  }
  await browser.close();
  console.log(failed ? "일부 실패 — data/acecounter/sync_runs.json 확인" : "수집 완료");
  process.exit(failed ? 1 : 0);
}

if (mode === "login") await login();
else if (mode === "collect") await collect();
else console.log("사용법: npm run ace:login | npm run ace:collect [-- --from YYYY-MM-DD --to YYYY-MM-DD --force]");
