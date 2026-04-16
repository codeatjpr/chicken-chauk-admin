import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'
import type {
  OrderFunnel,
  PlatformMetrics,
  RevenueChartPoint,
  TopVendorRow,
} from '@/types/metrics'

function assertData<T>(data: ApiSuccess<T>, label: string): T {
  if (!data.success || data.data === undefined) {
    throw new Error(data.message ?? label)
  }
  return data.data
}

export async function getMetrics(params: {
  from?: string
  to?: string
  city?: string
}): Promise<PlatformMetrics> {
  const { data } = await axiosInstance.get<ApiSuccess<PlatformMetrics>>('/admin/metrics', {
    params,
  })
  return assertData(data, 'Failed to load metrics')
}

export async function getRevenueChart(params: {
  days: number
  city?: string
}): Promise<RevenueChartPoint[]> {
  const { data } = await axiosInstance.get<ApiSuccess<RevenueChartPoint[]>>(
    '/admin/revenue-chart',
    { params },
  )
  return assertData(data, 'Failed to load revenue chart')
}

export async function getTopVendors(params: {
  limit: number
  from?: string
  to?: string
}): Promise<TopVendorRow[]> {
  const { data } = await axiosInstance.get<ApiSuccess<TopVendorRow[]>>('/admin/top-vendors', {
    params,
  })
  return assertData(data, 'Failed to load top vendors')
}

export async function getOrderFunnel(params: {
  from?: string
  to?: string
}): Promise<OrderFunnel> {
  const { data } = await axiosInstance.get<ApiSuccess<OrderFunnel>>('/admin/order-funnel', {
    params,
  })
  return assertData(data, 'Failed to load funnel')
}
