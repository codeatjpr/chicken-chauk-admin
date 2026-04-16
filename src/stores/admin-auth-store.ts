import { create } from 'zustand'
import type { AdminUser } from '@/types/admin-user'

type AdminAuthState = {
  accessToken: string | null
  user: AdminUser | null
  setAccessToken: (token: string | null) => void
  setUser: (user: AdminUser | null) => void
  setSession: (accessToken: string, user: AdminUser) => void
  clearSession: () => void
}

export const useAdminAuthStore = create<AdminAuthState>((set) => ({
  accessToken: null,
  user: null,
  setAccessToken: (accessToken) => set({ accessToken }),
  setUser: (user) => set({ user }),
  setSession: (accessToken, user) => set({ accessToken, user }),
  clearSession: () => set({ accessToken: null, user: null }),
}))
