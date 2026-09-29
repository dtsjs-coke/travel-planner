/** 백엔드 `TRANSLATE_LANGUAGES` 화이트리스트 미러(app/schemas.py). 코드 → 한글 이름 / TTS 언어 태그. */
export interface TranslateLanguage {
  code: string
  name: string
  tts: string
}

export const TRANSLATE_LANGUAGES: TranslateLanguage[] = [
  { code: 'ko', name: '한국어', tts: 'ko-KR' },
  { code: 'en', name: '영어', tts: 'en-US' },
  { code: 'ja', name: '일본어', tts: 'ja-JP' },
  { code: 'zh-CN', name: '중국어(간체)', tts: 'zh-CN' },
  { code: 'zh-TW', name: '중국어(번체)', tts: 'zh-TW' },
  { code: 'th', name: '태국어', tts: 'th-TH' },
  { code: 'vi', name: '베트남어', tts: 'vi-VN' },
  { code: 'id', name: '인도네시아어', tts: 'id-ID' },
  { code: 'fr', name: '프랑스어', tts: 'fr-FR' },
  { code: 'de', name: '독일어', tts: 'de-DE' },
  { code: 'es', name: '스페인어', tts: 'es-ES' },
  { code: 'it', name: '이탈리아어', tts: 'it-IT' },
  { code: 'pt', name: '포르투갈어', tts: 'pt-BR' },
  { code: 'ru', name: '러시아어', tts: 'ru-RU' },
]

export function languageName(code: string): string {
  return TRANSLATE_LANGUAGES.find((l) => l.code === code)?.name ?? code
}

export function ttsLang(code: string): string {
  return TRANSLATE_LANGUAGES.find((l) => l.code === code)?.tts ?? code
}
