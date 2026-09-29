/** speechSynthesis 래퍼. 미지원 브라우저에서는 `isSpeechSupported()`가 false. */

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window
}

/** `getVoices()`는 브라우저에 따라 비동기로 채워지므로 `voiceschanged`를 잠깐 기다린다. */
export function loadVoices(timeoutMs = 1500): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!isSpeechSupported()) return resolve([])
    const synth = window.speechSynthesis
    const now = synth.getVoices()
    if (now.length > 0) return resolve(now)

    let done = false
    let timer: ReturnType<typeof setTimeout> | undefined
    const finish = () => {
      if (done) return
      done = true
      if (timer !== undefined) clearTimeout(timer)
      synth.removeEventListener('voiceschanged', finish)
      resolve(synth.getVoices())
    }
    synth.addEventListener('voiceschanged', finish)
    timer = setTimeout(finish, timeoutMs)
  })
}

function baseLang(tag: string): string {
  return tag.toLowerCase().split(/[-_]/)[0]
}

/** 해당 언어 음성이 있는지. 음성 목록 자체가 비어 있으면(일부 모바일 브라우저) "알 수 없음"이라
 * 재생을 시도할 수 있게 true로 본다. */
export function hasVoiceFor(voices: SpeechSynthesisVoice[], lang: string): boolean {
  if (voices.length === 0) return true
  const base = baseLang(lang)
  return voices.some((v) => baseLang(v.lang) === base)
}

function pickVoice(voices: SpeechSynthesisVoice[], lang: string): SpeechSynthesisVoice | undefined {
  const exact = voices.find((v) => v.lang.replace('_', '-').toLowerCase() === lang.toLowerCase())
  return exact ?? voices.find((v) => baseLang(v.lang) === baseLang(lang))
}

export function speak(text: string, lang: string, onEnd?: () => void): void {
  if (!isSpeechSupported()) return
  const synth = window.speechSynthesis
  synth.cancel()
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = lang
  const voice = pickVoice(synth.getVoices(), lang)
  if (voice) utterance.voice = voice
  utterance.rate = 0.9
  if (onEnd) {
    utterance.onend = onEnd
    utterance.onerror = onEnd
  }
  synth.speak(utterance)
}

export function stopSpeaking(): void {
  if (isSpeechSupported()) window.speechSynthesis.cancel()
}
