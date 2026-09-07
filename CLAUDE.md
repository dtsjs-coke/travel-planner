# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 항상 먼저 읽을 것 (필수)

1. **`docs/PROJECT.md`** — 현재 상태/마일스톤, 아키텍처 결정, 환경변수 목록, 무료 티어 주의사항, 배포 URL. 작업 시작 전 반드시 확인.
2. **`logs/MASTER_LOG.md`** — 지금까지의 작업 이력 요약 인덱스. 최근에 뭘 했는지 빠르게 파악하는 용도.
3. 이 파일(`CLAUDE.md`) 자체 — 아래 "사용자 지시사항" 섹션.

## 필요할 때만 읽을 것 (경로 참고)

- 전체 아키텍처/데이터 모델/API 설계/마일스톤 원본 계획: `C:\Users\user\.claude\plans\pjt-dapper-snowglobe.md`
- 특정 날짜에 무엇을 했는지 상세 내역: `logs/<YYYY-MM-DD>.md` (30일 넘은 로그는 `logs/archive/<YYYY-MM-DD>.md`로 이동돼있을 수 있음)
- 백엔드 코드 구조: `backend/app/` (models.py, auth.py, db.py, config.py, routers/)
- 프론트엔드 코드 구조: `frontend/src/`

## 사용자 지시사항 (필수 준수)

- **Python 실행은 반드시 `venv312`를 통해서** — 이 PC의 전역 PATH에 다른 에이전트 도구용 가상환경(`hermes-agent`)이 먼저 잡혀 있어서, bare `uvicorn`/`python` 명령이 잘못된 환경으로 실행될 수 있음. 항상 아래처럼 절대경로로 실행할 것:
  ```
  C:\Users\user\python\travel_pjt\venv312\Scripts\python.exe -m uvicorn app.main:app --reload --port 8000
  ```
  (반드시 `backend/` 디렉토리 안에서 실행 — `app` 패키지가 거기 있음)
- **git commit은 사용자가 명시적으로 요청할 때만.** 먼저 커밋하지 말 것.
- **작업할 때마다 로그를 남길 것**: 그날 로그 파일(`logs/<YYYY-MM-DD>.md`)에 진행 내용을 기록하고, `logs/MASTER_LOG.md`에 한 줄 요약을 추가. `docs/PROJECT.md`의 "Status / Current Milestone"과 "Milestone Log"도 함께 갱신.
- **매 턴 마무리에 "내가 한 일" vs "사용자가 확인/조치해야 할 일"을 명확히 구분해서 알려줄 것.** 대화창은 스크롤되어 지나가므로, 확인이 필요한 항목은 로그 파일에도 남겨서 나중에 대화 없이도 찾아볼 수 있게 할 것.

## 로그 시스템 사용법

- 새 작업일마다 `logs/<YYYY-MM-DD>.md` 파일을 직접 만든다 (폴더 없이 평면 파일 — 예: `logs/2026-09-07.md`). 같은 날 여러 세션이면 그 날짜 파일에 이어서 추가.
- 파일 구성: 진행한 작업 목록, 발생한 이슈와 해결 방법, **사용자 확인/조치 필요 항목** 섹션(체크박스).
- `logs/MASTER_LOG.md`에는 날짜별 1~2줄 요약과 해당 로그 파일 링크만 남긴다 (상세 내용 중복 금지).
- **아카이브**: 오늘 날짜 기준 **30일 넘은 로그 파일**은 `logs/archive/<YYYY-MM-DD>.md`로 이동한다 (파일명 유지, `logs/archive/` 폴더는 없으면 새로 생성). `MASTER_LOG.md`의 해당 링크도 `archive/<YYYY-MM-DD>.md`로 갱신할 것. 오래된 세션마다 매번 확인할 필요는 없고, 작업 중 우연히 눈에 띄거나 사용자가 요청할 때 정리하면 됨.
