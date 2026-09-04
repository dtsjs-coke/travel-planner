# 2026-09-04

## 진행한 작업

### M2 — 일자/일정 CRUD + 기본 React 화면

**백엔드**
- `Day` CRUD 라우터 (`POST /api/trips/{trip_id}/days`, `PATCH /api/days/{day_id}`, `DELETE /api/days/{day_id}`)
- `ItineraryItem` CRUD + 재정렬 라우터 (`GET/POST /api/days/{day_id}/items`, `PATCH/DELETE /api/items/{item_id}`, `POST /api/days/{day_id}/items/reorder`) — 삭제 시 남은 아이템 position 자동 재정렬 포함
- `GET /api/trips/{trip_id}`가 해당 여행의 일자 목록을 중첩(`days`)해서 반환하도록 확장
- 전체 흐름(로그인 → 여행 생성 → 일자 생성 → 일정 2개 생성 → 순서 변경 → 수정 → 삭제 → 재정렬 확인)을 curl로 end-to-end 검증

**프론트엔드**
- `api/` 클라이언트 계층: `client.ts`(axios, `withCredentials`), `auth.ts`, `trips.ts`, `days.ts`, `items.ts`
- `context/AuthContext.tsx`: 세션 확인/로그인/로그아웃 상태 관리
- `routes/PasscodeGate.tsx`, `TripListPage.tsx`, `DayEditorPage.tsx`(일자 탭 + 수동 일정 추가/삭제, 드래그 정렬은 M3에서 추가 예정)
- `App.tsx`: React Query Provider + react-router-dom 라우팅 + 인증 게이트 와이어링
- TypeScript 빌드(`npm run build`) 및 Vite dev 서버 기동 확인 — 모듈/타입 에러 없음

## 발생한 이슈와 해결

- **`GET /api/trips/{id}` 500 에러**: `TripDetailRead(**trip.model_dump(), days=days)`처럼 Pydantic 모델 생성자에 SQLModel ORM 객체 리스트를 직접 넣으면 `from_attributes=True` 설정이 없어 검증 실패. `schemas.py`에 공통 `ORMModel` 베이스(`model_config = ConfigDict(from_attributes=True)`)를 만들어 모든 Read 스키마가 상속하도록 수정.

## 사용자 확인/조치 필요

- [ ] **브라우저에서 직접 확인 필요**: 이번 세션에는 브라우저 자동화 도구가 없어서, 코드가 컴파일/빌드되고 API가 curl로는 정상 동작하는 것까지만 검증했습니다. 실제 화면에서 다음을 확인해주세요:
  - `http://localhost:5174`(또는 현재 뜬 포트) 접속 → 비밀번호 화면 → 로그인
  - 여행 추가 → 목록에 나타나는지
  - 여행 클릭 → 날짜 추가 → 일정(수동) 추가/삭제
  - 새로고침 후에도 로그인 상태 유지되는지
- [ ] 백엔드/프론트엔드 재시작 필요 (코드가 많이 바뀌어서 `--reload`가 꼬였을 수 있음 — 이상하면 껐다 켜기)

## 다음 할 일 (당시 기준, 아래 M3 진행으로 갱신됨)

M3: 드래그앤드롭 순서 변경(dnd-kit)을 `DayEditorPage`에 연동.

---

## M3 — 드래그앤드롭 순서 변경

- `components/ItineraryItemCard.tsx`: `@dnd-kit/sortable`의 `useSortable`로 드래그 핸들(⠿) 구현
- `components/ItineraryList.tsx`: `DndContext` + `SortableContext`, `PointerSensor`(마우스) + `TouchSensor`(안드로이드 터치, 150ms 지연으로 스크롤과 충돌 방지)
- `DayEditorPage.tsx`: `reorderMutation`을 React Query 낙관적 업데이트(`onMutate`로 즉시 화면 반영 → 실패 시 롤백 → 완료 후 재검증)로 구현, 기존 인라인 `<ol>`을 `ItineraryList`로 교체
- 빌드(`npm run build`) 통과 확인

### 사용자 확인/조치 필요
- [x] **PC 드래그 동작 확인** — 사용자가 여행 목록에서 직접 확인, 정상 동작.
- [x] `.gitignore`의 `.env.example` 무시 항목 — 사용자가 의도적으로 추가한 것 확인, 사용자가 직접 관리하기로 함.
- [ ] **안드로이드 터치 드래그 확인은 M6(배포) 이후로 연기** — 이 PC가 공유기 없이 KT로부터 공인 IP를 직접 할당받는 구조라, 폰과 같은 사설 LAN이 아닐 가능성이 높음. 지금 로컬 서버를 강제로 노출시키려면 방화벽을 열어야 하는데 이는 HTTPS도 없고 비밀번호 하나로만 막힌 서버를 인터넷에 노출하는 셈이라 비권장. M6에서 실제 배포 URL(HTTPS)로 테스트하기로 결정.

### 다음 할 일 (당시 기준, 아래 M4 진행으로 갱신됨)
M4: Google Cloud 프로젝트/API 키 발급 (선행 TODO) → 백엔드 Places 프록시 → 프론트 "구글 검색으로 추가" 탭.

---

## M4 — Google Places 연동

- 사용자가 Google Cloud 콘솔에서 프로젝트 생성, 결제 등록, Maps JavaScript API + Places API (New) 활성화, 브라우저 키(리퍼러 제한)/서버 키(Places API (New) 전용) 발급 완료
- **중간 이슈**: 서버 키를 처음엔 브라우저 키와 같은 값으로 `backend/.env`에 넣으셨다가(재사용), 사용자가 다시 별도 키를 발급해서 재저장 → 두 키 값이 다른 것 확인 완료
- 백엔드: `services/google_places.py`(Places API (New) `searchText`/Place Details httpx 래퍼), `routers/places.py`(`GET /api/places/search`, `GET /api/places/{place_id}`), `require_session`으로 보호
- 프론트: `api/places.ts`, `components/AddItemModal.tsx`(구글 검색 탭 + 직접 입력 탭, 모달 오버레이), `DayEditorPage`의 기존 인라인 수동 입력 폼을 모달 오픈 버튼으로 교체
- **실제 Google API 호출까지 curl로 검증**: "Osaka Castle" 검색 → 정상 결과, place_id로 상세조회 → 전화번호/웹사이트/영업시간까지 정상 반환
- 프론트 빌드 검증 통과

### 사용자 확인/조치 필요
- [ ] **브라우저에서 "구글 검색으로 추가" 실제 확인**: 일정 추가 버튼 → 구글 검색 탭 → 장소 검색 → 결과에서 추가 → 목록에 잘 들어가는지, 지도용 위경도가 저장되는지 확인해주세요.
- [ ] **Google Cloud Billing 예산 알림 설정 아직 안 하셨다면 설정 권장** (안전장치, 예: $5)

### 다음 할 일 (당시 기준, 아래 진행으로 갱신됨)
M5: `@vis.gl/react-google-maps`로 선택된 날짜의 일정을 순서대로 지도에 번호 마커+경로선 표시.

---

## 개발 계획 업데이트 — 트리플(Triple) 앱 UX 반영

사용자 요청으로 플랜 파일(`C:\Users\user\.claude\plans\pjt-dapper-snowglobe.md`)과 `docs/PROJECT.md`에 아래 내용 반영:

- 일정 편집 화면(DayEditorPage)은 리스트만이 아니라 **지도를 항상 같이 보여줌**
- 일정을 **추가할 때도 지도를 보면서** 고를 수 있게, `AddItemModal`의 구글 검색 결과를 지도 위 핀으로도 표시(기존 일정 핀과 함께)
- 이에 따라 M5 범위가 "지도 표시" + "AddItemModal에 지도 내장 리팩터링"으로 확장됨

실제 구현은 아직 안 했고, 계획 문서에만 반영한 상태 (다음 M5 작업 시 이 방향으로 구현 예정).

---

## M5 — 구글맵 표시 (트리플 스타일 UX 구현)

- `components/MapView.tsx` 신규: `@vis.gl/react-google-maps`의 `Map`+`AdvancedMarker`+`Pin`+`Polyline` 사용. 기존 일정은 검정 번호핀 + 연결선, 검색 결과는 초록 핀으로 구분 표시. `useMap()`으로 마커 전체가 보이도록 자동 `fitBounds` 처리.
- `DayEditorPage`: `APIProvider`로 감싸고, 일정 리스트와 지도를 2단 레이아웃(데스크톱 좌우, 모바일 위아래)으로 상시 표시하도록 변경 — 항상 지도를 보면서 일정 관리 가능.
- `AddItemModal`: 구글 검색 탭에 지도를 내장 — 검색 결과(초록 핀)와 기존 일정(검정 번호핀)을 같이 보여주고, **초록 핀을 클릭하면 바로 일정에 추가**됨 (리스트의 "추가" 버튼과 동일 동작). 트리플 앱처럼 지도를 보면서 위치 감각 있게 고를 수 있게 함.
- **이슈**: `MapView.tsx`에서 `google.maps.LatLngBounds` 등 전역 `google` 타입을 못 찾는 TS 에러 발생 → `@types/google.maps` 설치 + `frontend/tsconfig.app.json`의 `types` 배열이 `["vite/client"]`로 제한되어 있어서 새 타입 패키지가 자동 포함 안 됨 → `types: ["vite/client", "google.maps"]`로 수정해서 해결.
- **참고 사항**: `AdvancedMarker`는 유효한 Google Maps "Map ID"가 있어야 정상 동작하는데, 아직 실제 Map ID를 안 만들어서 임시로 구글이 제공하는 `DEMO_MAP_ID`(테스트용 placeholder)를 쓰고 있음 → 지도에 "개발 목적으로만 사용" 워터마크가 보일 것임. 배포 전(M6)에 Cloud Console에서 실제 Map ID 발급 필요.
- 프론트 빌드(`npm run build`) 검증 통과.

### 사용자 확인/조치 필요
- [x] **브라우저에서 지도 렌더링 실제 확인** — 완료. 중간에 `RefererNotAllowedMapError` 발생(브라우저 키의 HTTP 리퍼러 제한에 현재 접속 주소가 없었음) → 리퍼러 목록을 와일드카드 없는 정확한 값(`http://localhost:5173/*`)으로 저장 후 해결. **참고**: 이 프로젝트에서 리퍼러 와일드카드 패턴(`localhost:*/*`, `*localhost:*/*`)이 기대대로 안 먹혔던 경험이 있으니, 이후 배포 도메인 추가할 때도 와일드카드 대신 정확한 URL을 우선 시도할 것.
- [ ] Google Cloud Console에서 **실제 Map ID 발급** (배포 전 필요 — M6에서 처리 예정)

### 다음 할 일
M6: Neon(DB)/Render(백엔드)/Vercel(프론트) 배포, 실제 Map ID 적용, CORS·쿠키 크로스도메인 설정, PC+안드로이드 실기기 접속 테스트.
