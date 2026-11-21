/**
 * 비마이비 홈페이지 공개 목록에서 게시물 번호(idx)와 제목을 모은다.
 *   npm run posts:sync
 * 에이스카운터의 게시물 주소(idx=...)를 제목으로 바꿔 보여주는 데 쓴다.
 * 로그인 없이 누구나 보는 공개 목록만 읽는다.
 */
import fs from "node:fs";
import path from "node:path";

const BASE = "https://bemyb.kr";
const BOARDS = ["/contents"]; // 콘텐츠 게시판 (마이비레터·이달의브랜드·인터뷰 등)
const OUT = path.join(process.cwd(), "data", "bemyb", "posts.json");
const MAX_PAGES = 60;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const decode = (s) =>
  s
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/-->/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();

function parseList(html) {
  const found = new Map();
  const re = /<a\b[^>]*href="([^"]*bmode=view[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
  let m;
  while ((m = re.exec(html))) {
    const idx = m[1].match(/idx=(\d+)/)?.[1];
    if (!idx) continue;
    const text = decode(m[2]).replace(/^공지\s+/, "");
    if (text.length > (found.get(idx)?.length ?? 0)) found.set(idx, text);
  }
  return found;
}

const posts = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : {};
const today = new Date().toISOString().slice(0, 10);
let added = 0;

for (const board of BOARDS) {
  let prevKey = "";
  for (let page = 1; page <= MAX_PAGES; page++) {
    const res = await fetch(`${BASE}${board}/?page=${page}`, { headers: { "User-Agent": "bemyb-dashboard/1.0" } });
    if (!res.ok) break;
    const list = parseList(await res.text());
    const key = [...list.keys()].join(",");
    if (list.size === 0 || key === prevKey) break; // 마지막 페이지를 지나면 같은 목록이 반복됨
    prevKey = key;
    let fresh = 0;
    for (const [idx, title] of list) {
      if (!posts[idx]) {
        posts[idx] = { title, board, firstSeen: today };
        added++;
        fresh++;
      } else if (title && posts[idx].title !== title) {
        posts[idx].title = title;
      }
    }
    console.log(`${board} ${page}페이지: ${list.size}건`);
    await sleep(800);
  }
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(posts, null, 1));
console.log(`게시물 ${Object.keys(posts).length}건 저장 (새로 추가 ${added}건)`);
