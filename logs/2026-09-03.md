# 2026-09-03

## 진행한 작업

### M0 — 프로젝트 스캐폴딩
- git 저장소 초기화 (`main` 브랜치)
- `venv312` 가상환경 생성 (Python 3.12.10)
- `backend/`: FastAPI 스켈레톤, `/api/health` 라우트, CORS 미들웨어, `requirements.txt`, `.env.example`
- `frontend/`: Vite + React + TypeScript 스캐폴딩, Tailwind CSS v4, React Query, dnd-kit, react-router-dom, axios, @vis.gl/react-google-maps 설치
- `docs/PROJECT.md`, 루트 `README.md` 작성
- 로컬에서 백엔드(8000)/프론트엔드(5173→5174) 동시 실행 및 헬스체크 연동 확인

### M1 — DB 모델 + 공유 비밀번호 인증
- SQLModel 모델 작성: `Trip`, `Day`, `ItineraryItem` (day/itinerary_item은 CASCADE 외래키)
- Alembic 초기화 및 초기 마이그레이션 생성·적용 (로컬 SQLite `dev.db`)
- 공유 비밀번호 로그인: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me` — JWT 서명 쿠키 세션, 환경별(dev/prod) 쿠키 속성 자동 전환
- `require_session` 의존성으로 보호되는 `/api/trips` CRUD (생성/목록/조회/수정/삭제) 구현 및 curl로 전체 검증

## 발생한 이슈와 해결

- **`WinError 10013` (uvicorn 포트 8000 바인딩 실패)**: 원인은 Windows 포트 예약이 아니라, 이전 테스트에서 죽지 않고 남아있던 orphan uvicorn 프로세스가 포트를 점유하고 있었음. 프로세스 종료로 해결.
- **프론트엔드 "Backend status: error"**: 프론트엔드가 5173이 아니라 5174에서 떠 있었는데(5173이 이전 테스트 프로세스에 점유됨), 백엔드 `CORS_ORIGINS`가 5173만 허용하고 있어 브라우저가 요청을 막음. `CORS_ORIGINS`에 5174 추가 + 백엔드 재시작으로 해결.
- **Alembic autogenerate 마이그레이션에서 `NameError: name 'sqlmodel' is not defined`**: SQLModel 타입(`AutoString` 등)을 쓰는데 생성된 마이그레이션 파일에 `import sqlmodel`이 빠짐. `alembic/script.py.mako` 템플릿에 `import sqlmodel` 추가하여 향후 마이그레이션에도 자동 반영되도록 수정.
- **`ModuleNotFoundError: No module named 'jose'` / `uvicorn`이 엉뚱한 가상환경으로 실행됨**: 이 PC의 전역 PATH에 다른 도구(`hermes-agent`)의 venv가 등록되어 있어서, `venv312`를 activate해도 bare `uvicorn` 명령이 그쪽 Python(3.11)으로 실행되는 문제. `venv312\Scripts\python.exe -m uvicorn ...` 절대경로 실행으로 우회.
- **`ModuleNotFoundError: No module named 'app'`**: `backend/` 디렉토리가 아닌 상위 폴더에서 uvicorn을 실행해서 발생. `backend/`로 이동 후 재실행하여 해결.

## 사용자 확인/조치 필요

- [ ] (아직 없음 — Google Cloud API 키 발급은 M4에서 진행 예정)

## 다음 할 일

M2: `Day`/`ItineraryItem` CRUD + reorder API, 프론트엔드 기본 화면(PasscodeGate, TripListPage, DayEditorPage) 연결.
