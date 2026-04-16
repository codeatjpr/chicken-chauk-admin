import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'
import type { PaginatedResult } from '@/types/pagination'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export type PaymentAdminRow = {
  id: string
  orderId: string
  amount: number
  status: string
  method: string
  gatewayPaymentId: string | null
  transactionId: string | null
  createdAt: string
  order: {
    id: string
    finalAmount: number
    status: string
    user: { id: string; phone: string; name: string | null }
  }
}

export type PaymentAdminSummary = {
  byStatus: Record<string, { amount: number; count: number }>
  period: { from: string | null; to: string | null }
}

export async function getPaymentsSummary(params: { from?: string; to?: string }): Promise<PaymentAdminSummary> {
  const { data } = await axiosInstance.get<ApiSuccess<PaymentAdminSummary>>('/payments/admin/summary', {
    params,
  })
  return assertData(data, 'Failed to load payment summary')
}

export async function listPaymentsAdmin(params: {
  page?: number
  limit?: number
  status?: string
  method?: string
  from?: string
  to?: string
  search?: string
}): Promise<PaginatedResult<PaymentAdminRow>> {
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<PaymentAdminRow>>>(
    '/payments/admin',
    { params },
  )
  return assertData(data, 'Failed to load payments')
}

export async function initiateRefund(body: {
  orderId: string
  amount?: number
  reason: string
}): Promise<void> {
  const { data } = await axiosInstance.post<ApiSuccess<null>>('/payments/refund', body)
  if (!data.success) throw new Error(data.message ?? 'Refund failed')
}
