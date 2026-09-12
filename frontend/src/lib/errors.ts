import axios from 'axios'
import { translateErrorDetail } from './errorMessages'

/** axios 에러의 FastAPI `detail`(문자열 또는 pydantic validation 배열)에서 사용자에게 보여줄
 * 메시지를 뽑아낸다. 알 수 없는 형태면 fallback을 돌려준다.
 *
 * 백엔드 `detail`은 API 계약 언어 일관성을 위해 영어로 통일돼 있다(ADR-0002). 뽑아낸 원문은
 * 먼저 `translateErrorDetail()`로 한국어 매핑을 조회하고, 매핑이 없으면(신규/미지의 문구)
 * 영어 원문을 그대로 반환한다 — 매핑 누락이 "에러가 아예 안 보임"이 되지 않게 하기 위함. */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === 'string') {
      const raw: string = detail[0].msg
      return translateErrorDetail(raw) ?? raw
    }
    if (typeof detail === 'string') {
      return translateErrorDetail(detail) ?? detail
    }
  }
  return fallback
}
