import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export type AdminUserRow = {
  id: string
  name: string | null
  phone: string
  email: string | null
  role: string
  isActive: boolean
  isVerified: boolean
  createdAt: string
}

export type UserListResult = {
  items: AdminUserRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listAdminUsers(params: {
  page?: number
  limit?: number
  role?: string
  search?: string
}): Promise<UserListResult> {
  const { data } = await axiosInstance.get<ApiSuccess<UserListResult>>('/admin/users', { params })
  return assertData(data, 'Failed to load users')
}

export async function suspendUser(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<null>>(`/admin/users/${id}/suspend`)
  if (!data.success) throw new Error(data.message ?? 'Suspend failed')
}

export async function reinstateUser(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<null>>(`/admin/users/${id}/reinstate`)
  if (!data.success) throw new Error(data.message ?? 'Reinstate failed')
}
