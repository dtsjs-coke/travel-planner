import { useState } from 'react'
import { COUNTRIES, findCountry } from '../../lib/tools/countries'
import type { ToolsPrefill } from '../../hooks/useTripPrefill'

interface Props {
  prefill: ToolsPrefill | null
}

function CallButton({ label, number }: { label: string; number: string }) {
  return (
    <a
      href={`tel:${number.replace(/[^0-9+]/g, '')}`}
      aria-label={`${label} ${number} 전화 걸기`}
      className="flex min-h-14 flex-1 flex-col items-center justify-center rounded-xl border border-red-200 bg-red-50 px-2 py-2 text-red-700 hover:bg-red-100 focus-visible:outline-2 focus-visible:outline-red-600"
    >
      <span className="text-xs">{label}</span>
      <span className="text-xl font-bold">{number}</span>
    </a>
  )
}

export default function EmergencyInfo({ prefill }: Props) {
  const [override, setOverride] = useState<string | null>(null)
  const code = override ?? prefill?.countryCode ?? COUNTRIES[0].code
  const country = findCountry(code) ?? COUNTRIES[0]

  return (
    <section aria-labelledby="emg-title" className="flex flex-col gap-4">
      <h2 id="emg-title" className="sr-only">
        국가별 긴급정보
      </h2>

      <a
        href="tel:+82232100404"
        className="flex min-h-14 items-center justify-between gap-3 rounded-xl bg-red-600 px-4 py-3 text-white hover:bg-red-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-600"
      >
        <span>
          <span className="block text-sm font-medium">외교부 영사콜센터 (24시간)</span>
          <span className="block text-xs text-red-100">사건·사고, 여권 분실 등 해외 긴급 상황</span>
        </span>
        <span className="text-lg font-bold">📞 +82-2-3210-0404</span>
      </a>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        국가
        <select
          value={country.code}
          onChange={(e) => setOverride(e.target.value)}
          className="min-h-11 rounded-md border border-slate-300 bg-white px-2 text-slate-800 focus:border-slate-500 focus:outline-none"
        >
          {COUNTRIES.map((c) => (
            <option key={c.code} value={c.code}>
              {c.flag} {c.name}
            </option>
          ))}
        </select>
      </label>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <h3 className="mb-3 text-base font-semibold text-slate-800">
          {country.flag} {country.name} 긴급 전화 <span className="text-xs font-normal text-slate-500">(현지 번호)</span>
        </h3>
        <div className="flex gap-2">
          <CallButton label="경찰" number={country.emergency.police} />
          <CallButton label="구급" number={country.emergency.ambulance} />
          <CallButton label="소방" number={country.emergency.fire} />
        </div>
        {country.emergency.note && <p className="mt-2 text-xs text-slate-500">{country.emergency.note}</p>}
      </div>

      <dl className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <div>
          <dt className="text-xs font-medium text-slate-500">🔌 전압 · 주파수 · 플러그</dt>
          <dd className="mt-0.5 text-slate-800">
            {country.power.voltage} / {country.power.frequency} / 플러그 타입 {country.power.plugs}
          </dd>
          {country.power.note && <dd className="mt-0.5 text-xs text-slate-500">{country.power.note}</dd>}
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">💵 팁 문화</dt>
          <dd className="mt-0.5 text-slate-800">{country.tipping}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500">💡 한 줄 팁</dt>
          <dd className="mt-0.5 text-slate-800">{country.tip}</dd>
        </div>
      </dl>

      <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
        작성 시점 기준 정보입니다. 출발 전{' '}
        <a href="https://www.0404.go.kr" target="_blank" rel="noopener noreferrer" className="underline">
          0404.go.kr (외교부 해외안전여행)
        </a>
        에서 최신 정보를 확인하세요.
      </p>
    </section>
  )
}
