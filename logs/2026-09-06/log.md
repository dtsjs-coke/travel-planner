## M6 — 배포 (진행 중, 이어서)

- (오케스트레이터 세션에서 진행 — `orchestrator_pjt`) `backend/app/db.py`, `backend/alembic/env.py`의 `_normalize_database_url` 수정 사항을 실제 Neon Postgres에 대해 검증: Neon 프로젝트(`travel-planner`, region ap-southeast-1) 생성, Connection string(pooled) 발급 — Neon Auth는 off로 유지(공유 비밀번호 방식이라 불필요).
- 로컬 `.env`는 SQLite로 유지한 채, `DATABASE_URL` 환경변수를 임시로 Neon URL로 오버라이드해서 `alembic upgrade head` 1회 실행 → `b9eafc6696db` (initial schema: trip, day, itinerary_item) 정상 적용 확인. `postgresql://` → `postgresql+psycopg://` 강제 변환 로직이 실제 배포 조건에서 정상 동작함을 확인.
- Neon connection string은 비밀값이라 문서/로그에 기록하지 않음 — 다음 단계(Render 백엔드 env 변수 설정)에서 다시 사용 예정.

### 다음 할 일
Render 웹 서비스 생성 및 backend env 변수 설정(DATABASE_URL=Neon URL, SECRET_KEY, SHARED_PASSCODE, GOOGLE_PLACES_SERVER_KEY, CORS_ORIGINS) → Vercel 프론트 배포 → 실제 Map ID 발급 → Google Cloud 예산 알림 설정 → 크로스 도메인 CORS/쿠키 최종 확인.
