import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import PasscodeGate from './routes/PasscodeGate'
import TripListPage from './routes/TripListPage'
import DayEditorPage from './routes/DayEditorPage'

const queryClient = new QueryClient()

function AuthedRoutes() {
  const { status } = useAuth()

  if (status === 'checking') {
    return <p className="p-6 text-slate-500">불러오는 중...</p>
  }

  if (status === 'unauthorized') {
    return <PasscodeGate />
  }

  return (
    <Routes>
      <Route path="/trips" element={<TripListPage />} />
      <Route path="/trips/:tripId" element={<DayEditorPage />} />
      <Route path="*" element={<Navigate to="/trips" replace />} />
    </Routes>
  )
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <AuthedRoutes />
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  )
}

export default App
