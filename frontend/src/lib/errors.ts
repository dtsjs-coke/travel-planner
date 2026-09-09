import axios from 'axios'

/** axios 에러의 FastAPI `detail`(문자열 또는 pydantic validation 배열)에서 사용자에게 보여줄
 * 메시지를 뽑아낸다. 알 수 없는 형태면 fallback을 돌려준다. */
export function extractErrorMessage(err: unknown, fallback: string): string {
  if (axios.isAxiosError(err)) {
    const detail = err.response?.data?.detail
    if (Array.isArray(detail) && detail.length > 0 && typeof detail[0]?.msg === 'string') {
      return detail[0].msg
    }
    if (typeof detail === 'string') {
      return detail
    }
  }
  return fallback
}
