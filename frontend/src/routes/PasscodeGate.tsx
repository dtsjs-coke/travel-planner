import { useState, type FormEvent } from 'react'
import { useAuth } from '../context/AuthContext'

export default function PasscodeGate() {
  const { login } = useAuth()
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(false)
    const ok = await login(passcode)
    setSubmitting(false)
    if (!ok) setError(true)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-6">
      <form
        onSubmit={handleSubmit}
        className="flex w-full max-w-sm flex-col gap-4 rounded-xl bg-white p-6 shadow"
      >
        <h1 className="text-xl font-semibold text-slate-800">Travel Planner</h1>
        <p className="text-sm text-slate-500">공유 비밀번호를 입력해주세요.</p>
        <input
          type="password"
          value={passcode}
          onChange={(e) => setPasscode(e.target.value)}
          className="rounded-md border border-slate-300 px-3 py-2 focus:border-slate-500 focus:outline-none"
          placeholder="비밀번호"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">비밀번호가 올바르지 않습니다.</p>}
        <button
          type="submit"
          disabled={submitting || !passcode}
          className="rounded-md bg-slate-800 px-3 py-2 text-white disabled:opacity-50"
        >
          {submitting ? '확인 중...' : '입장하기'}
        </button>
      </form>
    </div>
  )
}
