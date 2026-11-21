# 비마이비 콘텐츠 성과 대시보드

인스타그램·홈페이지(에이스카운터)·카카오톡 채널 성과를 한곳에서 보는 웹 대시보드.

## 현재 상태 (2026-11-21)

| 화면 | 데이터 |
|---|---|
| 통합 요약 `/` | 샘플 |
| 홈페이지 `/website` | 샘플 (에이스카운터 연결 예정) |
| 인스타그램 `/instagram` | 샘플 (Meta 계정 확인 후 연결) |
| 카카오톡 `/kakao` | 샘플 (연동 방법 조사 전) |
| Meta 연결 상태 `/instagram/connect` | 환경 변수 입력 여부 |
| `/api/meta/test` | 실제 Meta API 호출 시험 (토큰 입력 후) |

모든 샘플 화면에는 노란색 "샘플 데이터" 안내가 표시된다. 샘플 수치는 `lib/data/sample.ts` 한 곳에만 있다.

## 실행

Node.js 20.9 이상 필요.

```bash
npm install
npm run dev
```

브라우저에서 http://localhost:3000

## 폴더 구조

- `app/` 화면과 API 경로
- `app/components/` 공통 화면 요소 (KPI 카드, 선 그래프, 막대 목록)
- `lib/data/source.ts` 화면이 데이터를 가져오는 유일한 입구 (샘플/실제 전환 지점)
- `lib/data/sample.ts` 샘플 수치
- `lib/meta/graph.ts` Meta Graph API 서버 전용 클라이언트

## 비밀값

- `.env.example` 을 복사해 `.env.local` 을 만들고 값을 채운다.
- `.env.local` 은 이 PC에만 두고 채팅·메일로 보내지 않는다. git에도 올라가지 않는다.
- 토큰이 노출되면 Business Suite > 시스템 사용자 > `토큰 취소` 후 새로 발급한다.

## 에이스카운터 수집 (Playwright)

비밀번호는 저장하지 않고, 직접 로그인한 세션만 `.secrets/` 에 저장한다.

```bash
npm run ace:login                                   # 최초 1회 · 세션 만료 시: 열린 창에서 직접 로그인
npm run ace:collect -- --from 2026-06-18           # 과거 전체 수집 (처음 한 번, 10~20분)
npm run ace:collect                                 # 매일: 최근 3일 다시 수집
```

- 수집 대상: `[Pro] dub.imweb.me`(PC) 와 `[mWeb] bemyb.kr`(모바일) 둘 다. 하나만: `-- --site pc` 또는 `-- --site mobile`
- 저장 위치: `data/acecounter/pc/`, `data/acecounter/mobile/` (`daily.json` 일별 방문·페이지뷰, `by-date/` 날짜별 페이지·유입, `raw/` 원본) · `data/acecounter/sync_runs.json` 수집 기록
- 대시보드는 PC·모바일을 합산해 보여주고, 비중을 따로 표시한다.
- 데이터가 있으면 홈페이지 화면이 자동으로 실제 데이터로 바뀐다.
- 에이스카운터 공식 데이터 API 계약 시 이 스크립트를 API 방식으로 교체한다.

## 게시물 제목 목록

```bash
npm run posts:sync      # bemyb.kr/contents 공개 목록에서 게시물 번호·제목 수집 → data/bemyb/posts.json
npm run sync            # 게시물 목록 + 에이스카운터 최근 3일 수집을 한 번에 (매일 실행용)
```

게시물별 조회수는 에이스카운터가 게시물 주소의 `idx` 값을 구분하도록(동적페이지) 설정된 날부터 집계된다.

## 카카오톡 채널 통계

```bash
npm run kakao:import     # 다운로드 폴더의 kakao-export*.json 을 data/kakao/ 로 가져오기
npm run kakao:login      # (회사 휴대전화 인증 가능해진 뒤) 직접 로그인 → 세션 저장
npm run kakao:collect    # 최근 14일 친구 + 최근 2개월 메시지 통계 수집
```

- 출처: 카카오비즈니스 파트너센터 인사이트 화면이 쓰는 주소 (`/api/statistics/profiles/_xlZxlQT/friends`, `/messages`)
- 공식 외부 API 가 아니므로 화면이 바뀌면 수집기를 고쳐야 할 수 있다.

## 아임웹 게시물별 누적 조회수

```bash
npm run imweb:login      # 최초 1회: 열린 창에서 직접 아임웹 관리자 로그인 → 세션 저장
npm run imweb:collect    # 관리자 > 게시물 목록(100개씩)에서 조회수·좋아요 읽기 → data/imweb/snapshots/날짜.json
```

- 매일 스냅샷을 비교해 기간 중 조회수 증가분을 계산한다.
- `npm run sync` 에 포함되어 있다 (게시물 목록 → 에이스카운터 → 아임웹 순).
