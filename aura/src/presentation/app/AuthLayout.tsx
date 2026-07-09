import { Outlet } from 'react-router-dom'
import { AuthProvider } from '@/presentation/auth/AuthProvider'

/**
 * Layout das rotas autenticadas (login, cadastro e app). Fica num chunk lazy
 * separado — assim o Supabase e o container não pesam no bundle da landing.
 */
export default function AuthLayout() {
  return (
    <AuthProvider>
      <Outlet />
    </AuthProvider>
  )
}
