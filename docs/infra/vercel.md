# Vercel (프론트엔드 호스팅)

## 목적
React(Vite) 프론트엔드를 정적 사이트로 빌드해서 인터넷에 호스팅. 사용자와 여자친구분이 실제로 접속하는 화면이 여기서 서빙된다.

## 왜 Vercel인가
- 무료 티어로 Vite 빌드 결과물을 정적 호스팅. Render 백엔드와 달리 **콜드스타트(슬립) 개념이 없어서** 프론트는 항상 즉시 로딩된다.
- GitHub 저장소 연동 시 push할 때마다 자동 재배포.
- 도메인 구매 없이 기본 제공되는 `*.vercel.app` 서브도메인으로 충분 (이 앱 규모에서 커스텀 도메인은 불필요).

## 등록 과정 (실제로 한 순서)
1. vercel.com 접속 → GitHub 계정으로 로그인.
2. "Add New" → "Project" → 저장소 목록에서 `travel-planner`가 안 보이면 **"Install"**을 눌러 Vercel GitHub App을 계정에 설치해야 함 (Render 때와 같은 이유 — private 저장소는 명시적 접근 권한 필요). GitHub 권한 화면에서 "Only select repositories" → `travel-planner` 선택 → Install & Authorize.
3. Import 화면에서:
   - Root Directory: `frontend`
   - Framework Preset: Vite (자동 감지됨)
4. Environment Variables:
   - `VITE_API_BASE_URL` = Render 백엔드 URL (`https://travel-planner-q6si.onrender.com`)
   - `VITE_GOOGLE_MAPS_BROWSER_KEY` = 로컬 `frontend/.env`와 동일 값
5. Deploy.

## 배포 후 해야 했던 후속 작업 (실제로 겪은 것)
- **Deployment Protection**: 기본 켜져있어서 방문자가 사이트 접속 시 Vercel 계정 로그인을 강제로 요구받았음(이 앱은 공유 비밀번호 방식이라 방문자가 Vercel 계정을 가질 필요가 없음). Settings → Deployment Protection → off로 변경해서 해결.
- **CORS**: 발급된 프로덕션 도메인(`https://travel-planner-dtsjs.vercel.app`, 배포해도 안 바뀌는 고정 도메인 — git-브랜치용/1회성 스냅샷용 도메인과 헷갈리지 말 것)을 **Render의 `CORS_ORIGINS` 환경변수**에 추가해서 해결. 끝에 슬래시(`/`) 붙이면 안 됨.
- Google Maps 브라우저 키의 HTTP 리퍼러 허용 목록에도 같은 도메인을 등록해야 함 — 이전에 이 프로젝트에서 와일드카드 패턴(`localhost:*/*` 등)이 기대대로 안 먹혔던 경험이 있으므로(`docs/PROJECT.md`의 Gotchas 참고), 와일드카드 대신 **정확한 전체 URL**(`https://travel-planner-dtsjs.vercel.app/*`)로 등록할 것.
- 크로스 도메인 쿠키 인증: Render에 `ENVIRONMENT=production`이 설정돼 있어야 세션 쿠키가 `SameSite=None; Secure`로 발급됨 — 안 그러면 `SameSite=Lax`가 되어 크로스 도메인 요청에 쿠키가 아예 안 실려서 로그인이 무한 실패한 것처럼 보임(`docs/PROJECT.md` Gotchas 참고).

## 현재 상태
Live. `https://travel-planner-dtsjs.vercel.app` — Deployment Protection off, CORS 연동 완료, 실제 로그인/세션 유지 브라우저 확인 완료.
