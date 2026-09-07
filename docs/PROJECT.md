# Travel Planner — Project Notes

## Status / Current Milestone
**M7 진행 중 — Tier 1 "여행 목록 관리 묶음"(삭제 UI / 정보 수정 UI / 날짜 범위 → Day 자동 생성) 백엔드+프론트 구현 완료(2026-09-07), qa-reviewer 검증에서 나온 이슈 2건(삭제 실패 시 무피드백 / `PATCH /api/trips/{id}` 날짜 검증 누락)도 수정 완료. 브라우저 수동 확인만 남음.** `POST /api/trips`가 날짜 범위를 받으면 Day를 함께 생성(백엔드), `TripListPage`에 삭제/수정/날짜 범위 생성 UI 연동(프론트) 모두 완료. 삭제 실패(네트워크 오류/401/404) 시에도 기존 `extractErrorMessage()` 패턴으로 해당 항목 근처에 에러 메시지 표시하도록 보강. 남은 건 실제 브라우저 클릭 테스트(사용자 확인 필요, `logs/2026-09-07.md` 참고).

**M6 완료 — 초기 개발안(M0~M6) 전체 완성.** Neon·Render·Vercel 배포, 실제 Map ID, Google Cloud 예산 알림, PC+안드로이드(크롬, 서로 다른 네트워크) 실기기 테스트까지 통과. 삼성 인터넷 브라우저 이슈는 아래 Known Issues 참고(우선순위 낮음, 미해결). 다음 단계는 M7(폴리싱)이며, 후보 기능은 아래 "Backlog" 섹션에 우선순위별로 정리해둠.

## Backlog (M7+ 후보, 우선순위별)
초기 개발안(M0~M6) 완성 후 사용자 관점에서 정리한 다음 후보 기능들. "구현 난이도 대비 가치" + "비용 발생 가능성" 기준으로 티어를 나눔. 2026-09-07 코드 검토 기준.

### Tier 1 — 저비용/고가치 (다음 착수 후보)
- [x] **여행 목록 삭제 UI** — 백엔드(`DELETE /api/trips/{id}`)·프론트 API 클라이언트(`deleteTrip`)는 이미 있었고, **2026-09-07 완료**: `TripListPage.tsx`에 삭제 버튼(`window.confirm()` 확인 후 호출) 연결.
- [x] **여행 생성 시 날짜 범위 선택 → Day 자동 생성** — **2026-09-07 완료(백엔드+프론트 모두)**: `POST /api/trips`에 `start_date`+`end_date`가 둘 다 오면 서버가 같은 트랜잭션에서 그 범위(양끝 포함)의 Day를 자동 생성하고, 응답으로 `days` 배열이 포함된 `TripDetailRead`를 반환. `TripListPage.tsx` 생성 폼에 날짜 입력 2개 추가(둘 다 입력/둘 다 비움만 허용), 응답의 `days`로 목록만 갱신(별도 Day API 호출 없음).
- [ ] **여행 기간(PATCH) 수정 시 Day 동기화** — 위 자동 생성은 "생성 시점"에만 동작한다. `PATCH /api/trips/{id}`로 기간을 바꿔도 Day는 그대로다(늘지도 줄지도 않음) — 2026-09-07에 프론트 수정 폼에도 "기간을 바꿔도 이미 만들어진 날짜는 유지됩니다" 안내 문구를 넣어 사용자에게 알리는 선에서 마무리. 실제 동기화가 필요해지면 `app/services/trip_days.py`의 `build_days_for_range()`를 재사용해 "부족한 날짜만 추가"(범위 밖 Day는 일정이 딸려있을 수 있으니 자동 삭제하지 말고 사용자에게 확인) 방식으로 확장할 것.
- [ ] **예산/지출 추적 + 정산(더치페이)** — `ItineraryItem.cost_amount`/`cost_currency`, `Trip.currency` 필드는 이미 존재하나 집계/표시 UI가 없음. "누가 냈는지" 필드를 추가하면 정산 기능까지 확장 가능.
- [x] **여행 정보 수정(이름/기간 편집)** — **2026-09-07 완료**: `PATCH /api/trips/{id}`는 이미 있었고, `TripListPage.tsx`에 인라인 수정 폼(`TripEditForm`) 추가(이름/목적지/시작일/종료일).
- [ ] **일정 메모/체크리스트** (Trip 또는 Day 레벨 자유 텍스트)

### Tier 2 — 중간 난이도 (비용 없음, 스키마/API 확장 필요)
- [ ] 일정 간 이동시간 표시 (Google Directions API) — 기존 Google Cloud 결제 계정을 재사용할 수 있으나 API 호출량이 늘어나므로 예산 알림($5) 임계치 재점검 권장
- [ ] 이전 여행 복제/템플릿
- [ ] 캘린더 내보내기 (ICS → 구글 캘린더)
- [ ] 삼성 인터넷 크로스도메인 쿠키 이슈 (Known Issues 참고, 원인 미확정)
- [ ] 오프라인/PWA 대응

### Tier 3 — 비용 발생 가능성 있어 후순위
업데이트로 인해 Neon/Google Cloud 등 무료 티어 한도를 건드릴 수 있는 기능은 아래 "인프라 안전장치"가 먼저 갖춰진 뒤 진행.
- [ ] 사진/기록 첨부 — Neon DB(또는 별도 오브젝트 스토리지) 용량 증가 → 무료 티어 초과 리스크

### 인프라 안전장치 (병행 진행 권장)
- [ ] **Neon DB 용량 임계치 설정** — 실제 Neon 무료 티어 스토리지 한도를 먼저 확인하고, 그 한도의 일부(예: 20~30% 선)를 내부 경고 임계치로 정해 모니터링. 임계치 근접 시 알림 + 필요 시 유료 플랜 전환 여부를 사용자가 판단하도록 함. 특히 Tier 3(사진 첨부 등 용량을 크게 먹는 기능) 진행 전에 선행 권장.

## Setup TODOs (one-time)
- [x] Google Cloud 프로젝트 생성, Maps JavaScript API + Places API (New) 활성화
- [x] 결제 계정(카드) 등록 — Google Maps Platform은 무료 사용량 내에서도 카드 등록 필수
- [x] 브라우저 키(HTTP 리퍼러 제한) 발급 → `frontend/.env`의 `VITE_GOOGLE_MAPS_BROWSER_KEY`
- [x] 서버 키(Places API (New) 전용, 브라우저 키와 분리) 발급 → `backend/.env`의 `GOOGLE_PLACES_SERVER_KEY`
- [x] Google Cloud Billing에 예산 알림 설정 완료 ($5, "알림만" 방식 — "지출 한도 적용"은 Maps Platform이 지원 대상에서 빠져있어 선택 안 함)
- [x] **실제 Google Maps Map ID 발급** (Raster 타입 — 이 앱은 번호 마커/경로선만 쓰고 3D/WebGL 기능 불필요해서 Vector 대신 선택) → `frontend`의 `VITE_GOOGLE_MAPS_MAP_ID`로 분리(`MapView.tsx`가 이 값을 기본으로 사용, 없으면 `DEMO_MAP_ID` 폴백). 로컬 `.env` + Vercel Environment Variables에 등록, Google Maps 브라우저 키 리퍼러 목록에 `https://travel-planner-dtsjs.vercel.app/*` 추가 후 워터마크 없이 정상 렌더링 확인 완료.
- [x] Neon 프로젝트 생성 → DATABASE_URL 확보 (Neon Auth는 off로 유지 — 이 프로젝트는 공유 비밀번호 방식이라 불필요). 실제 값은 Render env 변수 설정 시 사용 예정이며 비밀값이라 이 문서에는 기록하지 않음(비밀번호 관리자에 보관 권장)
- [x] Render 웹 서비스 생성 → env 변수 설정 완료, 배포 성공(Live). 서비스 URL: `https://travel-planner-q6si.onrender.com` (`/api/health` → `{"status":"ok"}` 확인)
- [x] Vercel 프로젝트 생성 → env 변수 설정 완료, 배포 성공. 도메인: `https://travel-planner-dtsjs.vercel.app` (Deployment Protection은 반드시 off로 설정 — 켜져있으면 방문자가 Vercel 로그인을 강제로 요구받아 공유 비밀번호 방식과 충돌함)
- [x] SHARED_PASSCODE 정하고 두 사람 모두 공유 — 로그인 정상 동작 확인 완료

## Architecture Decisions
- 백엔드: FastAPI + SQLModel + Alembic, Postgres(Neon)
- 프론트엔드: React + Vite + Tailwind CSS v4 + React Query + dnd-kit + @vis.gl/react-google-maps
- 인증: 개별 계정 없이 공유 비밀번호(passcode) 1개 → 서명된 쿠키 세션
- 호스팅: Vercel(프론트) / Render 무료(백엔드) / Neon 무료(DB) — 각 도구의 목적/선택 이유/실제 등록 과정/트러블슈팅은 [`docs/infra/`](infra/) 참고: [neon.md](infra/neon.md), [render.md](infra/render.md), [vercel.md](infra/vercel.md)
- **Day 자동 생성은 별도 bulk 엔드포인트 대신 `POST /api/trips` 안에서 처리** (2026-09-07 결정). 후보는 (a) `POST /api/trips/{id}/days/bulk` 신설, (b) 프론트에서 단건 API를 날짜 수만큼 반복 호출, (c) 트립 생성이 Day까지 같이 만들기. **(c) 선택** — 이유: ① 프론트가 왕복 1회로 끝나고 부분 실패(트립은 생겼는데 Day는 일부만) 상태가 원천적으로 없음(단일 트랜잭션), ② (b)는 N번 호출 중 실패 시 프론트가 보상 로직을 떠안아야 함, ③ (a)는 지금 호출할 곳이 트립 생성 한 군데뿐이라 엔드포인트만 늘어남. 대신 날짜 범위 → Day 변환 규칙 자체는 `app/services/trip_days.py`로 빼놨으므로, 나중에 (a)가 실제로 필요해지면(예: 기간 PATCH 동기화) 라우터만 추가하면 됨. 안전장치로 여행 1건의 최대 기간을 90일(`MAX_TRIP_DAYS`)로 제한 — 연도 오타 하나로 수천 행이 생겨 무료 티어 DB를 먹는 사고 방지.
- **날짜 범위 검증은 스키마가 아니라 `app/services/trip_days.py`의 순수 함수 `validate_date_range(start, end)`가 단일 소스** (2026-09-07 결정). `POST`는 `TripCreate`의 `model_validator`가, `PATCH`는 `update_trip` 라우터가 각각 이 함수를 호출한다. PATCH는 부분 업데이트라 요청에 한쪽 날짜만 올 수 있어 **DB의 기존 값과 병합한 뒤**에야 최종 기간이 정해지므로, pydantic 스키마(`TripUpdate`)만으로는 검증이 불가능하다. 두 날짜 중 하나라도 없으면 검증을 건너뛰는 정책도 두 경로에서 동일(= Day 자동 생성 조건과 같은 기준).
- **UX 참고: 트리플(Triple) 앱 방식** — 일정 편집 화면은 리스트+지도를 항상 함께 표시, 일정 "추가" 시에도 지도에서 검색 결과 핀 + 기존 일정 핀을 같이 보면서 고를 수 있게 함. M5에서 `MapView`를 `DayEditorPage`와 `AddItemModal` 양쪽에 통합 예정. 상세는 plan 파일의 "UX 참고: 트리플 앱 방식 반영" 섹션 참고.
- 데이터 모델, API 라우트, 마일스톤 전체 계획: `C:\Users\user\.claude\plans\pjt-dapper-snowglobe.md` 참고

## Environment Variables

### backend/.env
- `DATABASE_URL` — 로컬 개발은 SQLite(`sqlite:///./dev.db`), 배포는 Neon Postgres 연결 문자열
- `SECRET_KEY` — 세션 쿠키 서명용 랜덤 문자열
- `SHARED_PASSCODE` — 공유 접속 비밀번호
- `GOOGLE_PLACES_SERVER_KEY` — Places API 서버 프록시용 키 (절대 프론트엔드에 노출 금지)
- `CORS_ORIGINS` — 허용할 프론트엔드 origin (콤마 구분)

### frontend/.env
- `VITE_API_BASE_URL` — 백엔드 API 기본 URL. **로컬**: `http://localhost:8000`. **Vercel(프로덕션)**: 빈 문자열 — `frontend/vercel.json`의 `/api/*` rewrite가 Render로 프록시해주므로 상대경로로 호출해야 same-origin이 되어 크로스 도메인 쿠키 차단 문제(삼성 인터넷 등)를 피할 수 있음.
- `VITE_GOOGLE_MAPS_BROWSER_KEY` — Maps JS SDK용 브라우저 키 (리퍼러 제한 필수)
- `VITE_GOOGLE_MAPS_MAP_ID` — Advanced Marker 렌더링에 필요한 Map ID (Raster 타입). 비밀값 아님 — 브라우저 번들에 그대로 노출되는 공개 식별자.

## Gotchas (발생했던 문제들, 재발 방지용)
- Google Maps 브라우저 키의 HTTP 리퍼러 제한에서 **와일드카드 패턴이 기대대로 안 먹힐 수 있음** (`localhost:*/*`, `*localhost:*/*` 둘 다 실패 경험). 새 도메인 추가할 때 와일드카드보다 **정확한 전체 URL**(`http://localhost:5173/*`, 배포 후엔 `https://실제도메인/*`)을 우선 시도할 것.
- `.env` 파일은 서버/dev 프로세스 **시작 시점에만** 읽힘 — 실행 중에 값 추가/수정했다면 반드시 재시작해야 반영됨 (백엔드 uvicorn, 프론트 vite 둘 다 해당).
- **`ENVIRONMENT=production`을 Render에 빼먹으면 로그인이 무한 실패한 것처럼 보임**: `app/auth.py`가 `settings.environment == "production"`일 때만 세션 쿠키를 `Secure=True, SameSite=None`으로 발급한다. 이 값이 안 맞으면 `SameSite=Lax`로 발급되는데, 프론트(vercel.app)와 백엔드(onrender.com)가 서로 다른 도메인이라 브라우저가 크로스 도메인 요청에 Lax 쿠키를 아예 안 실어보낸다 → `/api/auth/login`은 200 성공해도 `/api/auth/me`가 계속 401 → 로그인이 안 되는 것처럼 보임. **원인**이었던 건 아니고 사전에 값 세팅해서 예방됐지만, 재발 방지용으로 기록.
- **Vercel Deployment Protection(구 Vercel Authentication)을 꺼야 함**: 기본값이 켜져있으면 방문자가 사이트 접속 시 Vercel 계정 로그인을 강제로 요구받는다(우리 앱은 공유 비밀번호 방식이라 방문자가 Vercel 계정을 가질 필요가 없음). Project Settings → Deployment Protection에서 off로 변경 필요.
- **Vite SPA를 Vercel에 올릴 때 `vercel.json` rewrite 필수**: 없으면 `/trips/2`처럼 클라이언트 라우팅 경로를 새로고침할 때 Vercel이 실제 파일을 못 찾아 404를 반환한다(실기기 테스트에서 PC/폰 둘 다 재현). `frontend/vercel.json`에 모든 경로를 `/index.html`로 rewrite하도록 추가해서 해결.
- **모바일에서 `AddItemModal`(구글 검색 탭)에 검색창이 화면 밖으로 밀리고 한글 입력이 깨짐(ㅓㅏㄴㄷㅗㅇ)**: 1차 수정(내부 컨테이너 `overflow-hidden`→`overflow-y-auto`)만으로는 부족했음 — 바깥 배경 레이어(`fixed inset-0 ... items-center`)에 스크롤이 없고 세로 중앙 정렬이라, 키보드가 올라와 보이는 영역이 줄면 모달 자체가 화면 밖으로 밀려도 스크롤해서 볼 방법이 없었음. 바깥 레이어도 `overflow-y-auto` + 모바일에서 `items-start`(위쪽 정렬, `sm:` 이상에서만 중앙 정렬)로 변경해서 **해결 확인 완료** (실기기 재테스트 통과). 레이아웃 흔들림이 안드로이드 한글 IME 조합을 끊어서 자모가 안 합쳐지고 깨진 채로 보였던 것으로 추정 — "직접 입력" 탭(지도 없어서 내용이 짧음)은 처음부터 정상이었던 게 이 가설을 뒷받침함.

## Known Issues (미해결, 낮은 우선순위)
- **삼성 인터넷 브라우저에서 로그인 후 여행 목록이 안 보이고 추가 버튼도 안 먹음** (크롬, 카카오톡 인앱 브라우저는 정상). 추정 원인: 프론트(`vercel.app`)·백엔드(`onrender.com`)가 다른 도메인이라 세션 쿠키가 크로스 사이트 쿠키로 보였고, 삼성 인터넷의 기본 트래킹 방지 기능이 차단하는 것으로 의심. **시도한 해결책이 효과 없었음**: `frontend/vercel.json`에 `/api/*` → Render 프록시 rewrite 추가 + `VITE_API_BASE_URL`을 빈 문자열로(같은 도메인화 시도) 했지만 재현됨. 정확한 원인 미확정. 사용자 판단으로 우선순위 낮춰 보류 — 크롬으로 정상 사용 가능하니 당장 막힌 건 아님. 나중에 재조사할 경우: 삼성 인터넷 개발자 옵션 활성화 후 실제 네트워크 요청이 프록시 경로(`vercel.app/api/...`)로 가는지, Set-Cookie 헤더가 응답에 실제로 붙어오는지부터 확인할 것.

## Known Free-Tier Caveats
- Render 백엔드: 15분 무활동 시 슬립, 재기동에 30~50초 소요 (필요 시 uptime pinger로 완화)
- Neon DB: 유휴 시 자동 슬립, 재개 시 1~수초 지연 (데이터 손실 없음)
- 크로스 도메인 쿠키 인증: `SameSite=None; Secure` (백엔드) + `credentials: 'include'` (프론트) + 정확한 CORS origin 필요
- Google Maps/Places: 유일하게 카드 등록이 필요한 서비스. 사용량이 적어 실제 청구 가능성은 낮음

## Deployment URLs
- Frontend: `https://travel-planner-dtsjs.vercel.app`
- Backend: `https://travel-planner-q6si.onrender.com` (Live)
- Neon project: `travel-planner` (region: ap-southeast-1)

## Things To Remember / Open Questions
- (없음 — 진행하며 추가)

## 상세 작업 로그
날짜별 상세 진행 내역과 "사용자 확인 필요" 항목은 [`logs/MASTER_LOG.md`](../logs/MASTER_LOG.md)에서 확인.

## Milestone Log
- 2026-09-03: M0 완료 — 저장소 초기화(git init, main 브랜치), `backend/`(FastAPI 스켈레톤, `/api/health`), `frontend/`(Vite+React+TS+Tailwind v4, React Query/dnd-kit/@vis.gl 설치), 로컬에서 두 서버 동시 실행 확인.
- 2026-09-03: M1 완료 — SQLModel 모델(Trip/Day/ItineraryItem, CASCADE FK), Alembic 초기 마이그레이션(SQLite 로컬), JWT 서명 쿠키 기반 공유 비밀번호 로그인(`/api/auth/login|logout|me`), `require_session` 의존성으로 보호되는 `/api/trips` CRUD 전체 curl 검증 완료.
- 2026-09-04: M2 완료 — Day/ItineraryItem CRUD + reorder API(백엔드 curl 검증 완료), React 프론트엔드(api 클라이언트, AuthContext, PasscodeGate/TripListPage/DayEditorPage) 빌드 검증 완료. 브라우저 수동 확인은 미완료(사용자 조치 필요).
- 2026-09-04: M3 완료 — `components/ItineraryList.tsx`, `ItineraryItemCard.tsx`에 dnd-kit(PointerSensor+TouchSensor) 드래그 정렬 연동, React Query 낙관적 업데이트로 reorder API 호출. PC 드래그 사용자 확인 완료, 안드로이드 터치 확인은 M6 배포 후로 연기(공인 IP 직결 환경이라 로컬 노출 비권장).
- 2026-09-04: M4 완료 — Google Cloud 키 2개(브라우저/서버) 발급, `services/google_places.py`(Places API (New) Text Search + Place Details 래퍼), `/api/places/search`·`/api/places/{id}` 프록시, 프론트 `AddItemModal`(구글 검색/직접 입력 탭)을 `DayEditorPage`에 연동. 실제 API 호출까지 curl로 검증(오사카성 검색·상세조회 성공).
- 2026-09-04: 사용자 요청으로 "트리플(Triple) 앱" UX 반영을 계획 문서에 추가 — 일정 편집화면 리스트+지도 상시 표시, 검색 시에도 지도 보면서 추가.
- 2026-09-04: M5 완료 — `components/MapView.tsx`(`@vis.gl/react-google-maps` Map+AdvancedMarker+Pin+Polyline, DEMO_MAP_ID 사용중 — 배포 전 실제 Map ID 발급 필요), `DayEditorPage`에 리스트+지도 2단 레이아웃 상시 표시, `AddItemModal`에 지도 내장(검색결과 초록핀 클릭 시 바로 추가, 기존 일정은 검정 번호핀). `@types/google.maps` 설치 + `tsconfig.app.json`의 `types` 배열에 추가해서 타입 에러 해결. 빌드 검증 통과.
- 2026-09-06: M6 진행 — Neon Postgres 프로젝트 생성(Neon Auth off 유지), `db.py`/`alembic/env.py`의 psycopg 드라이버 강제 변환 로직을 실제 Neon URL로 `alembic upgrade head` 실행해 검증(정상 적용). 다음은 Render 백엔드 배포.
- 2026-09-06: Render 백엔드 배포 완료(Live) — `https://travel-planner-q6si.onrender.com`. 첫 배포 시도는 `db.py`/`env.py`의 psycopg 드라이버 수정이 커밋 안 된 상태라 `ModuleNotFoundError: psycopg2`로 실패 → 커밋(`9b48ee7`)+push 후 재배포 성공, `/api/health` 200 확인. 다음은 Vercel 프론트 배포.
- 2026-09-06: M6 완료 — Vercel 프론트 배포(`https://travel-planner-dtsjs.vercel.app`), Deployment Protection off 설정, Render `CORS_ORIGINS`에 Vercel 도메인 추가, 실제 비밀번호 로그인 및 세션 유지까지 브라우저에서 확인 완료. 남은 건 실제 Map ID 발급, Google Cloud 예산 알림, PC+안드로이드 실기기 확인뿐.
- 2026-09-06: 실제 Google Maps Map ID 발급(Raster) 및 적용 완료 — `MapView.tsx`가 `VITE_GOOGLE_MAPS_MAP_ID` 환경변수를 읽도록 수정(하드코딩된 `DEMO_MAP_ID` 제거), 로컬/Vercel 양쪽 env 등록, 브라우저 키 리퍼러 목록에 Vercel 도메인 추가 후 워터마크 없이 정상 렌더링 확인. 남은 건 Google Cloud 예산 알림, PC+안드로이드 실기기 확인.
- 2026-09-06: Google Cloud 예산 알림($5, 알림만) 설정 완료. PC+안드로이드(크롬) 실기기 테스트 진행 — SPA 새로고침 404(`vercel.json` rewrite로 해결), 모바일 한글 입력 깨짐(모달 레이아웃 스크롤 수정으로 해결) 발견 및 수정 완료. 삼성 인터넷 브라우저 이슈는 원인 미확정으로 보류(Known Issues 참고). **초기 개발안(M0~M6) 완성.** 다음은 선택적 M7(폴리싱).
- 2026-09-07: M7 착수 — Tier 1 "여행 생성 시 날짜 범위 → Day 자동 생성"의 **백엔드** 구현 완료. `POST /api/trips`가 `start_date`+`end_date`를 받으면 같은 트랜잭션에서 Day를 일괄 생성하고 `TripDetailRead`(days 포함)를 반환하도록 변경, 날짜 범위 검증(역전/90일 초과 → 422) 추가, 변환 규칙은 `app/services/trip_days.py`로 분리. 스키마 변경이 없어 Alembic 마이그레이션 불필요. curl로 6개 케이스 end-to-end 검증 완료.
- 2026-09-07: M7 Tier 1 **프론트엔드** 3건 완료 — `TripListPage.tsx`에 삭제 버튼(confirm 확인), 인라인 수정 폼(`TripEditForm`, 이름/목적지/기간 + Day 비동기화 안내 문구), 생성 폼 날짜 범위 입력(둘 다 입력 강제, `end` input `min`으로 1차 검증, 422 응답 메시지 표시) 추가. `api/trips.ts`에 `updateTrip` 신설, `createTrip` 반환 타입을 `TripDetail`로 수정(백엔드가 `days` 포함 응답을 주므로). `npm run build` 통과, curl로 API 계약 일치 확인. **Tier 1 백로그 3건(삭제/수정/날짜자동생성) 모두 구현 완료** — 남은 건 브라우저 수동 클릭 테스트(사용자 확인 필요, "여행 기간 PATCH 시 Day 동기화"는 후속 백로그로 남김).
- 2026-09-07: QA 지적 사항 수정 — `PATCH /api/trips/{id}`에 날짜 범위 검증이 빠져있어 역전·366일 기간이 200으로 통과되던 문제 해결. 검증 로직을 `app/services/trip_days.py`의 `validate_date_range()` 순수 함수로 추출해 `TripCreate` validator와 `update_trip` 라우터가 공유하도록 리팩터링(POST 동작·에러 메시지는 그대로 유지). PATCH는 요청값을 DB의 기존 값과 병합한 뒤 검증 → 위반 시 422. curl 12개 케이스 검증 완료(회귀 포함).
- 2026-09-07: QA 지적 사항 수정(프론트) — `TripListPage.tsx`의 `deleteMutation`에 `onError` 핸들러가 없어 삭제 실패(네트워크 오류/401/404 등) 시 아무 피드백 없이 버튼만 재활성화되던 문제 해결. 기존 `extractErrorMessage()` 헬퍼와 생성/수정 폼의 에러 표시 스타일을 재사용해, 실패한 항목의 `<li>` 근처에 에러 메시지 표시(어떤 트립이 실패했는지 `tripId`로 구분). `npm run build` 통과, 백엔드를 임시로 띄워 세션 없이 삭제(401 `Not authenticated`)·존재하지 않는 트립 삭제(404 `Trip not found`) 두 케이스를 API 레벨로 재현해 `extractErrorMessage()` 파싱 경로와 일치함을 확인(브라우저 UI 클릭 확인은 자동화 도구 부재로 미수행).

## Notes for Next Session
- SQLModel 사용 시 Alembic `script.py.mako`에 `import sqlmodel`을 반드시 추가해야 autogenerate가 만든 마이그레이션이 실행됨 (이미 반영됨, 새 마이그레이션 생성 시 자동 포함).
- 쿠키 세션은 `ENVIRONMENT=development`일 때 `Secure=False, SameSite=Lax`, `production`일 때 `Secure=True, SameSite=None`으로 자동 전환됨 (`app/auth.py`).
- 로컬 dev 서버를 여러 개 띄우면 포트 충돌/좀비 프로세스가 잘 발생함 — 코드 수정 후 반응이 없으면 `netstat -ano | findstr :8000`으로 확인 후 재시작 권장.
