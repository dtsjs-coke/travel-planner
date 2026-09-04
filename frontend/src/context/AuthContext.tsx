import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { checkSession, login as apiLogin, logout as apiLogout } from '../api/auth'

interface AuthContextValue {
  status: 'checking' | 'authorized' | 'unauthorized'
  login: (passcode: string) => Promise<boolean>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<'checking' | 'authorized' | 'unauthorized'>('checking')

  useEffect(() => {
    checkSession().then((ok) => setStatus(ok ? 'authorized' : 'unauthorized'))
  }, [])

  async function login(passcode: string): Promise<boolean> {
    try {
      await apiLogin(passcode)
      setStatus('authorized')
      return true
    } catch {
      return false
    }
  }

  async function logout(): Promise<void> {
    await apiLogout()
    setStatus('unauthorized')
  }

  return <AuthContext.Provider value={{ status, login, logout }}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
