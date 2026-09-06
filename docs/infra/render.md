# Render (백엔드 호스팅)

## 목적
FastAPI 백엔드(API 서버)를 인터넷에 상시 접근 가능하게 호스팅. 프론트엔드(Vercel)와 사용자의 브라우저가 이 서버를 통해 데이터를 읽고 쓴다.

## 왜 Render인가
- 무료 웹 서비스 티어 제공, GitHub 저장소 연동 자동 배포(push하면 자동 재배포).
- 트레이드오프: **15분 무활동 시 슬립**, 재기동에 30~50초 소요(첫 요청만 느림). 필요하면 무료 uptime pinger로 완화 가능(M7에서 검토 예정) — 카드 등록 없이 쓸 수 있는 무료 백엔드 호스팅 중 이 정도 트레이드오프가 2인용 앱에는 충분히 감수할 만하다고 판단.

## 등록 과정 (실제로 한 순서)
1. render.com 접속 → GitHub 계정으로 로그인.
2. "New +" → "Web Service" → 저장소 선택 화면에서 `travel-planner`가 안 보이면 **"Install"**을 눌러 Render의 GitHub App을 계정에 설치해야 함 (private 저장소라 명시적으로 접근 권한을 줘야 목록에 뜬다). GitHub 쪽 권한 화면에서 "Only select repositories" → `dtsjs-coke/travel-planner` 체크 → Install.
3. 저장소 연결 후 설정값 입력:
   - Root Directory: `backend`
   - Runtime: Python 3
   - Build Command: `pip install -r requirements.txt`
   - Start Command: `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - Instance Type: Free
4. Environment Variables 등록 (Key/Value를 하나씩 입력하는 방식, `.env` 파일 통째로 업로드하는 게 아님):
   - `ENVIRONMENT=production`
   - `DATABASE_URL` = Neon pooled connection string ([neon.md](neon.md) 참고)
   - `SECRET_KEY` = 랜덤 생성값 (세션 쿠키 서명용, 사용자가 직접 보거나 입력할 일 없는 서버 전용 비밀값)
   - `SHARED_PASSCODE` = 사용자와 여자친구분이 앱 로그인 화면에서 실제로 타이핑해서 쓰는 공유 비밀번호
   - `GOOGLE_PLACES_SERVER_KEY` = 로컬 `backend/.env`와 동일 값
   - `CORS_ORIGINS`는 Vercel 프론트 도메인이 나온 뒤 추가 예정

## 트러블슈팅 (실제로 겪은 것)
- **첫 배포 실패 — `ModuleNotFoundError: No module named 'psycopg2'`**: `db.py`/`alembic/env.py`의 psycopg 드라이버 강제 변환 수정([neon.md](neon.md) 참고)이 로컬에서만 검증되고 **git commit이 안 된 상태**로 배포되어, Render가 받아간 옛날 커밋에는 그 수정이 없었음. 로컬 Alembic 검증 때는 환경변수를 직접 오버라이드해서 실행했기 때문에 "커밋 안 된 로컬 수정"이라는 걸 놓치기 쉬웠다. → 교훈: **로컬에서 동작 확인됨 ≠ 배포 준비 완료.** 커밋·push까지 끝나야 실제 배포에 반영된다.
- 수정 커밋(`9b48ee7`) + push 후 자동 재배포 → 성공.
- **"Canceled" 상태 혼동**: Deploys 탭에 오래된 배포 시도가 "Canceled"로 남아있어서, 그게 최신 상태인 줄 착각했다. → Render는 배포 도중 새 배포가 또 트리거되면 이전 걸 자동 취소하므로, **항상 목록 맨 위(최신) 항목**의 상태를 봐야 한다.
- **배포 직후 502/503처럼 보였던 현상**: 실제로는 두 가지가 겹친 것 — (a) 상태를 조회하는 데 쓴 도구(WebFetch)의 캐시가 과거의 실패 응답을 그대로 들고 있었던 것, (b) Render 프록시가 백엔드에 연결되기 전 자체적으로 보여주는 인터스티셜(502) 페이지. 캐시를 우회해서 다시 조회하니 `/api/health`가 정상적으로 `{"status":"ok"}` 200을 반환했다.

## 현재 상태
Live. `https://travel-planner-q6si.onrender.com`, `/api/health` 200 확인 완료.
