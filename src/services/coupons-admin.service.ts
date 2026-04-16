import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'
import type { PaginatedResult } from '@/types/pagination'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export type CouponRow = {
  id: string
  code: string
  title: string
  description: string | null
  discountType: string
  discountValue: number
  maxDiscountAmount: number | null
  minOrderValue: number
  usageLimitTotal: number | null
  usageLimitPerUser: number
  usedCount: number
  applicableFor: string
  vendorId: string | null
  isActive: boolean
  expiresAt: string | null
  createdAt: string
  vendor?: { id: string; name: string } | null
}

export async function listCoupons(params: {
  page?: number
  limit?: number
  isActive?: boolean
}): Promise<PaginatedResult<CouponRow>> {
  const query: Record<string, string | number> = {}
  if (params.page != null) query.page = params.page
  if (params.limit != null) query.limit = params.limit
  if (params.isActive !== undefined) query.isActive = params.isActive ? 'true' : 'false'
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<CouponRow>>>(
    '/wallet/admin/coupons',
    { params: query },
  )
  return assertData(data, 'Failed to load coupons')
}

export async function getCoupon(id: string): Promise<CouponRow> {
  const { data } = await axiosInstance.get<ApiSuccess<CouponRow>>(`/wallet/admin/coupons/${id}`)
  return assertData(data, 'Failed to load coupon')
}

export async function createCoupon(body: Record<string, unknown>): Promise<CouponRow> {
  const { data } = await axiosInstance.post<ApiSuccess<CouponRow>>('/wallet/admin/coupons', body)
  return assertData(data, 'Failed to create coupon')
}

export async function updateCoupon(id: string, body: Record<string, unknown>): Promise<CouponRow> {
  const { data } = await axiosInstance.put<ApiSuccess<CouponRow>>(`/wallet/admin/coupons/${id}`, body)
  return assertData(data, 'Failed to update coupon')
}

export async function deactivateCoupon(id: string): Promise<void> {
  const { data } = await axiosInstance.delete<ApiSuccess<null>>(`/wallet/admin/coupons/${id}`)
  if (!data.success) throw new Error(data.message ?? 'Deactivate failed')
}
