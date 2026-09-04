# Travel Planner

여자친구와 함께 쓰는 여행 일정 계획 웹앱. 날짜/시간별 일정을 구글 검색 또는 직접 입력으로 등록하고, 등록 순서대로 구글맵에 표시한다.

프로젝트 배경, 아키텍처 결정, 환경변수, 배포 체크리스트, 마일스톤 진행 상황은 [`docs/PROJECT.md`](docs/PROJECT.md) 참고.

## 로컬 실행

### Backend (FastAPI)

```
cd backend
../venv312/Scripts/python.exe -m pip install -r requirements.txt   # 최초 1회
cp .env.example .env
../venv312/Scripts/python.exe -m uvicorn app.main:app --reload --port 8000
```

### Frontend (React + Vite)

```
cd frontend
npm install   # 최초 1회
cp .env.example .env
npm run dev
```

기본적으로 프론트엔드는 `http://localhost:5173`, 백엔드는 `http://localhost:8000`에서 실행된다.
