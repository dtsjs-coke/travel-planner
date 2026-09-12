from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    environment: str = "development"  # "development" | "production"
    database_url: str = "sqlite:///./dev.db"
    secret_key: str = "dev-secret"
    shared_passcode: str = "dev-passcode"
    google_places_server_key: str = ""
    cors_origins: str = "http://localhost:5173"

    # --- AI 여행 추천 (Gemini) -------------------------------------------------
    # 빈 문자열이면 AI 추천 엔드포인트만 503을 주고 나머지 앱은 정상 동작한다
    # (`google_places_server_key`와 같은 정책 — 키 하나가 없어서 앱 전체가 뜨지 않는 일은 없다).
    gemini_api_key: str = ""
    # 모델 이름을 env로 빼두는 이유: 더 싼 변형이나 다음 버전으로 갈아탈 때 **코드 변경 없이**
    # 바꿔야 하는 값이고, 모델이 은퇴하면 배포된 코드가 그대로 죽기 때문이다.
    # 실제로 겪었다(2026-09-13 실호출 확인): `gemini-2.5-flash`는
    #   404 "no longer available to new users ... use models/gemini-3.6-flash"
    # 를 돌려준다. 그래서 기본값이 처음부터 `gemini-3.6-flash`다(ADR-0009).
    gemini_model: str = "gemini-3.6-flash"
    # "thinking" 토큰 예산. **-1 = 요청에서 이 필드를 아예 빼서 모델 기본값에 맡긴다**(기본).
    # 0(사고 과정 완전 비활성)을 기본으로 두지 않는 이유: `gemini-3.6-flash`는 0을
    # 400 INVALID_ARGUMENT로 거부한다(512 같은 양수는 받는다 — 둘 다 실호출로 확인).
    # 즉 이 값은 "지연을 줄이려면 낮은 양수", "모델 기본값에 맡기려면 -1"로 쓴다.
    gemini_thinking_budget: int = -1

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
