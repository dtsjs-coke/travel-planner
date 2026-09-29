import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CURRENCIES, crossRate, currencyLabel, fetchRates } from '../../lib/tools/exchangeRates'
import { formatDateTime } from '../../lib/tools/localCache'
import type { ToolsPrefill } from '../../hooks/useTripPrefill'

const ZERO_DECIMAL = new Set(['KRW', 'JPY', 'VND', 'IDR', 'LAK', 'KHR', 'HUF'])
const QUICK_AMOUNTS = [1000, 5000, 10000]
const TABLE_AMOUNTS = [1, 10, 100, 1000, 10000]

/** 입력 문자열을 숫자/소수점만 남기고 정수부에 천 단위 쉼표를 넣는다. */
function formatInput(raw: string): string {
  const cleaned = raw.replace(/[^0-9.]/g, '')
  const [intPart, ...rest] = cleaned.split('.')
  const grouped = intPart.replace(/^0+(?=\d)/, '').replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return rest.length > 0 ? `${grouped}.${rest.join('').slice(0, 4)}` : grouped
}

function parseAmount(formatted: string): number {
  const n = Number(formatted.replace(/,/g, ''))
  return Number.isFinite(n) ? n : 0
}

function formatResult(value: number, currency: string): string {
  const maxFraction = ZERO_DECIMAL.has(currency) ? 0 : Math.abs(value) < 1 ? 4 : 2
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: maxFraction }).format(value)
}

interface Props {
  prefill: ToolsPrefill | null
}

export default function CurrencyConverter({ prefill }: Props) {
  const [amount, setAmount] = useState('10,000')
  const [fromOverride, setFromOverride] = useState<string | null>(null)
  const [toOverride, setToOverride] = useState<string | null>(null)
  const [manualRate, setManualRate] = useState('')

  const from = fromOverride ?? prefill?.currency ?? 'JPY'
  const to = toOverride ?? 'KRW'

  const ratesQuery = useQuery({
    queryKey: ['tools', 'fx'],
    queryFn: fetchRates,
    staleTime: 30 * 60 * 1000,
    retry: 1,
  })
  const rates = ratesQuery.data?.rates

  const autoRate = rates ? crossRate(rates, from, to) : null
  const manual = Number(manualRate.replace(/,/g, ''))
  const useManual = autoRate === null && Number.isFinite(manual) && manual > 0
  const rate = autoRate ?? (useManual ? manual : null)

  const amountNum = parseAmount(amount)
  const result = rate !== null ? amountNum * rate : null

  const currencyOptions = CURRENCIES.filter((c) => !rates || c.code in rates || c.code === 'KRW')
  // 프리필/수동 선택이 목록 밖 코드여도 select에 보이도록 보장
  for (const code of [from, to]) {
    if (!currencyOptions.some((c) => c.code === code)) currencyOptions.push({ code, name: '' })
  }

  function swap() {
    setFromOverride(to)
    setToOverride(from)
  }

  return (
    <section aria-labelledby="fx-title" className="flex flex-col gap-4">
      <h2 id="fx-title" className="sr-only">
        환율 계산기
      </h2>

      <StatusBadge
        isLoading={ratesQuery.isLoading}
        isError={ratesQuery.isError}
        offline={ratesQuery.data?.offline ?? false}
        fetchedAt={ratesQuery.data?.fetchedAt ?? null}
        onRetry={() => ratesQuery.refetch()}
      />

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="flex flex-col gap-1 text-sm text-slate-600">
          금액
          <input
            value={amount}
            onChange={(e) => setAmount(formatInput(e.target.value))}
            inputMode="decimal"
            autoComplete="off"
            aria-label="환전할 금액"
            className="min-h-12 rounded-md border border-slate-300 px-3 text-right text-2xl font-semibold text-slate-800 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          />
        </label>

        <div className="mt-2 flex flex-wrap gap-2" aria-label="자주 쓰는 금액">
          {QUICK_AMOUNTS.map((q) => (
            <button
              key={q}
              type="button"
              onClick={() => setAmount(formatInput(String(q)))}
              className="min-h-11 rounded-full border border-slate-300 px-4 text-sm text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-500"
            >
              {q.toLocaleString('ko-KR')}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setAmount('')}
            className="min-h-11 rounded-full px-3 text-sm text-slate-400 hover:text-slate-600"
          >
            지우기
          </button>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_1fr] items-end gap-2">
          <CurrencySelect label="가진 통화" value={from} options={currencyOptions} onChange={setFromOverride} />
          <button
            type="button"
            onClick={swap}
            aria-label="통화 맞바꾸기"
            className="mb-0.5 min-h-11 min-w-11 rounded-full border border-slate-300 text-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-500"
          >
            ⇄
          </button>
          <CurrencySelect label="바꿀 통화" value={to} options={currencyOptions} onChange={setToOverride} />
        </div>

        {autoRate === null && (
          <label className="mt-3 flex flex-col gap-1 text-sm text-slate-600">
            환율을 불러오지 못했습니다. 직접 입력해서 계산하세요 (1 {from} = ? {to})
            <input
              value={manualRate}
              onChange={(e) => setManualRate(e.target.value.replace(/[^0-9.]/g, ''))}
              inputMode="decimal"
              className="min-h-11 rounded-md border border-slate-300 px-3 focus:border-slate-500 focus:outline-none"
            />
          </label>
        )}
      </div>

      <div
        className="rounded-xl bg-slate-800 p-4 text-white"
        aria-live="polite"
        aria-label="환산 결과"
      >
        <p className="text-sm text-slate-300">
          {formatResult(amountNum, from)} {from} =
        </p>
        <p className="mt-1 break-words text-3xl font-bold">
          {result !== null ? `${formatResult(result, to)} ${to}` : '—'}
        </p>
        {rate !== null && (
          <p className="mt-1 text-xs text-slate-400">
            1 {from} = {formatResult(rate, to)} {to}
            {useManual ? ' (직접 입력)' : ''}
          </p>
        )}
      </div>

      {rate !== null && (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <caption className="bg-slate-50 px-3 py-2 text-left text-xs text-slate-500">
              간단 환산표 ({from} → {to})
            </caption>
            <tbody>
              {TABLE_AMOUNTS.map((n) => (
                <tr key={n} className="border-t border-slate-100">
                  <th scope="row" className="px-3 py-2 text-left font-normal text-slate-600">
                    {n.toLocaleString('ko-KR')} {from}
                  </th>
                  <td className="px-3 py-2 text-right font-medium text-slate-800">
                    {formatResult(n * rate, to)} {to}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-slate-500">
        환율은 참고용이며 실제 환전·카드 결제 환율과 다릅니다(수수료 별도).{' '}
        <a
          href="https://www.exchangerate-api.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline"
        >
          Rates By Exchange Rate API
        </a>
      </p>
    </section>
  )
}

function StatusBadge(props: {
  isLoading: boolean
  isError: boolean
  offline: boolean
  fetchedAt: number | null
  onRetry: () => void
}) {
  if (props.isLoading) return <p className="text-sm text-slate-500">환율 불러오는 중...</p>
  if (props.fetchedAt !== null) {
    return (
      <p
        className={`w-fit rounded-full px-3 py-1 text-xs ${
          props.offline ? 'bg-amber-100 text-amber-800' : 'bg-emerald-50 text-emerald-700'
        }`}
      >
        마지막 갱신: {formatDateTime(props.fetchedAt)}
        {props.offline ? ' (오프라인)' : ''}
      </p>
    )
  }
  if (props.isError) {
    return (
      <p className="flex items-center gap-2 text-sm text-amber-700">
        환율 정보를 가져오지 못했습니다.
        <button type="button" onClick={props.onRetry} className="min-h-11 px-2 underline">
          다시 시도
        </button>
      </p>
    )
  }
  return null
}

function CurrencySelect(props: {
  label: string
  value: string
  options: Array<{ code: string; name: string }>
  onChange: (code: string) => void
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-xs text-slate-500">
      {props.label}
      <select
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        className="min-h-11 w-full min-w-0 rounded-md border border-slate-300 bg-white px-2 text-sm text-slate-800 focus:border-slate-500 focus:outline-none"
      >
        {props.options.map((c) => (
          <option key={c.code} value={c.code}>
            {currencyLabel(c.code)}
          </option>
        ))}
      </select>
    </label>
  )
}
