import { Link, useSearchParams } from 'react-router-dom'
import { useTripPrefill } from '../hooks/useTripPrefill'
import CurrencyConverter from '../components/tools/CurrencyConverter'
import WeatherPanel from '../components/tools/WeatherPanel'
import WorldClock from '../components/tools/WorldClock'
import UnitConverter from '../components/tools/UnitConverter'
import PhraseCards from '../components/tools/PhraseCards'
import EmergencyInfo from '../components/tools/EmergencyInfo'
import AiTranslator from '../components/tools/AiTranslator'

const TABS = [
  { id: 'fx', label: '환율', icon: '💱' },
  { id: 'weather', label: '날씨', icon: '🌤️' },
  { id: 'time', label: '시차', icon: '🕒' },
  { id: 'units', label: '단위', icon: '📏' },
  { id: 'phrases', label: '회화', icon: '💬' },
  { id: 'emergency', label: '긴급', icon: '🚨' },
  { id: 'translate', label: 'AI 번역', icon: '🤖' },
] as const

type TabId = (typeof TABS)[number]['id']

function isTabId(value: string | null): value is TabId {
  return TABS.some((t) => t.id === value)
}

/** 여행 도구함. 탭은 `?tab=`, 여행 프리필은 `?trip=<id>`. 도구 1~6은 서버 없이 동작한다(외부 무료 API +
 * 정적 데이터, ADR-0014). AI 번역만 세션 + 설정 토글이 필요하다. */
export default function ToolsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const tabParam = searchParams.get('tab')
  const tab: TabId = isTabId(tabParam) ? tabParam : 'fx'

  const tripParam = searchParams.get('trip')
  const tripId = tripParam !== null && /^\d+$/.test(tripParam) ? Number(tripParam) : null
  const prefill = useTripPrefill(tripId)

  function selectTab(id: TabId) {
    const next = new URLSearchParams(searchParams)
    next.set('tab', id)
    setSearchParams(next) // push: 뒤로가기로 이전 탭 복귀
  }

  return (
    <div className="mx-auto min-h-screen max-w-2xl pb-10">
      <header className="px-4 pt-4">
        <Link
          to={tripId !== null ? `/trips/${tripId}` : '/trips'}
          className="inline-flex min-h-11 items-center text-sm text-slate-500 hover:underline"
        >
          &larr; {tripId !== null ? '여행으로' : '여행 목록'}
        </Link>
        <h1 className="text-2xl font-semibold text-slate-800">🧰 여행 도구함</h1>
        {prefill && (
          <p className="mt-1 text-sm text-slate-500">
            {prefill.tripName}
            {prefill.destination ? ` · ${prefill.destination}` : ''}에 맞춰 채워두었어요. 바꿔도 됩니다.
          </p>
        )}
      </header>

      <div className="sticky top-0 z-10 mt-3 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div role="tablist" aria-label="여행 도구" className="flex gap-1 overflow-x-auto px-3 py-2">
          {TABS.map((t) => {
            const selected = t.id === tab
            return (
              <button
                key={t.id}
                type="button"
                role="tab"
                id={`tab-${t.id}`}
                aria-selected={selected}
                aria-controls="tools-panel"
                onClick={() => selectTab(t.id)}
                className={`flex min-h-11 shrink-0 flex-col items-center justify-center rounded-lg px-3 text-xs focus-visible:outline-2 focus-visible:outline-slate-500 ${
                  selected ? 'bg-slate-800 text-white' : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <span className="text-lg leading-none" aria-hidden="true">
                  {t.icon}
                </span>
                {t.label}
              </button>
            )
          })}
        </div>
      </div>

      <div id="tools-panel" role="tabpanel" aria-labelledby={`tab-${tab}`} className="p-4">
        {tab === 'fx' && <CurrencyConverter prefill={prefill} />}
        {tab === 'weather' && <WeatherPanel prefill={prefill} />}
        {tab === 'time' && <WorldClock prefill={prefill} />}
        {tab === 'units' && <UnitConverter />}
        {tab === 'phrases' && <PhraseCards prefill={prefill} />}
        {tab === 'emergency' && <EmergencyInfo prefill={prefill} />}
        {tab === 'translate' && <AiTranslator prefill={prefill} />}
      </div>
    </div>
  )
}
