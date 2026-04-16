import axios, { type InternalAxiosRequestConfig } from 'axios'
import { axiosInstance } from '@/lib/axiosInstance'
import { adminRefreshRaw } from '@/services/admin-auth.service'
import { useAdminAuthStore } from '@/stores/admin-auth-store'

const PUBLIC_AUTH_PREFIXES = [
  'auth/admin/login',
  'auth/admin/refresh',
  'auth/admin/forgot-password',
  'auth/admin/reset-password',
]

function isPublicAdminAuthRequest(url: string | undefined): boolean {
  if (!url) return false
  const path = url.replace(/^\//, '')
  return PUBLIC_AUTH_PREFIXES.some((p) => path === p || path.startsWith(`${p}?`))
}

let refreshing = false
const waitQueue: Array<{
  resolve: (token: string) => void
  reject: (err: unknown) => void
}> = []

axiosInstance.interceptors.request.use((config) => {
  const token = useAdminAuthStore.getState().accessToken
  if (token && !isPublicAdminAuthRequest(config.url)) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

axiosInstance.interceptors.response.use(
  (res) => res,
  async (error: unknown) => {
    if (!axios.isAxiosError(error) || !error.config) {
      return Promise.reject(error)
    }

    const original = error.config as InternalAxiosRequestConfig
    const status = error.response?.status

    if (status !== 401 || original._authRetry) {
      return Promise.reject(error)
    }

    if (isPublicAdminAuthRequest(original.url)) {
      return Promise.reject(error)
    }

    if (refreshing) {
      return new Promise((resolve, reject) => {
        waitQueue.push({
          resolve: (accessToken: string) => {
            original.headers.Authorization = `Bearer ${accessToken}`
            resolve(axiosInstance(original))
          },
          reject,
        })
      })
    }

    original._authRetry = true
    refreshing = true

    try {
      const { accessToken } = await adminRefreshRaw()
      useAdminAuthStore.getState().setAccessToken(accessToken)

      waitQueue.forEach((p) => p.resolve(accessToken))
      waitQueue.length = 0

      original.headers.Authorization = `Bearer ${accessToken}`
      return axiosInstance(original)
    } catch (e) {
      waitQueue.forEach((p) => p.reject(e))
      waitQueue.length = 0
      useAdminAuthStore.getState().clearSession()
      return Promise.reject(e)
    } finally {
      refreshing = false
    }
  },
)
