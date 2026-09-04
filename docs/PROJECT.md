# Travel Planner — Project Notes

## Status / Current Milestone
M5 완료 (브라우저 확인까지 완료): 지도 렌더링, 일정 추가 시 지도에서 클릭으로 추가하는 것까지 실제 동작 확인함. 다음: M6 (배포 — Neon/Render/Vercel).

## Setup TODOs (one-time)
- [x] Google Cloud 프로젝트 생성, Maps JavaScript API + Places API (New) 활성화
- [x] 결제 계정(카드) 등록 — Google Maps Platform은 무료 사용량 내에서도 카드 등록 필수
- [x] 브라우저 키(HTTP 리퍼러 제한) 발급 → `frontend/.env`의 `VITE_GOOGLE_MAPS_BROWSER_KEY`
- [x] 서버 키(Places API (New) 전용, 브라우저 키와 분리) 발급 → `backend/.env`의 `GOOGLE_PLACES_SERVER_KEY`
- [ ] Google Cloud Billing에 예산 알림 설정 (예: $5) — 아직 확인 안 됨, 잊지 말고 설정할 것
- [ ] **실제 Google Maps Map ID 발급** (Cloud Console → 지도 관리) — 현재는 임시로 `DEMO_MAP_ID` 사용 중이라 지도에 "개발 목적으로만 사용" 워터마크가 뜸. 배포(M6) 전에 발급해서 `MapView.tsx`의 기본값 교체 필요.
- [ ] Neon 프로젝트 생성 → DATABASE_URL 확보
- [ ] Render 웹 서비스 생성 → env 변수 설정
- [ ] Vercel 프로젝트 생성 → env 변수 설정
- [ ] SHARED_PASSCODE 정하고 두 사람 모두 공유

## Architecture Decisions
- 백엔드: FastAPI + SQLModel + Alembic, Postgres(Neon)
- 프론트엔드: React + Vite + Tailwind CSS v4 + React Query + dnd-kit + @vis.gl/react-google-maps
- 인증: 개별 계정 없이 공유 비밀번호(passcode) 1개 → 서명된 쿠키 세션
- 호스팅: Vercel(프론트) / Render 무료(백엔드) / Neon 무료(DB)
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
- `VITE_API_BASE_URL` — 백엔드 API 기본 URL
- `VITE_GOOGLE_MAPS_BROWSER_KEY` — Maps JS SDK용 브라우저 키 (리퍼러 제한 필수)

## Gotchas (발생했던 문제들, 재발 방지용)
- Google Maps 브라우저 키의 HTTP 리퍼러 제한에서 **와일드카드 패턴이 기대대로 안 먹힐 수 있음** (`localhost:*/*`, `*localhost:*/*` 둘 다 실패 경험). 새 도메인 추가할 때 와일드카드보다 **정확한 전체 URL**(`http://localhost:5173/*`, 배포 후엔 `https://실제도메인/*`)을 우선 시도할 것.
- `.env` 파일은 서버/dev 프로세스 **시작 시점에만** 읽힘 — 실행 중에 값 추가/수정했다면 반드시 재시작해야 반영됨 (백엔드 uvicorn, 프론트 vite 둘 다 해당).

## Known Free-Tier Caveats
- Render 백엔드: 15분 무활동 시 슬립, 재기동에 30~50초 소요 (필요 시 uptime pinger로 완화)
- Neon DB: 유휴 시 자동 슬립, 재개 시 1~수초 지연 (데이터 손실 없음)
- 크로스 도메인 쿠키 인증: `SameSite=None; Secure` (백엔드) + `credentials: 'include'` (프론트) + 정확한 CORS origin 필요
- Google Maps/Places: 유일하게 카드 등록이 필요한 서비스. 사용량이 적어 실제 청구 가능성은 낮음

## Deployment URLs
- Frontend: (미배포)
- Backend: (미배포)
- Neon project: (미생성)

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

## Notes for Next Session
- SQLModel 사용 시 Alembic `script.py.mako`에 `import sqlmodel`을 반드시 추가해야 autogenerate가 만든 마이그레이션이 실행됨 (이미 반영됨, 새 마이그레이션 생성 시 자동 포함).
- 쿠키 세션은 `ENVIRONMENT=development`일 때 `Secure=False, SameSite=Lax`, `production`일 때 `Secure=True, SameSite=None`으로 자동 전환됨 (`app/auth.py`).
- 로컬 dev 서버를 여러 개 띄우면 포트 충돌/좀비 프로세스가 잘 발생함 — 코드 수정 후 반응이 없으면 `netstat -ano | findstr :8000`으로 확인 후 재시작 권장.
