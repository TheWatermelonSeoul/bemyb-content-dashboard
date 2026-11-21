/**
 * 카카오톡 채널 통계 내보내기 파일(kakao-export-*.json)을 대시보드 데이터로 넣는다.
 *   npm run kakao:import                 다운로드 폴더에서 가장 최근 파일을 찾아 가져오기
 *   npm run kakao:import -- <파일경로>     특정 파일 가져오기
 * 같은 날짜·같은 메시지는 새 값으로 덮어쓴다 (중복 저장 없음).
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const OUT = path.join(process.cwd(), "data", "kakao");
const arg = process.argv[2];

function findLatest() {
  // 프로젝트 폴더와 다운로드 폴더 둘 다 찾아본다
  const dirs = [process.cwd(), path.join(os.homedir(), "Downloads")];
  const files = dirs
    .filter((dir) => fs.existsSync(dir))
    .flatMap((dir) =>
      fs
        .readdirSync(dir)
        .filter((f) => /^kakao-export.*\.json$/i.test(f))
        .map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs })),
    )
    .sort((a, b) => b.t - a.t);
  return files[0]?.f;
}

const file = arg || findLatest();
if (!file || !fs.existsSync(file)) {
  console.error("kakao-export*.json 파일을 찾지 못했습니다. 프로젝트 폴더나 다운로드 폴더에 있는지 확인하세요.");
  process.exit(1);
}

const src = JSON.parse(fs.readFileSync(file, "utf8"));
const read = (f, d) => {
  try {
    return JSON.parse(fs.readFileSync(path.join(OUT, f), "utf8"));
  } catch {
    return d;
  }
};
const friends = read("friends.json", {});
const messages = read("messages.json", {});

for (const r of src.friends ?? []) friends[r.date] = { date: r.date, friendCount: r.friend_count, friendAdd: r.friend_add_count };
for (const m of src.messages ?? []) messages[m.id] = m;

fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, "friends.json"), JSON.stringify(friends, null, 1));
fs.writeFileSync(path.join(OUT, "messages.json"), JSON.stringify(messages, null, 1));
fs.writeFileSync(
  path.join(OUT, "meta.json"),
  JSON.stringify({ importedAt: new Date().toISOString(), exportedAt: src.exportedAt ?? null, source: path.basename(file) }, null, 1),
);
console.log(`가져오기 완료: 일별 친구 ${src.friends?.length ?? 0}일 · 메시지 ${src.messages?.length ?? 0}건 (${path.basename(file)})`);
