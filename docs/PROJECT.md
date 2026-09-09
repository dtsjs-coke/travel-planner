# Travel Planner — Project Notes

## Status / Current Milestone
**M7 진행 중 — Tier 1 "여행 목록 관리 묶음"(삭제 UI / 정보 수정 UI / 날짜 범위 → Day 자동 생성) 백엔드+프론트 구현 완료(2026-09-07), qa-reviewer 검증에서 나온 이슈 2건(삭제 실패 시 무피드백 / `PATCH /api/trips/{id}` 날짜 검증 누락)도 수정 완료. 이어서 Day 탭 자동 라벨링 + 일정 제목 인라인 수정 2건도 완료(2026-09-08, 프론트 전용), 이 과정에서 나온 qa-reviewer 지적(일정 `title` 빈 값 서버측 검증 누락)도 같은 날 수정 완료. 재검증에서 나온 후속 버그(`{"title": null}` 명시적 전송 시 500)도 같은 날 추가 수정 완료. 이어서 **모바일 연속 스크롤 일정 뷰(트리플 스타일) 설계 확정(2026-09-08, senior-dev) + 구현 완료(2026-09-08, ui-dev)** — 신규 파일(`lib/dayLabel.ts`, `hooks/useIsDesktop.ts`, `hooks/useTripItems.ts`, `hooks/useActiveDayOnScroll.ts`, `types/dayEditor.ts`, `components/DayEditorDesktop.tsx`, `components/DayEditorMobile.tsx`) 추가, `DayEditorPage.tsx`는 컨테이너로 리팩터링. 데스크톱은 동작 변화 없음, 모바일은 지도 상단 고정 + Day 연속 스크롤 + 스크롤 스파이로 핀 자동 전환. **qa-reviewer 검증에서 나온 [보통] 회귀(로딩 중 `<ItineraryList>`가 빈 배열을 받아 "등록된 일정이 없습니다"가 잠깐 잘못 뜨는 false empty state)도 같은 날 수정 완료** — `DayEditorDesktop.tsx`를 `!itemsLoading &&`로 게이팅(모바일은 이미 문제 없어 무변경). qa 발견 사소 이슈 3건은 Backlog Tier 2에 기록만(미수정). 빌드 통과, 브라우저 실기 확인만 남음.** 이어서 **여행 기간(PATCH) 수정 시 Day 동기화 백엔드 완료(2026-09-09, senior-dev) + 프론트 완료(2026-09-09, ui-dev)** — `PATCH /api/trips/{id}`가 부족한 Day를 자동 추가하고 범위 밖 Day는 지우지 않고 응답(`out_of_range_days`, `item_count` 포함)으로 보고, 삭제는 사용자 확인 후 프론트가 기존 `DELETE /api/days/{id}`로 처리하는 2단계 방식. 설계 근거는 이 프로젝트의 첫 ADR인 [`docs/adr/0001-patch-trip-date-day-sync.md`](adr/0001-patch-trip-date-day-sync.md). 프론트는 `TripEditForm` 저장 성공 시 `out_of_range_days`가 있으면 확인 모달(`components/OutOfRangeDaysModal.tsx`, 일정 개수 경고 + 개별 `DELETE /api/days/{id}` 부분 실패 허용)을 띄우고, `added_day_ids`만 있으면 "N일이 추가되었습니다" 인라인 안내를 표시하도록 완결됨(**M7 Tier 1 이 항목도 백엔드+프론트 모두 완료**). **이어서 qa-reviewer가 찾은 [보통] 이슈(동시 PATCH 시 같은 날짜 Day 중복 생성 레이스)도 같은 날 수정 완료(senior-dev)** — `Day(trip_id, date)` DB 유니크 제약 + Alembic 마이그레이션 `73a697fa5fee` 추가, 위반 시 409 Conflict 변환(자동 재시도 없음). 근거는 [ADR-0002](adr/0002-day-unique-constraint-and-conflict-handling.md). `POST /api/trips`가 날짜 범위를 받으면 Day를 함께 생성(백엔드), `TripListPage`에 삭제/수정/날짜 범위 생성 UI 연동(프론트) 모두 완료. 삭제 실패(네트워크 오류/401/404) 시에도 기존 `extractErrorMessage()` 패턴으로 해당 항목 근처에 에러 메시지 표시하도록 보강. `DayEditorPage`의 Day 탭 자동 라벨링과 `ItineraryItemCard`의 제목 인라인 수정도 추가(둘 다 백엔드 변경 없음). **이어서 qa-reviewer가 지적한 [보통] 이슈("날짜 추가" 폼이 409 등 에러를 완전히 무시)도 같은 날 수정 완료(junior-dev)** — `createDayMutation`에 `onError` 핸들러 추가, 기존 `extractErrorMessage()` 패턴으로 폼 근처에 에러 표시. 이 과정에서 ADR-0002와 로그에 있던 "이 API를 부르는 화면이 없다"는 부정확한 서술도 정정. 남은 건 실제 브라우저 클릭 테스트(사용자 확인 필요, `logs/2026-09-07.md`·`logs/2026-09-08.md`·`logs/2026-09-09.md` 참고).

**M6 완료 — 초기 개발안(M0~M6) 전체 완성.** Neon·Render·Vercel 배포, 실제 Map ID, Google Cloud 예산 알림, PC+안드로이드(크롬, 서로 다른 네트워크) 실기기 테스트까지 통과. 삼성 인터넷 브라우저 이슈는 아래 Known Issues 참고(우선순위 낮음, 미해결). 다음 단계는 M7(폴리싱)이며, 후보 기능은 아래 "Backlog" 섹션에 우선순위별로 정리해둠.

## Backlog (M7+ 후보, 우선순위별)
초기 개발안(M0~M6) 완성 후 사용자 관점에서 정리한 다음 후보 기능들. "구현 난이도 대비 가치" + "비용 발생 가능성" 기준으로 티어를 나눔. 2026-09-07 코드 검토 기준.

### Tier 1 — 저비용/고가치 (다음 착수 후보)
- [x] **여행 목록 삭제 UI** — 백엔드(`DELETE /api/trips/{id}`)·프론트 API 클라이언트(`deleteTrip`)는 이미 있었고, **2026-09-07 완료**: `TripListPage.tsx`에 삭제 버튼(`window.confirm()` 확인 후 호출) 연결.
- [x] **여행 생성 시 날짜 범위 선택 → Day 자동 생성** — **2026-09-07 완료(백엔드+프론트 모두)**: `POST /api/trips`에 `start_date`+`end_date`가 둘 다 오면 서버가 같은 트랜잭션에서 그 범위(양끝 포함)의 Day를 자동 생성하고, 응답으로 `days` 배열이 포함된 `TripDetailRead`를 반환. `TripListPage.tsx` 생성 폼에 날짜 입력 2개 추가(둘 다 입력/둘 다 비움만 허용), 응답의 `days`로 목록만 갱신(별도 Day API 호출 없음).
- [x] **여행 기간(PATCH) 수정 시 Day 동기화** — **2026-09-09 백엔드+프론트 모두 완료**(설계 결정은 [ADR-0001](adr/0001-patch-trip-date-day-sync.md), 위 Architecture Decisions 요약 참고). `PATCH /api/trips/{id}`가 부족한 날짜의 Day를 자동 추가하고, 범위 밖 Day는 삭제하지 않고 응답 `out_of_range_days`(일정 개수 `item_count` 포함)로 보고한다. TestClient 46개 체크 통과. **동시성 보완(2026-09-09, senior-dev)**: qa 지적에 따라 `Day(trip_id, date)` DB 유니크 제약 + 마이그레이션 `73a697fa5fee` 추가, 충돌은 409로 변환([ADR-0002](adr/0002-day-unique-constraint-and-conflict-handling.md), 58개 체크 통과). **프론트(2026-09-09, ui-dev)**: `updateTrip()` 반환 타입을 `TripUpdateResult`(`types/models.ts`)로 확장, `TripEditForm` 저장 성공 시 `out_of_range_days.length > 0`이면 `components/OutOfRangeDaysModal.tsx` 확인 모달(날짜/`item_count` 표시, "삭제" 선택 시 대상 Day마다 독립적으로 기존 `deleteDay()` 호출 — 부분 실패 허용·`extractErrorMessage()`로 표시, "유지" 선택 시 아무 것도 안 하고 닫기)을 띄우고, `added_day_ids.length > 0`이면 목록 화면에 "N일이 추가되었습니다" 인라인 안내를 표시. 안내 문구도 새 동작에 맞게 수정. `npm run build` 통과.
- [ ] **예산/지출 추적 + 정산(더치페이)** — `ItineraryItem.cost_amount`/`cost_currency`, `Trip.currency` 필드는 이미 존재하나 집계/표시 UI가 없음. "누가 냈는지" 필드를 추가하면 정산 기능까지 확장 가능.
- [x] **여행 정보 수정(이름/기간 편집)** — **2026-09-07 완료**: `PATCH /api/trips/{id}`는 이미 있었고, `TripListPage.tsx`에 인라인 수정 폼(`TripEditForm`) 추가(이름/목적지/시작일/종료일).
- [ ] **일정 메모/체크리스트** (Trip 또는 Day 레벨 자유 텍스트)
- [x] **Day 탭 자동 라벨링** — 사용자 요청(2026-09-07), **2026-09-08 완료**, 같은 날 포맷 변경(대시 제거, "Day1 - 10/01(수)" → "Day1 10/1(수)")까지 반영 완료: `lib/dayLabel.ts`의 `getDayLabel()`(구 `DayEditorPage.tsx`의 `formatAutoDayLabel()`을 이전·개명)이 `label`이 없는 Day에 "Day{순번} {M}/{D}(요일)" 형식(0 패딩 없음)으로 자동 표시(순번은 배열 index, 요일은 date에서 계산). 사용자가 지정한 `label`은 그대로 우선 표시. 데스크톱/모바일 양쪽에서 이 함수 하나만 사용. 백엔드/DB 변경 없음(순수 렌더링 함수).
- [x] **모바일 연속 스크롤 일정 뷰(트리플 스타일)** — 사용자 요청(2026-09-08). 모바일에서 지도를 상단 고정하고 Day1~DayN 일정을 이어붙여 스크롤, 보이는 Day에 따라 지도 핀 자동 전환. 웹(데스크톱)은 현행 유지. **2026-09-08 설계 확정(senior-dev) + 구현 완료(ui-dev)** — 결정 내용은 아래 "Architecture Decisions" 참고, 구현 상세는 `logs/2026-09-08.md`. Day 라벨도 `Day1 9/10(목)`(대시 없음, 0 패딩 없음)로 함께 변경(`lib/dayLabel.ts`, 데스크톱/모바일 공용). 백엔드 변경 없음. 브라우저 실기 확인은 미완료(사용자 확인 필요).
- [x] **일정 이름(제목) 수정 가능하게** — 사용자 요청(2026-09-07), **2026-09-08 완료**: `api/items.ts`에 `updateItem` 추가, `ItineraryItemCard.tsx`에 제목 클릭/연필 아이콘 → 인라인 편집 → Enter/저장 UI 추가(빈 문자열 저장 차단). `DayEditorPage.tsx`에 `updateItemMutation` 추가해 기존 mutation들과 동일한 `invalidateQueries` 패턴 적용. 백엔드 변경 없음(기존 `PATCH /api/items/{id}` 그대로 사용).

### Tier 2 — 중간 난이도 (비용 없음, 스키마/API 확장 필요)
- [ ] 일정 간 이동시간 표시 (Google Directions API) — 기존 Google Cloud 결제 계정을 재사용할 수 있으나 API 호출량이 늘어나므로 예산 알림($5) 임계치 재점검 권장
- [ ] 이전 여행 복제/템플릿
- [ ] 캘린더 내보내기 (ICS → 구글 캘린더)
- [ ] 삼성 인터넷 크로스도메인 쿠키 이슈 (Known Issues 참고, 원인 미확정)
- [ ] 오프라인/PWA 대응
- [ ] `useTripItems`(`hooks/useTripItems.ts`)의 `isError`가 계산만 되고 어디서도 사용되지 않음 — Day 조회 실패 시 사용자가 "빈 Day"와 "로드 실패"를 구분하지 못함(기존부터 있던 갭, 2026-09-08 qa 발견)
- [ ] `docs/PROJECT.md`의 모바일 연속 스크롤 ADR 문구가 `isPending`이라고 적혀있는데 실제 코드(`useTripItems.ts`)는 `isLoading` 사용 — TanStack Query v5에서 의미가 달라(`fetchStatus: 'paused'` 같은 엣지케이스에서 오프라인 시 조기에 로딩 종료로 판정될 가능성) 문서와 코드를 일치시키거나 실제로 `isPending`으로 바꿀지 결정 필요 (2026-09-08 qa 발견)
- [ ] **409 Conflict 응답을 프론트에서 한국어 안내로 매핑** — 백엔드 `detail`은 API 계약 언어 일관성 때문에 영어로 통일돼 있는데(`"Trip not found"` 등 18곳), `extractErrorMessage()`가 그 문자열을 그대로 화면에 노출한다. 2026-09-09에 추가된 409(`"another request just changed this trip's days; refresh and try again"`, `"this trip already has a day with that date"`)를 포함해 상태 코드 → 한국어 문구 매핑을 프론트에 두는 게 맞음(ADR-0002 "왜 에러 문구를 영어로 두는가" 참고). 기존 422 문구들도 같은 문제라 한 번에 처리 권장. 발생 빈도는 낮음.
- [ ] **`MAX_TRIP_TOTAL_DAYS`(180) 동시 요청 우회 — 알려진 한계(수정 안 함)** — 두 PATCH가 서로소 방향(한쪽은 앞으로, 한쪽은 뒤로)으로 동시에 기간을 늘리면 각자 상한 체크를 통과한 뒤 합산돼 최대 270일까지 넘칠 수 있다. 유니크 제약 덕에 같은 방향 동시 확장은 409로 걸리고, 넘친 뒤에는 다음 PATCH부터 기존 422가 막아 자가 수복된다. 락(`SELECT ... FOR UPDATE`)은 SQLite에서 무시돼 로컬 검증이 불가능해 도입하지 않음. 상세는 [ADR-0002](adr/0002-day-unique-constraint-and-conflict-handling.md).
- [ ] `useActiveDayOnScroll`(`hooks/useActiveDayOnScroll.ts`)의 `registerSection`이 `el === null`(언마운트) 케이스를 처리하지 않음 — 현재는 Day 삭제 UI가 없어 도달 불가능하지만, 나중에 Day 삭제 기능이 생기면 메모리 누수 위험 (2026-09-08 qa 발견)

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
> 2026-09-09부터 되돌리기 어려운 결정은 [`docs/adr/`](adr/)에 번호를 매겨 개별 파일로 남기고, 여기에는 요약 + 링크만 둔다. 그 이전 결정들은 아래에 인라인으로 그대로 유지한다.

- 백엔드: FastAPI + SQLModel + Alembic, Postgres(Neon)
- 프론트엔드: React + Vite + Tailwind CSS v4 + React Query + dnd-kit + @vis.gl/react-google-maps
- 인증: 개별 계정 없이 공유 비밀번호(passcode) 1개 → 서명된 쿠키 세션
- 호스팅: Vercel(프론트) / Render 무료(백엔드) / Neon 무료(DB) — 각 도구의 목적/선택 이유/실제 등록 과정/트러블슈팅은 [`docs/infra/`](infra/) 참고: [neon.md](infra/neon.md), [render.md](infra/render.md), [vercel.md](infra/vercel.md)
- **Day 자동 생성은 별도 bulk 엔드포인트 대신 `POST /api/trips` 안에서 처리** (2026-09-07 결정). 후보는 (a) `POST /api/trips/{id}/days/bulk` 신설, (b) 프론트에서 단건 API를 날짜 수만큼 반복 호출, (c) 트립 생성이 Day까지 같이 만들기. **(c) 선택** — 이유: ① 프론트가 왕복 1회로 끝나고 부분 실패(트립은 생겼는데 Day는 일부만) 상태가 원천적으로 없음(단일 트랜잭션), ② (b)는 N번 호출 중 실패 시 프론트가 보상 로직을 떠안아야 함, ③ (a)는 지금 호출할 곳이 트립 생성 한 군데뿐이라 엔드포인트만 늘어남. 대신 날짜 범위 → Day 변환 규칙 자체는 `app/services/trip_days.py`로 빼놨으므로, 나중에 (a)가 실제로 필요해지면(예: 기간 PATCH 동기화) 라우터만 추가하면 됨. 안전장치로 여행 1건의 최대 기간을 90일(`MAX_TRIP_DAYS`)로 제한 — 연도 오타 하나로 수천 행이 생겨 무료 티어 DB를 먹는 사고 방지.
- **날짜 범위 검증은 스키마가 아니라 `app/services/trip_days.py`의 순수 함수 `validate_date_range(start, end)`가 단일 소스** (2026-09-07 결정). `POST`는 `TripCreate`의 `model_validator`가, `PATCH`는 `update_trip` 라우터가 각각 이 함수를 호출한다. PATCH는 부분 업데이트라 요청에 한쪽 날짜만 올 수 있어 **DB의 기존 값과 병합한 뒤**에야 최종 기간이 정해지므로, pydantic 스키마(`TripUpdate`)만으로는 검증이 불가능하다. 두 날짜 중 하나라도 없으면 검증을 건너뛰는 정책도 두 경로에서 동일(= Day 자동 생성 조건과 같은 기준).
- **모바일 일정 화면은 "전체 Day 연속 스크롤 + 상단 고정 지도", 데이터는 Day별 병렬 조회(`useQueries`)로 통일** (2026-09-08 결정). 데스크톱은 기존(Day 탭 + 리스트/지도 2단)을 그대로 두고, 모바일만 Day1~DayN 일정을 한 화면에 이어붙여 세로 스크롤하며 상단 고정 지도의 핀이 "지금 보이는 Day"로 자동 전환되게 한다(트리플 앱 방식).
  - **데이터 로딩**: 후보는 (a) 프론트에서 Day마다 `listItems(dayId)`를 React Query `useQueries`로 병렬 호출, (b) `GET /api/trips/{id}/items` 같은 트립 단위 집계 엔드포인트 신설(또는 `GET /api/trips/{id}` 응답의 `days`에 `items` 중첩). **(a) 선택** — 이유: ① 기존 캐시 키 `['days', dayId, 'items']`를 그대로 쓰므로 `AddItemModal`의 `invalidateQueries`, `reorderMutation`의 낙관적 업데이트 등 이미 검증된 코드를 한 줄도 안 건드려도 됨(회귀 위험이 가장 큰 부분이 드래그 정렬인데 그걸 그대로 보존), ② API 계약 변경이 없어 백엔드/프론트 배포 순서 의존성이 사라짐, ③ 요청 수가 Day 수만큼 늘지만 프론트·백엔드가 Vercel `/api/*` rewrite로 same-origin HTTP/2라 멀티플렉싱되고, 실사용 기간은 며칠~2주(=3~14 요청) 수준이며 최악의 경우도 `MAX_TRIP_DAYS`(90)로 이미 상한이 걸려 있음. (b)의 이점(왕복 1회)은 이 규모에서 체감되지 않는 반면 캐시 키 구조 이전 비용은 확실하게 발생한다.
  - **양쪽 화면이 같은 캐시를 공유**: 데스크톱/모바일 모두 `useTripItems(days)` 훅 하나만 쓰고, 이 훅이 내부적으로 `useQueries`를 돌린다. 데스크톱 탭 전환은 이미 받아둔 캐시를 읽으므로 추가 요청이 없어진다(기존보다 오히려 빨라짐). 나중에 (b)가 필요해지면 **이 훅 내부만 갈아끼우면 되고 화면 코드는 그대로**다 — 그래서 훅 경계를 지금 만들어 둔다.
  - **모바일 첫 렌더 레이아웃 시프트 방지**: Day별 응답이 제각각 도착하면 스크롤 컨테이너 높이가 계속 바뀌어 IntersectionObserver 판정과 사용자의 스크롤 위치가 흔들린다. 그래서 모바일 리스트는 **모든 Day 쿼리가 끝난 뒤 한 번에** 렌더한다(`isLoading = results.some(r => r.isPending)`). 데스크톱은 활성 Day만 보므로 이 게이트를 적용하지 않는다.
  - **데스크톱/모바일 분기는 CSS가 아니라 JS 미디어쿼리(`useIsDesktop`, `768px`)로 한다** — Tailwind `hidden md:block`으로 양쪽 트리를 동시에 렌더하면 `<MapView>`(Google Maps) 인스턴스가 2개 마운트되어 **Map load가 2배로 과금**된다. 지도 인스턴스는 항상 1개만 마운트되도록 컴포넌트 자체를 택일 렌더한다.
  - **"현재 보이는 Day" 추적은 IntersectionObserver 스크롤 스파이**로 하고, 판정선은 **상단 고정 블록(지도+Day 칩)의 실제 높이를 `ResizeObserver`로 측정해서** 정한다(`rootMargin: '-<측정높이+16>px 0px -30% 0px'`). vh 단위로 고정하지 않는 이유: 모바일 주소창 유무에 따라 `vh`(large viewport)와 IntersectionObserver root(실제 뷰포트)가 어긋나고, Day 칩 줄 높이도 폰트/기기마다 달라 매직넘버가 쉽게 깨진다. 여러 섹션이 동시에 밴드에 걸리면 `boundingClientRect.top`이 가장 작은 섹션(= 밴드 상단을 점유한, 지도 바로 밑에 있는 Day)을 활성으로 본다. 가상 스크롤링은 도입하지 않는다(트립당 아이템 수백 개 미만 전제).
- **기간 PATCH 시 Day 동기화는 "추가만 하고 삭제는 사용자 확인 후 프론트가"** (2026-09-09 결정, 상세는 [ADR-0001](adr/0001-patch-trip-date-day-sync.md)). `PATCH /api/trips/{id}`가 날짜 필드를 포함하고 두 날짜가 다 있으면, 새 범위에 없는 Day만 추가하고(`app/services/trip_days.py`의 `diff_days_for_range()` — 기존 `build_days_for_range()` 재사용) **범위 밖 Day는 절대 자동 삭제하지 않는다**(Day → ItineraryItem이 CASCADE라 일정이 통째로 날아감). 대신 응답 `TripUpdateResult`에 `out_of_range_days`(`DayRead` + `item_count`)와 `added_day_ids`를 실어 프론트가 경고 모달을 띄우고, 사용자가 확인하면 **기존 `DELETE /api/days/{id}`**로 개별 삭제한다(새 엔드포인트 0개). 후보 (b) `force=true` 한 방 처리는 파괴적 동작을 일반 수정 요청에 묶어 클라이언트 실수 한 줄이 곧 데이터 손실이 되고 경고하려면 어차피 사전 조회가 필요해서 기각, (c) 그냥 남겨두고 UI 표시만은 정리 수단이 없어 기각(단 (a)에서 사용자가 삭제를 거절하면 결과가 (c)와 같음). 응답은 `TripDetailRead`의 상위집합이라 기존 프론트 코드와 호환된다. 이름만 바꾸는 PATCH는 Day를 건드리지 않고(요청에 날짜 키가 있을 때만 동기화), 범위 밖 Day를 안 지우는 대신 트립당 총 Day를 `MAX_TRIP_TOTAL_DAYS`(=180)로 제한해 기간 이동 PATCH 반복 시 무한 누적을 막는다.
- **`Day(trip_id, date)`에 DB 유니크 제약을 걸고, 위반은 409로 변환하되 자동 재시도는 하지 않는다** (2026-09-09 결정, 상세는 [ADR-0002](adr/0002-day-unique-constraint-and-conflict-handling.md)). "한 여행에 같은 날짜 Day는 하나"는 도메인 불변식인데 애플리케이션 레벨 중복 체크(`diff_days_for_range`)는 자기 트랜잭션이 읽은 스냅샷만 보므로 동시 PATCH를 막지 못한다. 라우터가 `async def`가 아니라 `def`라 FastAPI가 스레드풀에서 병렬 실행하므로 Render 인스턴스가 1개여도 실제로 동시 실행된다. 그래서 `models.py`의 `__table_args__`에 `uq_day_trip_id_date`를 두고 Alembic(`73a697fa5fee`)으로 적용한다 — 이 마이그레이션은 기존 중복이 있으면 어떤 행인지 찍고 **일부러 실패**한다(자동 삭제 시 CASCADE로 일정이 날아가므로 사람이 판단). 충돌 시 `update_trip`은 트랜잭션 전체를 롤백하고 409를 주며 **자동 재시도하지 않는다**: 상대 요청이 기간까지 바꿨을 수 있어 재시도가 곧 상대 변경을 덮어쓰는 last-write-wins가 되기 때문(ADR-0001의 "파괴적/모호한 판단은 사람이"와 같은 기준). `create_day`/`update_day`도 409(유니크 제약 도입으로 같은 날짜 수동 추가가 201→409로 바뀜). `create_trip`은 새 `trip.id`라 충돌이 구조적으로 불가능해 처리하지 않는다. **`MAX_TRIP_TOTAL_DAYS`(180)의 동시 우회는 락 대신 알려진 한계로 문서화**했다 — 유니크 제약 때문에 같은 방향 동시 확장은 이미 409로 걸리고, 서로소 방향일 때만 최대 270일까지 넘친 뒤 다음 요청부터 기존 422가 막아 자가 수복되며, `SELECT ... FOR UPDATE`는 SQLite에서 무시돼 로컬 검증이 불가능하기 때문(검증할 수 없는 락 < 문서화된 한계).
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
- 2026-09-08: M7 Tier 1 프론트 2건 완료 — Day 탭 자동 라벨링(`Day{순번} - MM/DD(요일)`), 일정 제목 인라인 수정(`ItineraryItemCard.tsx`, 빈 문자열 클라이언트 단 차단). 둘 다 백엔드 변경 없음. 빌드 통과, curl로 API 계약 확인.
- 2026-09-08: QA 지적 사항 수정(백엔드) — `ItineraryItemCreate`/`ItineraryItemUpdate`에 `title` 검증이 없어 빈 문자열/공백만 있는 제목이 서버에 그대로 저장되던 문제 해결. `field_validator`로 trim 후 빈 문자열이면 422(`title must not be empty`), 저장값은 trim 정규화. `ItineraryItemUpdate`는 요청에 `title` 자체가 없으면(None) 기존처럼 부분 업데이트 통과, 명시적으로 빈/공백 값이 오면만 거부(라우터 변경 없이 스키마 레벨로 처리). curl 7케이스(정상 생성/수정, notes만 PATCH하는 회귀 케이스 포함) 검증 완료. 테스트 데이터 정리, 기존 트립(id 1·2) 데이터 보존.
- 2026-09-08: QA 재검증 지적 수정(백엔드) — 위 `ItineraryItemUpdate._validate_title`의 `if value is None: return value` 조기 리턴이 "필드 생략"과 "명시적 `{"title": null}` 전송"을 구분하지 못해 후자도 통과시켜, 라우터가 `setattr(item, "title", None)`을 실행 → DB `title` `NOT NULL` 제약 위반으로 처리 안 된 500 에러가 나던 버그 발견/수정. validator가 호출됐다는 것 자체가 "값이 명시적으로 왔다"는 뜻이므로 조기 리턴을 제거하고 `None`도 빈 문자열과 동일하게 422로 거부하도록 통일(필드 생략 시엔 라우터의 `exclude_unset=True`가 애초에 validator를 호출하지 않으므로 회귀 없음). FastAPI `TestClient` 스크립트로 5케이스(null→422, 빈 문자열/공백→422, notes만 PATCH→200 title 유지 회귀 케이스, 정상 제목→200) 검증 완료. 테스트 데이터 정리, 기존 트립(id 1·2) 보존 확인.

- 2026-09-09: M7 Tier 1 **"여행 기간(PATCH) 수정 시 Day 동기화" 백엔드 완료(senior-dev)** — 설계는 [ADR-0001](adr/0001-patch-trip-date-day-sync.md)로 기록(이 프로젝트의 첫 ADR 파일, `docs/adr/` 신설). `diff_days_for_range()`/`DayRangeDiff`/`MAX_TRIP_TOTAL_DAYS`(`services/trip_days.py`), `TripUpdateResult`/`OutOfRangeDayRead`(`schemas.py`), `update_trip` 라우터에 동기화 로직 추가. 범위 밖 Day는 서버가 절대 지우지 않고 응답으로 보고만 하며(일정 개수 포함), 삭제는 프론트가 확인받은 뒤 기존 `DELETE /api/days/{id}`로 처리하는 2단계 방식. DB 스키마 변경 없어 Alembic 마이그레이션 불필요. FastAPI TestClient로 8개 시나리오 46개 체크 검증 완료(임시 SQLite DB 사용, `dev.db` 무변경). 프론트 확인 모달은 ui-dev 후속 작업.
- 2026-09-09: 위 항목 **프론트 완료(ui-dev)** — `types/models.ts`에 `OutOfRangeDay`/`TripUpdateResult` 타입 추가, `api/trips.ts`의 `updateTrip()` 반환 타입을 `TripUpdateResult`로 확장(API 클라이언트 함수는 하위호환, 기존 필드에 추가만). 신규 `components/OutOfRangeDaysModal.tsx`(범위 밖 Day 목록 + 날짜/`item_count` 표시, `item_count > 0`이면 "일정 N개도 함께 사라지고 되돌릴 수 없습니다" 경고, "삭제"는 대상 Day마다 독립적으로 기존 `deleteDay()`(`api/days.ts`, 이미 있었음) 호출 후 `Promise.allSettled`로 부분 실패 허용 — 실패한 Day만 남기고 에러 메시지 표시, "유지"는 아무 것도 안 하고 닫기). `TripListPage.tsx`의 `TripEditForm`이 저장 성공 시 `out_of_range_days.length > 0`이면 이 모달을, 없고 `added_day_ids.length > 0`이면 "N일이 추가되었습니다" 인라인 안내(목록으로 돌아온 뒤 해당 트립 항목 근처에 표시, 기존 `deleteError` 표시 패턴과 동일 위치)를 띄우도록 변경. `extractErrorMessage()`는 여러 컴포넌트가 공유하도록 `lib/errors.ts`로 이동(동작 변화 없음). 안내 문구도 "기간을 늘리면 부족한 날짜가 자동 추가되고, 범위 밖 날짜는 확인 후 삭제할 수 있다"로 갱신. `DayEditorMobile.tsx`/`lib/dayLabel.ts`는 무변경(스코프 밖). `npm run build` 통과. 브라우저 수동 클릭 테스트는 미수행(사용자 확인 필요).
- 2026-09-09: 위 기능의 **QA 지적(보통) 수정 — Day 중복 생성 레이스 컨디션 차단(senior-dev)**. `Day`에 `(trip_id, date)` 복합 유니크 제약(`uq_day_trip_id_date`) 추가 + Alembic 마이그레이션 `73a697fa5fee`(로컬 `dev.db` 적용/롤백 왕복 확인, 중복 0건). 제약 위반은 `update_trip`/`create_day`/`update_day`에서 409 Conflict로 변환하고 자동 재시도는 하지 않음(재시도가 상대의 기간 변경을 덮어쓰는 last-write-wins가 되므로). 설계 근거는 [ADR-0002](adr/0002-day-unique-constraint-and-conflict-handling.md). TestClient 58개 체크 통과(기존 9개 회귀 시나리오 포함).
- 2026-09-09: 위 변경에 대한 **qa-reviewer 재검증에서 나온 [보통] 이슈 수정(junior-dev)** — `DayEditorPage.tsx`의 "날짜 추가" 폼이 `createDayMutation` 실패(신설된 409 포함)를 완전히 무시하고 아무 피드백도 주지 않던 문제 해결. `onError` 핸들러 추가, 기존 `extractErrorMessage()` 재사용해 폼 근처에 에러 표시, 재시도/재입력 시 이전 에러 초기화(`TripListPage.tsx`의 `createMutation` 패턴과 동일). `npm run build` 통과. 이 과정에서 ADR-0002와 `logs/2026-09-09.md`에 있던 "이 API를 부르는 화면이 없어 영향 없음"이라는 부정확한 서술도 정정(실제로는 이미 배포된 화면이 이 API를 호출하고 있었음).

- 2026-09-08: **모바일 연속 스크롤 일정 뷰 설계 확정(senior-dev, 코드 변경 없음)** — 데이터 로딩은 백엔드 신설 엔드포인트 대신 `useQueries` Day별 병렬 조회로 결정(기존 캐시 키·드래그 정렬 낙관적 업데이트를 그대로 보존하는 게 이 규모에선 왕복 1회보다 이득), 데스크톱/모바일은 Google Maps 인스턴스 중복 마운트(=Map load 이중 과금)를 피하려 CSS가 아닌 JS 미디어쿼리로 택일 렌더, "보이는 Day" 추적은 상단 고정 블록 높이를 `ResizeObserver`로 측정해 `rootMargin`을 잡는 IntersectionObserver 스크롤 스파이로 결정. Day 라벨 포맷도 `Day1 - 09/10(목)` → `Day1 9/10(목)`(대시 제거, 월·일 0 패딩 없음)으로 확정. 상세 근거는 위 Architecture Decisions, 구현 스펙은 `logs/2026-09-08.md` 참고.

## Notes for Next Session
- SQLModel 사용 시 Alembic `script.py.mako`에 `import sqlmodel`을 반드시 추가해야 autogenerate가 만든 마이그레이션이 실행됨 (이미 반영됨, 새 마이그레이션 생성 시 자동 포함).
- 쿠키 세션은 `ENVIRONMENT=development`일 때 `Secure=False, SameSite=Lax`, `production`일 때 `Secure=True, SameSite=None`으로 자동 전환됨 (`app/auth.py`).
- **2026-09-09에 Alembic 마이그레이션 `73a697fa5fee`(Day 유니크 제약)가 추가됐다.** 로컬 `dev.db`에는 이미 적용해뒀지만, 다른 환경(운영 Neon 포함)에서는 `alembic upgrade head`가 필요하다. 기존 중복 `(trip_id, date)`가 있으면 마이그레이션이 일부러 실패하며 어떤 행인지 알려준다.
- 로컬 dev 서버를 여러 개 띄우면 포트 충돌/좀비 프로세스가 잘 발생함 — 코드 수정 후 반응이 없으면 `netstat -ano | findstr :8000`으로 확인 후 재시작 권장.
