import axios from 'axios'
import { axiosInstance } from '@/lib/axiosInstance'
import { getApiRoot } from '@/lib/api-url'
import type { ApiSuccess } from '@/types/api'
import type { AdminUser } from '@/types/admin-user'

export type AdminLoginResult = {
  accessToken: string
  expiresIn: string
  user: AdminUser
}

export async function adminLogin(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<AdminLoginResult> {
  const { data } = await axiosInstance.post<ApiSuccess<AdminLoginResult>>(
    '/auth/admin/login',
    { email, password, rememberMe },
  )
  if (!data.success || !data.data?.accessToken || !data.data.user) {
    throw new Error(data.message ?? 'Sign in failed')
  }
  return data.data
}

/** Cookie-based refresh; does not use the axios instance (avoids interceptor loops). */
export async function adminRefreshRaw(): Promise<{ accessToken: string }> {
  const root = getApiRoot()
  const { data } = await axios.post<ApiSuccess<{ accessToken: string }>>(
    `${root}/auth/admin/refresh`,
    {},
    {
      withCredentials: true,
      headers: { 'Content-Type': 'application/json' },
      timeout: 30_000,
    },
  )
  if (!data.success || !data.data?.accessToken) {
    throw new Error(data.message ?? 'Session expired')
  }
  return data.data
}

export async function fetchMe(): Promise<AdminUser> {
  const { data } = await axiosInstance.get<ApiSuccess<AdminUser>>('/auth/me')
  if (!data.success || !data.data) {
    throw new Error(data.message ?? 'Not authenticated')
  }
  return data.data
}

export async function adminLogout(): Promise<void> {
  await axiosInstance.post('/auth/admin/logout')
}

export async function adminForgotPassword(email: string): Promise<void> {
  const { data } = await axiosInstance.post<ApiSuccess<null>>(
    '/auth/admin/forgot-password',
    { email },
  )
  if (!data.success) {
    throw new Error(data.message ?? 'Request failed')
  }
}

export async function adminResetPassword(token: string, password: string): Promise<void> {
  const { data } = await axiosInstance.post<ApiSuccess<null>>(
    '/auth/admin/reset-password',
    { token, password },
  )
  if (!data.success) {
    throw new Error(data.message ?? 'Reset failed')
  }
}
