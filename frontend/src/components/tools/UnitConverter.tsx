import { useState } from 'react'
import {
  CLOTHES_MEN,
  CLOTHES_WOMEN,
  SHOES_MEN,
  SHOES_WOMEN,
  UNIT_PAIRS,
  formatNumber,
  type LinearPair,
} from '../../lib/tools/units'

type Mode = string // UNIT_PAIRS id | 'shoes' | 'clothes'

const MODES: Array<{ id: Mode; label: string }> = [
  ...UNIT_PAIRS.map((p) => ({ id: p.id, label: p.label })),
  { id: 'shoes', label: '신발' },
  { id: 'clothes', label: '옷' },
]

export default function UnitConverter() {
  const [mode, setMode] = useState<Mode>('temp')

  return (
    <section aria-labelledby="unit-title" className="flex flex-col gap-4">
      <h2 id="unit-title" className="sr-only">
        단위 · 사이즈 변환
      </h2>

      <div className="flex flex-wrap gap-2" role="group" aria-label="변환 종류">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={mode === m.id}
            onClick={() => setMode(m.id)}
            className={`min-h-11 rounded-full border px-4 text-sm focus-visible:outline-2 focus-visible:outline-slate-500 ${
              mode === m.id
                ? 'border-slate-800 bg-slate-800 text-white'
                : 'border-slate-300 text-slate-600 hover:bg-slate-100'
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      {mode === 'shoes' && <ShoeSizes />}
      {mode === 'clothes' && <ClothesSizes />}
      {UNIT_PAIRS.map((p) => (mode === p.id ? <PairConverter key={p.id} pair={p} /> : null))}
    </section>
  )
}

function PairConverter({ pair }: { pair: LinearPair }) {
  // 마지막으로 편집한 쪽의 원문을 저장하고 반대쪽은 계산해서 보여준다.
  const [edited, setEdited] = useState<{ side: 'a' | 'b'; text: string }>({ side: 'a', text: '' })

  const value = Number(edited.text.replace(/,/g, ''))
  const valid = edited.text.trim() !== '' && edited.text !== '-' && Number.isFinite(value)

  const aText = edited.side === 'a' ? edited.text : valid ? formatNumber(pair.bToA(value)) : ''
  const bText = edited.side === 'b' ? edited.text : valid ? formatNumber(pair.aToB(value)) : ''

  function onChange(side: 'a' | 'b', text: string) {
    // 온도는 음수를 허용한다.
    const allowNegative = pair.id === 'temp'
    const cleaned = text.replace(allowNegative ? /[^0-9.-]/g : /[^0-9.]/g, '')
    setEdited({ side, text: cleaned })
  }

  function swapSides() {
    // 좌우 표시를 바꾸는 대신, 현재 계산된 반대쪽 값을 기준으로 삼는다.
    setEdited((cur) => ({ side: cur.side === 'a' ? 'b' : 'a', text: cur.side === 'a' ? bText : aText }))
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4">
      <UnitField label={`${pair.a.label} (${pair.a.unit})`} value={aText} onChange={(t) => onChange('a', t)} allowNegative={pair.id === 'temp'} />
      <div className="flex justify-center">
        <button
          type="button"
          onClick={swapSides}
          aria-label="위아래 값 맞바꾸기"
          className="min-h-11 min-w-11 rounded-full border border-slate-300 text-lg text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-slate-500"
        >
          ⇅
        </button>
      </div>
      <UnitField label={`${pair.b.label} (${pair.b.unit})`} value={bText} onChange={(t) => onChange('b', t)} allowNegative={pair.id === 'temp'} />
    </div>
  )
}

function UnitField(props: { label: string; value: string; onChange: (text: string) => void; allowNegative: boolean }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-slate-600">
      {props.label}
      <input
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        inputMode={props.allowNegative ? 'text' : 'decimal'}
        autoComplete="off"
        className="min-h-12 rounded-md border border-slate-300 px-3 text-right text-2xl font-semibold text-slate-800 focus:border-slate-500 focus:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
      />
    </label>
  )
}

function ShoeSizes() {
  const [gender, setGender] = useState<'men' | 'women'>('men')
  const [kr, setKr] = useState<number | null>(null)
  const rows = gender === 'men' ? SHOES_MEN : SHOES_WOMEN
  const selectedKr = kr !== null && rows.some((r) => r.kr === kr) ? kr : null
  const selected = rows.find((r) => r.kr === selectedKr)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="성별">
        {(['men', 'women'] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={gender === g}
            onClick={() => setGender(g)}
            className={`min-h-11 flex-1 rounded-md border text-sm ${
              gender === g ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
            }`}
          >
            {g === 'men' ? '남성' : '여성'}
          </button>
        ))}
      </div>

      <label className="flex flex-col gap-1 text-sm text-slate-600">
        내 발 사이즈 (한국 mm)
        <select
          value={selectedKr ?? ''}
          onChange={(e) => setKr(e.target.value ? Number(e.target.value) : null)}
          className="min-h-11 rounded-md border border-slate-300 bg-white px-2 text-slate-800"
        >
          <option value="">선택...</option>
          {rows.map((r) => (
            <option key={r.kr} value={r.kr}>
              {r.kr} mm
            </option>
          ))}
        </select>
      </label>

      {selected && (
        <div className="rounded-xl bg-slate-800 p-4 text-white" aria-live="polite">
          <p className="text-sm text-slate-300">{selected.kr} mm</p>
          <p className="mt-1 text-2xl font-bold">
            US {selected.us} · UK {selected.uk} · EU {selected.eu}
          </p>
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-center text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">한국(mm)</th>
              <th className="px-2 py-2 font-medium">US</th>
              <th className="px-2 py-2 font-medium">UK</th>
              <th className="px-2 py-2 font-medium">EU</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kr} className={`border-t border-slate-100 ${r.kr === selectedKr ? 'bg-indigo-50 font-semibold' : ''}`}>
                <td className="px-2 py-2">{r.kr}</td>
                <td className="px-2 py-2">{r.us}</td>
                <td className="px-2 py-2">{r.uk}</td>
                <td className="px-2 py-2">{r.eu}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">브랜드마다 차이가 있는 근사 표입니다. 가능하면 직접 신어보세요.</p>
    </div>
  )
}

function ClothesSizes() {
  const [gender, setGender] = useState<'men' | 'women'>('men')
  const rows = gender === 'men' ? CLOTHES_MEN : CLOTHES_WOMEN

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-2" role="group" aria-label="성별">
        {(['men', 'women'] as const).map((g) => (
          <button
            key={g}
            type="button"
            aria-pressed={gender === g}
            onClick={() => setGender(g)}
            className={`min-h-11 flex-1 rounded-md border text-sm ${
              gender === g ? 'border-slate-800 bg-slate-800 text-white' : 'border-slate-300 text-slate-600'
            }`}
          >
            {g === 'men' ? '남성 상의' : '여성 상의'}
          </button>
        ))}
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-center text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="px-2 py-2 font-medium">한국 호칭</th>
              <th className="px-2 py-2 font-medium">US / EU (알파벳)</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.kr} className="border-t border-slate-100">
                <td className="px-2 py-3">{r.kr}</td>
                <td className="px-2 py-3 font-semibold">{r.alpha}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500">
        브랜드·핏에 따라 한 치수 정도 차이가 흔한 참고용 표입니다. 가능하면 입어보고 고르세요.
      </p>
    </div>
  )
}
