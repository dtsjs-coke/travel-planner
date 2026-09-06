## M6 — 배포 (진행 중, 이어서)

- (오케스트레이터 세션에서 진행 — `orchestrator_pjt`) `backend/app/db.py`, `backend/alembic/env.py`의 `_normalize_database_url` 수정 사항을 실제 Neon Postgres에 대해 검증: Neon 프로젝트(`travel-planner`, region ap-southeast-1) 생성, Connection string(pooled) 발급 — Neon Auth는 off로 유지(공유 비밀번호 방식이라 불필요).
- 로컬 `.env`는 SQLite로 유지한 채, `DATABASE_URL` 환경변수를 임시로 Neon URL로 오버라이드해서 `alembic upgrade head` 1회 실행 → `b9eafc6696db` (initial schema: trip, day, itinerary_item) 정상 적용 확인. `postgresql://` → `postgresql+psycopg://` 강제 변환 로직이 실제 배포 조건에서 정상 동작함을 확인.
- Neon connection string은 비밀값이라 문서/로그에 기록하지 않음 — 다음 단계(Render 백엔드 env 변수 설정)에서 다시 사용 예정.

## Render 백엔드 배포

- Root Directory `backend`, Build `pip install -r requirements.txt`, Start `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`, env 변수(ENVIRONMENT=production, DATABASE_URL=Neon URL, SECRET_KEY, SHARED_PASSCODE, GOOGLE_PLACES_SERVER_KEY) 설정.
- **첫 배포 실패**: `backend/app/db.py`/`backend/alembic/env.py`의 psycopg 드라이버 강제 변환 수정이 로컬에만 있고 커밋이 안 된 상태로 배포되어, SQLAlchemy가 `postgresql://`을 기본 `psycopg2`(미설치)로 해석 → `ModuleNotFoundError: No module named 'psycopg2'`로 배포 실패. (로컬 Alembic 검증 때는 환경변수로 직접 값을 오버라이드해서 돌렸기 때문에 이 커밋 누락을 못 잡아냈음 — 교훈: 로컬 1회성 검증만으로 "커밋까지 됐다"고 착각하지 말 것.)
- 수정 사항 커밋(`9b48ee7`) + `git push origin main` → Render 자동 재배포 → **Deploy succeeded, Live** 확인.
- 도중에 배포 상태가 헷갈렸던 이유: 오래된 배포 시도가 "Canceled"로 표시되고 있어서 최신 배포와 혼동. Render "Deploys" 탭에서 **맨 위(최신) 항목**의 상태를 봐야 함.
- 배포 직후 `/api/health` 호출 시 502/503이 잠깐 보였는데, 실제로는 (a) 조회에 쓴 WebFetch 도구의 15분 캐시가 이전 실패 응답을 물고 있었던 것 + (b) Render 프록시가 뒷단 연결 전에 자체 인터스티셜(502) 페이지를 보여준 것이 겹친 현상이었음. 캐시 우회 후(쿼리 파라미터 추가) `{"status":"ok"}` 200 정상 확인.
- 서비스 URL: `https://travel-planner-q6si.onrender.com`

## Vercel 프론트 배포 + 크로스 도메인 인증 마무리

- Root Directory `frontend`, Framework Vite 자동 감지. 저장소 연결 시 Render 때와 동일하게 Vercel GitHub App "Install" 필요(private 저장소).
- `VITE_API_BASE_URL`=Render URL, `VITE_GOOGLE_MAPS_BROWSER_KEY` 설정 후 배포 성공. 프로덕션 고정 도메인은 `https://travel-planner-dtsjs.vercel.app` (배포마다 안 바뀜 — git-브랜치용/1회성 스냅샷용 도메인은 따로 있으니 혼동 주의).
- **이슈 1 — Vercel Deployment Protection**: 기본 켜져있어서 방문자가 Vercel 로그인을 강제로 요구받음(우리 앱은 공유 비밀번호 방식이라 방문자 계정 불필요). Settings → Deployment Protection → off로 해결.
- **이슈 2 — CORS 차단**: `https://travel-planner-dtsjs.vercel.app`에서 `/api/auth/login`, `/api/auth/me` 호출 시 "No 'Access-Control-Allow-Origin' header" 에러. Render의 `CORS_ORIGINS`에 Vercel 프로덕션 도메인 추가(끝에 슬래시 없이) → 재시작 후 해결.
- CORS 해결 후 실제로 비밀번호 입력 → 로그인 → 세션 유지까지 브라우저에서 확인 완료. (참고로 `/api/auth/me`가 로그인 전 401 뜨는 건 정상 동작이라 헷갈리지 말 것 — 실제 확인 포인트는 `/api/auth/login` 성공 여부와 그 이후 세션 유지.)
- `ENVIRONMENT=production`을 Render에 미리 설정해뒀던 덕에 세션 쿠키가 `SameSite=None; Secure`로 정상 발급됨 — 이 값이 빠지면 `SameSite=Lax`가 되어 크로스 도메인(vercel.app ↔ onrender.com) 요청에 쿠키가 아예 안 실려서 로그인이 무한 실패한 것처럼 보이는 함정이 있음(`docs/PROJECT.md` Gotchas에 기록).

### 다음 할 일
실제 Google Maps Map ID 발급(현재 DEMO_MAP_ID) → `MapView.tsx` 기본값 교체 → Google Cloud 예산 알림 설정 → PC/안드로이드 실기기로 최종 접속 테스트(M6 완료 기준).
