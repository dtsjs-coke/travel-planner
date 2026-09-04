import { apiClient } from './client'

export async function login(passcode: string): Promise<void> {
  await apiClient.post('/api/auth/login', { passcode })
}

export async function logout(): Promise<void> {
  await apiClient.post('/api/auth/logout')
}

export async function checkSession(): Promise<boolean> {
  try {
    await apiClient.get('/api/auth/me')
    return true
  } catch {
    return false
  }
}
