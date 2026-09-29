import { apiClient } from './client'

export interface TranslateInput {
  text: string
  /** 'auto' 또는 언어 코드. */
  source: string
  target: string
}

export interface TranslateResult {
  translated_text: string
  pronunciation_ko: string | null
  romanization: string | null
  source: string
  /** 언어 코드 또는 "unknown". */
  detected_source: string
  target: string
}

/**
 * AI 번역(`POST /api/ai/translate`, ADR-0014). 호출마다 Gemini 비용이 발생하는 유료 기능이라
 * 반드시 버튼 클릭에서만 호출한다(입력 중 자동 호출/디바운스 금지). 응답은 최대 30초 + Render
 * 콜드 스타트까지 걸릴 수 있어 넉넉한 타임아웃(90초)을 둔다.
 */
export async function translate(input: TranslateInput): Promise<TranslateResult> {
  const { data } = await apiClient.post<TranslateResult>('/api/ai/translate', input, {
    timeout: 90_000,
  })
  return data
}
