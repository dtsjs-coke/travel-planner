import { useState } from 'react'
import {
  PHRASE_CATEGORIES,
  PHRASE_LANGUAGES,
  getPhrases,
  type Phrase,
  type PhraseCategory,
} from '../../lib/tools/phrases'
import { useSpeech } from '../../hooks/useSpeech'
import BigTextView from './BigTextView'
import type { ToolsPrefill } from '../../hooks/useTripPrefill'

interface Props {
  prefill: ToolsPrefill | null
}

export default function PhraseCards({ prefill }: Props) {
  const [langOverride, setLangOverride] = useState<string | null>(null)
  const [category, setCategory] = useState<PhraseCategory>('greet')
  const [big, setBig] = useState<Phrase | null>(null)

  const langCode = langOverride ?? prefill?.phraseLang ?? 'en'
  const language = PHRASE_LANGUAGES.find((l) => l.code === langCode) ?? PHRASE_LANGUAGES[0]
  const phrases = getPhrases(language.code, category)
  const speech = useSpeech(language.tts)

  return (
    <section aria-labelledby="phrase-title" className="flex flex-col gap-4">
      <h2 id="phrase-title" className="sr-only">
        여행 회화 카드
      </h2>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="언어">
        {PHRASE_LANGUAGES.map((l) => (
          <button
            key={l.code}
            type="button"
            aria-pressed={l.code === language.code}
            onClick={() => setLangOverride(l.code)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm focus-visible:outline-2 focus-visible:outline-slate-500 ${
              l.code === language.code
                ? 'border-indigo-600 bg-indigo-600 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {l.name}
          </button>
        ))}
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1" role="group" aria-label="카테고리">
        {PHRASE_CATEGORIES.map((c) => (
          <button
            key={c.id}
            type="button"
            aria-pressed={c.id === category}
            onClick={() => setCategory(c.id)}
            className={`min-h-11 shrink-0 rounded-full border px-4 text-sm focus-visible:outline-2 focus-visible:outline-slate-500 ${
              c.id === category
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            <span aria-hidden="true">{c.icon}</span> {c.label}
          </button>
        ))}
      </div>

      {language.note && <p className="text-xs text-slate-500">{language.note}</p>}
      {speech.supported && !speech.available && (
        <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800">
          이 기기에 해당 언어 음성이 없습니다. 발음 표기나 "크게 보기"를 이용하세요.
        </p>
      )}

      <ul className="flex flex-col gap-3">
        {phrases.map((p) => (
          <li key={p.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs text-slate-500">{p.ko}</p>
            <p lang={language.code} className="mt-1 text-xl font-semibold break-words text-slate-800">
              {p.text}
            </p>
            <p className="mt-1 text-sm text-indigo-700">{p.pronunciation}</p>
            <div className="mt-3 flex gap-2">
              {speech.supported && (
                <button
                  type="button"
                  disabled={!speech.available}
                  onClick={() => speech.play(p.text)}
                  aria-label={`${p.ko} 발음 듣기`}
                  className="min-h-11 flex-1 rounded-md border border-slate-300 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-slate-500"
                >
                  🔊 듣기
                </button>
              )}
              <button
                type="button"
                onClick={() => setBig(p)}
                aria-label={`${p.ko} 크게 보기`}
                className="min-h-11 flex-1 rounded-md bg-slate-800 text-sm text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
              >
                🔍 크게 보기
              </button>
            </div>
          </li>
        ))}
      </ul>

      {big && (
        <BigTextView
          text={big.text}
          pronunciation={big.pronunciation}
          caption={big.ko}
          lang={language.code}
          onClose={() => setBig(null)}
          onPlay={speech.supported && speech.available ? () => speech.play(big.text) : null}
        />
      )}

      <p className="text-xs text-slate-500">
        발음은 한글 근사 표기라 실제 억양·성조와 다를 수 있습니다. 상대에게 화면을 보여줄 때는 "크게 보기"를 쓰세요.
      </p>
    </section>
  )
}
