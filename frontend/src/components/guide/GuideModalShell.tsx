import { useEffect, type ReactNode } from 'react'

interface Props {
  title: string
  /** 배경 클릭/Esc/✕ 모두 이 콜백을 탄다(닫기 전 확인이 필요하면 호출부에서 처리). */
  onRequestClose: () => void
  children: ReactNode
  /** 기본 max-w-lg. 표 같은 넓은 내용은 넓게. */
  widthClass?: string
}

/** 가이드 페이지 모달 공통 껍데기. 기존 `ItineraryItemDetailModal`과 같은 오버레이 스타일. */
export default function GuideModalShell({ title, onRequestClose, children, widthClass = 'max-w-lg' }: Props) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onRequestClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [onRequestClose])

  return (
    <div
      className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-black/40 p-4 sm:items-center"
      onClick={onRequestClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`flex max-h-[85vh] w-full ${widthClass} flex-col overflow-y-auto rounded-xl bg-white p-5 shadow-xl`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-2">
          <h2 className="text-lg font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onRequestClose}
            aria-label="닫기"
            className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-slate-400 hover:text-slate-600"
          >
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
