import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAdminAuthStore } from '@/stores/admin-auth-store'

export function RequireAdmin({ children }: { children: ReactNode }) {
  const accessToken = useAdminAuthStore((s) => s.accessToken)
  const user = useAdminAuthStore((s) => s.user)
  const location = useLocation()

  if (!accessToken || user?.role !== 'ADMIN') {
    return (
      <Navigate
        to="/admin/login"
        replace
        state={{ from: location.pathname }}
      />
    )
  }

  return <>{children}</>
}
