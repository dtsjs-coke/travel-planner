# Neon (Postgres DB)

## 목적
백엔드(SQLModel + Alembic)가 관리하는 프로덕션 스키마(`trip`, `day`, `itinerary_item`)를 저장하는 실제 Postgres 데이터베이스. 로컬 개발은 SQLite를 그대로 쓰고, Neon은 배포(Render)에서만 쓰인다.

## 왜 Neon인가
- **진짜 장기 무료 Postgres** — Railway/Fly.io처럼 크레딧이 소진되면 유료 전환되는 방식이 아니라, 무료 플랜이 30일 만료 없이 계속 유지된다.
- 유휴 시 자동 슬립하지만 재개 시 지연이 1~수초 수준이고 데이터 손실이 없어서, 2인이 가끔 쓰는 저트래픽 여행 앱 규모에 적합.
- 카드 등록 없이 가입 가능.

## 등록 과정 (실제로 한 순서)
1. neon.tech 접속 → **GitHub 계정으로 가입** (이 프로젝트의 GitHub 계정과 통일).
2. "Create a project" → 이름 `travel-planner`, region은 **ap-southeast-1(싱가포르)** 선택(사용자 위치에서 지연 적은 곳).
3. 프로젝트 생성 화면에 **"Neon Auth" (Ready-to-use authentication)** 토글이 있는데, **off로 유지**했다. 이 프로젝트는 개별 계정 없이 공유 비밀번호(`SHARED_PASSCODE`) 하나로 인증하는 구조라, Neon Auth(Stack Auth 기반 사용자 인증 서비스)를 켜면 안 쓰는 사용자 스키마/API 키만 추가로 생겨서 불필요.
4. 프로젝트 생성 직후 Neon이 "코딩 에이전트에게 붙여넣을 셋업 프롬프트"(`npm i -g neon@latest`, `neon deploy`, `neon.ts` 설정 등)를 제안하는데 **이건 무시했다.** 이 흐름은 Neon 자체의 스키마-as-코드 도구(`neon deploy`)로 DB를 관리하는 프로젝트를 가정한 것인데, 이 프로젝트는 이미 Alembic으로 마이그레이션을 관리하고 있어서 그대로 따라 하면 스키마 관리 시스템이 두 개로 쪼개져 충돌한다.
5. 프로젝트 대시보드 → **Connect** → **Pooled connection** 토글을 켠 상태의 connection string 복사 (Render 같은 서버리스형 백엔드는 매 요청마다 새 연결을 여는 경우가 많아 커넥션 풀링이 필요).
6. 로컬에서 `DATABASE_URL` 환경변수를 그 connection string으로 1회 오버라이드해서 `alembic upgrade head` 실행 → 초기 스키마가 정상 적용되는지 검증 (로컬 `.env` 자체는 SQLite로 그대로 둠).

## 트러블슈팅
SQLAlchemy는 `postgresql://` 스킴을 보면 기본적으로 `psycopg2` 드라이버를 쓰려고 하는데, 이 프로젝트는 `requirements.txt`에 `psycopg2`가 아니라 **`psycopg` (v3)** 만 설치돼 있다. 그래서 `backend/app/db.py`에 `_normalize_database_url()` 함수를 추가해 `postgresql://` → `postgresql+psycopg://`로 강제 변환하도록 했고, Alembic도 같은 로직을 타도록 `backend/alembic/env.py`에서 그 함수를 재사용한다. (이 수정을 커밋하지 않고 배포했다가 Render에서 한 번 실패했던 사례는 [render.md](render.md) 참고.)

## 실제 연결값이 쓰이는 곳
Neon connection string 자체는 비밀값이라 이 문서나 `docs/PROJECT.md`에 기록하지 않는다. Render의 `DATABASE_URL` 환경변수에 등록되어 있으며, 값은 비밀번호 관리자에 보관 중.

## 현재 상태
프로젝트 `travel-planner` (region ap-southeast-1) 생성 완료, 초기 스키마 마이그레이션 적용 완료, Render 백엔드가 이 DB를 사용 중.
