import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getSettlement } from '../api/settlement'
import { getSettings } from '../api/settings'
import type { Participant } from '../types/models'

interface Props {
  tripId: number
}

/** 여행 카드 안에 펼쳐지는 정산(더치페이) 섹션. `TripChecklist`와 같은 패턴 —
 * 접혀 있으면 `enabled: isOpen`으로 API를 호출하지 않는다. */
export default function TripSettlement({ tripId }: Props) {
  const [isOpen, setIsOpen] = useState(false)

  const { data, isLoading, isError } = useQuery({
    queryKey: ['trips', tripId, 'settlement'],
    queryFn: () => getSettlement(tripId),
    enabled: isOpen,
  })

  // 참가자 표시 이름은 정산 응답에 실린 이름보다 `['settings']` 캐시를 우선한다. 이름을
  // 바꾼 뒤 이 정산 쿼리를 따로 무효화하지 않아도(오케스트레이터 지시: 무효화는 `['settings']`만)
  // 이미 열려 있던 정산 패널에 새 이름이 바로 반영된다 — 응답의 이름은 이 쿼리가 아직
  // settings를 못 받았을 때의 폴백일 뿐이다.
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: getSettings, enabled: isOpen })

  function displayName(participant: Participant): string {
    return settings?.participants.find((p) => p.key === participant.key)?.name ?? participant.name
  }

  function formatAmount(amount: number, currency: string): string {
    return `${amount.toLocaleString()}${currency}`
  }

  const mixedCurrencyItemCount =
    data?.excluded_currencies.reduce((sum, bucket) => sum + bucket.item_count, 0) ?? 0

  return (
    <div className="mt-3 border-t border-slate-100 pt-3">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="text-sm font-medium text-slate-600 hover:text-slate-800"
      >
        {data ? `정산 · 총 ${formatAmount(data.total, data.currency)}` : '정산 보기'}
        <span className="ml-1 text-slate-400">{isOpen ? '▲' : '▼'}</span>
      </button>

      {isOpen && (
        <div className="mt-2 text-sm">
          {isLoading && <p className="text-slate-400">불러오는 중...</p>}
          {isError && <p className="text-red-600">정산 정보를 불러오지 못했습니다.</p>}

          {data && (
            <div className="flex flex-col gap-2">
              <ul className="flex flex-col gap-0.5">
                {data.per_person.map((row) => (
                  <li key={row.participant.key} className="flex items-center justify-between text-slate-700">
                    <span>{displayName(row.participant)}</span>
                    <span className="text-slate-500">
                      {formatAmount(row.paid, data.currency)} · {row.item_count}건
                    </span>
                  </li>
                ))}
              </ul>

              {data.transfer ? (
                <p className="font-medium text-slate-800">
                  {displayName(data.transfer.from_participant)}이(가) {displayName(data.transfer.to_participant)}
                  에게 {formatAmount(data.transfer.amount, data.currency)}을(를) 보내면 됩니다.
                </p>
              ) : (
                <p className="text-slate-500">정산할 것이 없습니다.</p>
              )}

              {data.unassigned_item_count > 0 && (
                <p className="text-xs text-amber-600">
                  결제자 미지정 지출 {data.unassigned_item_count}건(
                  {formatAmount(data.unassigned_amount, data.currency)})은 정산에서 제외됐습니다.
                </p>
              )}

              {data.has_mixed_currency && (
                <p className="text-xs text-amber-600">
                  다른 통화 지출 {mixedCurrencyItemCount}건은 환율 변환 없이 합산되지 않았습니다.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
