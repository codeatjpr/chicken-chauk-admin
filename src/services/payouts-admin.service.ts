import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export type PayoutAdminRow = {
  id: string
  vendorId: string
  amount: number
  status: string
  periodStart: string
  periodEnd: string
  transactionRef: string | null
  settledAt: string | null
  createdAt: string
  vendor: {
    id: string
    name: string
    phone: string
    bankDetails: unknown
  }
}

export type PayoutListResult = {
  items: PayoutAdminRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export type PayoutPreview = {
  vendor: { id: string; name: string; city: string }
  period: { start: string; end: string }
  deliveredOrdersInPeriod: number
  grossRevenue: number
  platformCommission: number
  payoutAmount: number
  duplicatePayout: {
    id: string
    status: string
    amount: number
    createdAt: string
  } | null
}

export async function getPayoutPreview(params: {
  vendorId: string
  from: string
  to: string
}): Promise<PayoutPreview> {
  const { data } = await axiosInstance.get<ApiSuccess<PayoutPreview>>('/admin/payouts/preview', { params })
  return assertData(data, 'Failed to load preview')
}

export async function listPayouts(params: {
  page?: number
  limit?: number
  status?: string
  vendorId?: string
  from?: string
  to?: string
}): Promise<PayoutListResult> {
  const { data } = await axiosInstance.get<ApiSuccess<PayoutListResult>>('/admin/payouts', { params })
  return assertData(data, 'Failed to load payouts')
}

export async function listPendingPayouts(page = 1, limit = 20): Promise<PayoutListResult> {
  const { data } = await axiosInstance.get<ApiSuccess<PayoutListResult>>('/admin/payouts/pending', {
    params: { page, limit },
  })
  return assertData(data, 'Failed to load pending payouts')
}

export async function processPayout(body: {
  vendorId: string
  periodStart: string
  periodEnd: string
  transactionRef?: string
}): Promise<unknown> {
  const { data } = await axiosInstance.post<ApiSuccess<unknown>>('/admin/payouts', body)
  return assertData(data, 'Failed to create payout')
}

export async function updatePayoutStatus(
  id: string,
  body: { status: string; transactionRef?: string },
): Promise<unknown> {
  const { data } = await axiosInstance.patch<ApiSuccess<unknown>>(`/admin/payouts/${id}/status`, body)
  return assertData(data, 'Failed to update payout')
}
