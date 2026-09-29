import { useCallback, useEffect, useState } from 'react'
import { hasVoiceFor, isSpeechSupported, loadVoices, speak, stopSpeaking } from '../lib/tools/speech'

/** 지정 언어(TTS 태그)로 읽어주는 훅. 언마운트/언어 변경 시 재생을 멈춘다. */
export function useSpeech(lang: string) {
  const supported = isSpeechSupported()
  // 음성 목록을 확인한 언어. lang과 다르면 아직 확인 중이라 "있다"고 가정한다.
  const [checked, setChecked] = useState<{ lang: string; available: boolean } | null>(null)
  const [speaking, setSpeaking] = useState(false)

  useEffect(() => {
    if (!supported) return
    let cancelled = false
    loadVoices().then((voices) => {
      if (!cancelled) setChecked({ lang, available: hasVoiceFor(voices, lang) })
    })
    return () => {
      cancelled = true
      stopSpeaking()
    }
  }, [lang, supported])

  const play = useCallback(
    (text: string) => {
      setSpeaking(true)
      speak(text, lang, () => setSpeaking(false))
    },
    [lang],
  )

  const available = checked?.lang === lang ? checked.available : true
  return { supported, available, speaking, play }
}
