import { useEffect } from 'react'

interface Props {
  text: string
  pronunciation?: string | null
  /** 문장의 한국어 뜻(작게). 현지인에게 보여줄 때는 없어도 된다. */
  caption?: string | null
  onClose: () => void
  /** TTS 재생. 없으면 버튼을 숨긴다. */
  onPlay?: (() => void) | null
  lang?: string
}

/** 현지인에게 화면을 보여주기 위한 전체화면 큰 글씨 뷰. ESC/닫기 버튼으로 닫는다. */
export default function BigTextView({ text, pronunciation, caption, onClose, onPlay, lang }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="크게 보기"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      <div className="flex items-center justify-between p-4">
        {onPlay ? (
          <button
            type="button"
            onClick={onPlay}
            className="min-h-11 rounded-full border border-white/40 px-4 text-sm hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
          >
            🔊 듣기
          </button>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={onClose}
          autoFocus
          aria-label="닫기"
          className="min-h-11 min-w-11 rounded-full border border-white/40 px-4 text-lg hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-white"
        >
          ✕
        </button>
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-6 overflow-y-auto px-6 pb-10 text-center">
        <p lang={lang} className="text-4xl font-bold leading-snug break-words sm:text-6xl">
          {text}
        </p>
        {pronunciation && <p className="text-xl text-white/70 sm:text-2xl">{pronunciation}</p>}
        {caption && <p className="text-base text-white/50">{caption}</p>}
      </div>
    </div>
  )
}
