import { useEffect, useState } from 'react'

const DESKTOP_QUERY = '(min-width: 768px)' // Tailwind md 브레이크포인트와 동일하게 유지

export function useIsDesktop(): boolean {
  const [isDesktop, setIsDesktop] = useState(() => window.matchMedia(DESKTOP_QUERY).matches)

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)
    const handleChange = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    mql.addEventListener('change', handleChange)
    return () => mql.removeEventListener('change', handleChange)
  }, [])

  return isDesktop
}
