import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import {
  adminRefreshRaw,
  fetchMe,
} from '@/services/admin-auth.service'
import { useAdminAuthStore } from '@/stores/admin-auth-store'

export function AdminSessionBootstrap({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    const run = async () => {
      const { accessToken, clearSession, setAccessToken, setUser } =
        useAdminAuthStore.getState()

      try {
        if (accessToken) {
          const me = await fetchMe()
          if (!cancelled) setUser(me)
        } else {
          try {
            const { accessToken: at } = await adminRefreshRaw()
            if (!cancelled) {
              setAccessToken(at)
              const me = await fetchMe()
              if (!cancelled) setUser(me)
            }
          } catch {
            /* no valid refresh cookie */
          }
        }
      } catch {
        if (!cancelled) clearSession()
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  if (!ready) {
    return (
      <div className="text-muted-foreground flex min-h-svh items-center justify-center text-sm">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}
