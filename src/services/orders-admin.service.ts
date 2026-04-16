import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'
import type { PaginatedResult } from '@/types/pagination'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export type AdminOrderListItem = {
  id: string
  userId: string
  vendorId: string
  status: string
  finalAmount: number
  paymentStatus: string
  paymentMethod: string
  createdAt: string
  vendor: { id: string; name: string; logoUrl: string | null }
  delivery: { status: string } | null
  _count: { items: number }
}

export const ADMIN_ORDER_TRANSITIONS: Record<string, string[]> = {
  PLACED: ['CONFIRMED', 'CANCELLED'],
  CONFIRMED: ['PREPARING', 'CANCELLED'],
  PREPARING: ['READY', 'CANCELLED'],
  READY: ['PICKED_UP', 'CANCELLED'],
  DELIVERED: ['REFUNDED'],
  CANCELLED: ['REFUNDED'],
}

export async function listAdminOrders(params: {
  page?: number
  limit?: number
  status?: string
  vendorId?: string
  userId?: string
  from?: string
  to?: string
}): Promise<PaginatedResult<AdminOrderListItem>> {
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<AdminOrderListItem>>>(
    '/orders/admin',
    { params },
  )
  return assertData(data, 'Failed to load orders')
}

export async function getAdminOrderDetail(id: string): Promise<unknown> {
  const { data } = await axiosInstance.get<ApiSuccess<unknown>>(`/orders/admin/${id}`)
  return assertData(data, 'Failed to load order')
}

export async function updateAdminOrderStatus(
  id: string,
  body: { status: string; note?: string },
): Promise<unknown> {
  const { data } = await axiosInstance.patch<ApiSuccess<unknown>>(`/orders/admin/${id}/status`, body)
  return assertData(data, 'Failed to update status')
}
