import { useState, type FormEvent } from 'react'
import axios from 'axios'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { translate, type TranslateResult } from '../../api/aiTranslate'
import { getSettings } from '../../api/settings'
import { extractErrorMessage } from '../../lib/errors'
import { TRANSLATE_LANGUAGES, languageName, ttsLang } from '../../lib/tools/translateLanguages'
import { useSpeech } from '../../hooks/useSpeech'
import AppSettingsModal from '../AppSettingsModal'
import BigTextView from './BigTextView'
import type { ToolsPrefill } from '../../hooks/useTripPrefill'

const MAX_LENGTH = 500

interface Props {
  prefill: ToolsPrefill | null
}

export default function AiTranslator({ prefill }: Props) {
  const queryClient = useQueryClient()
  const [showSettings, setShowSettings] = useState(false)
  const settingsQuery = useQuery({ queryKey: ['settings'], queryFn: getSettings })

  const enabled = settingsQuery.data?.ai_translate_enabled

  return (
    <section aria-labelledby="ai-title" className="flex flex-col gap-4">
      <h2 id="ai-title" className="sr-only">
        AI 번역
      </h2>

      {settingsQuery.isLoading && <p className="text-sm text-slate-500">설정 확인 중...</p>}

      {settingsQuery.isError && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          설정을 불러오지 못했습니다. 서버에 연결할 수 없는 상태일 수 있습니다.
          <button type="button" onClick={() => settingsQuery.refetch()} className="ml-2 min-h-11 underline">
            다시 시도
          </button>
        </div>
      )}

      {enabled === false && (
        <div className="flex flex-col items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-base font-semibold text-slate-800">🤖 AI 번역은 꺼져 있습니다</p>
          <p className="text-sm text-slate-600">
            AI 번역은 호출할 때마다 비용이 드는 기능이라 기본으로 꺼져 있습니다. 설정에서 켤 수 있습니다.
          </p>
          <button
            type="button"
            onClick={() => setShowSettings(true)}
            className="min-h-11 rounded-md bg-slate-800 px-4 text-sm text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
          >
            ⚙️ 설정 열기
          </button>
          <p className="text-xs text-slate-500">
            단순한 인사·식당·교통 문구는 무료인 "회화" 탭을 먼저 확인해 보세요.
          </p>
        </div>
      )}

      {enabled === true && (
        <TranslateForm
          prefill={prefill}
          onForbidden={() => queryClient.invalidateQueries({ queryKey: ['settings'] })}
        />
      )}

      {showSettings && <AppSettingsModal onClose={() => setShowSettings(false)} />}
    </section>
  )
}

function TranslateForm({ prefill, onForbidden }: { prefill: ToolsPrefill | null; onForbidden: () => void }) {
  const [text, setText] = useState('')
  const [source, setSource] = useState('auto')
  const [targetOverride, setTargetOverride] = useState<string | null>(null)
  const [big, setBig] = useState(false)
  const [copied, setCopied] = useState(false)

  const target = targetOverride ?? prefill?.translateLang ?? 'en'

  const mutation = useMutation({
    mutationFn: () => translate({ text: text.trim(), source, target }),
    onError: (err) => {
      if (axios.isAxiosError(err) && err.response?.status === 403) onForbidden()
    },
  })

  const same = source !== 'auto' && source === target
  const canSubmit = text.trim().length > 0 && !same && !mutation.isPending

  // 자동 번역(입력 중 호출) 금지 — 번역 버튼(폼 제출)과 "다시 시도" 클릭에서만 호출한다.
  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (canSubmit) mutation.mutate()
  }

  function swapLanguages() {
    if (source === 'auto') return
    setSource(target)
    setTargetOverride(source)
  }

  async function copy(result: TranslateResult) {
    try {
      await navigator.clipboard.writeText(result.translated_text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // 클립보드 권한이 없으면 조용히 무시 — 텍스트는 화면에서 직접 선택할 수 있다.
    }
  }

  const result = mutation.data

  return (
    <>
      <form onSubmit={handleSubmit} className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
            원문 언어
            <select
              value={source}
              onChange={(e) => setSource(e.target.value)}
              className="min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
            >
              <option value="auto">자동 감지</option>
              {TRANSLATE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={swapLanguages}
            disabled={source === 'auto'}
            aria-label="언어 맞바꾸기"
            className="mb-0.5 min-h-11 min-w-11 rounded-full border border-slate-300 text-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-slate-500"
          >
            ⇄
          </button>
          <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
            번역할 언어
            <select
              value={target}
              onChange={(e) => setTargetOverride(e.target.value)}
              className="min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800"
            >
              {TRANSLATE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="flex flex-col gap-1 text-sm text-slate-600">
          번역할 내용
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={MAX_LENGTH}
            rows={4}
            placeholder="예: 실례합니다, 역이 어디예요?"
            className="rounded-md border border-slate-300 px-3 py-2 text-base text-slate-800 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          />
          <span className="text-right text-xs text-slate-400">
            {text.length} / {MAX_LENGTH}
          </span>
        </label>

        {same && <p className="text-xs text-amber-700">원문 언어와 번역할 언어가 같습니다.</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          className="min-h-12 rounded-md bg-indigo-600 text-base font-medium text-white hover:bg-indigo-500 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {mutation.isPending ? '번역 중... (최대 1분 걸릴 수 있어요)' : '🤖 번역'}
        </button>
        <p className="text-xs text-slate-500">
          버튼을 누를 때마다 Gemini API 요금이 발생합니다(하루 최대 200회). 입력만으로는 호출되지 않습니다.
        </p>
      </form>

      {mutation.isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {extractErrorMessage(mutation.error, '번역에 실패했습니다. 잠시 후 다시 시도해주세요.')}
          {axios.isAxiosError(mutation.error) && mutation.error.response?.status === 502 && (
            <button type="button" onClick={() => mutation.mutate()} className="ml-2 min-h-11 underline">
              다시 시도
            </button>
          )}
        </div>
      )}

      {result && !mutation.isPending && (
        <ResultCard
          result={result}
          copied={copied}
          onCopy={() => copy(result)}
          onBig={() => setBig(true)}
        />
      )}

      {big && result && (
        <BigResult result={result} onClose={() => setBig(false)} />
      )}
    </>
  )
}

function ResultCard(props: { result: TranslateResult; copied: boolean; onCopy: () => void; onBig: () => void }) {
  const { result } = props
  const speech = useSpeech(ttsLang(result.target))

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-4" aria-live="polite">
      {result.source === 'auto' && result.detected_source !== 'unknown' && (
        <p className="text-xs text-slate-500">감지된 언어: {languageName(result.detected_source)}</p>
      )}
      <p lang={result.target} className="text-2xl font-semibold break-words whitespace-pre-wrap text-slate-900">
        {result.translated_text}
      </p>
      {result.pronunciation_ko && <p className="text-base text-indigo-700">{result.pronunciation_ko}</p>}
      {result.romanization && <p className="text-sm text-slate-600">{result.romanization}</p>}
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={props.onCopy}
          className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          {props.copied ? '✅ 복사됨' : '📋 복사'}
        </button>
        {speech.supported && (
          <button
            type="button"
            disabled={!speech.available}
            onClick={() => speech.play(result.translated_text)}
            className="min-h-11 flex-1 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-slate-500"
          >
            🔊 듣기
          </button>
        )}
        <button
          type="button"
          onClick={props.onBig}
          className="min-h-11 flex-1 rounded-md bg-slate-800 px-3 text-sm text-white hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-800"
        >
          🔍 크게 보기
        </button>
      </div>
      {speech.supported && !speech.available && (
        <p className="text-xs text-amber-700">이 기기에 해당 언어 음성이 없습니다.</p>
      )}
    </div>
  )
}

function BigResult({ result, onClose }: { result: TranslateResult; onClose: () => void }) {
  const speech = useSpeech(ttsLang(result.target))
  return (
    <BigTextView
      text={result.translated_text}
      pronunciation={result.pronunciation_ko ?? result.romanization}
      lang={result.target}
      onClose={onClose}
      onPlay={speech.supported && speech.available ? () => speech.play(result.translated_text) : null}
    />
  )
}
