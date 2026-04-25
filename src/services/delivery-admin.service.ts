import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export type RiderAdminRow = {
  id: string
  userId: string
  vehicleType: string
  vehicleNumber: string | null
  licenseNumber: string | null
  isOnline: boolean
  isVerified: boolean
  isActive: boolean
  currentLatitude: number | null
  currentLongitude: number | null
  rating: number
  totalDeliveries: number
  totalEarnings: number
  maxConcurrentDeliveries: number
  createdAt: string
  user: { name: string | null; phone: string }
}

export type RidersListResult = {
  items: RiderAdminRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function listRiders(params: {
  page?: number
  limit?: number
  isOnline?: boolean
  isVerified?: boolean
}): Promise<RidersListResult> {
  const q: Record<string, string | number | boolean> = {}
  if (params.page != null) q.page = params.page
  if (params.limit != null) q.limit = params.limit
  if (params.isOnline !== undefined) q.isOnline = params.isOnline
  if (params.isVerified !== undefined) q.isVerified = params.isVerified
  const { data } = await axiosInstance.get<ApiSuccess<RidersListResult>>('/delivery/riders', { params: q })
  return assertData(data, 'Failed to load riders')
}

export type RiderDeliveryRow = {
  id: string
  orderId: string
  riderId: string
  status: string
  assignedAt: string
  reachedVendorAt: string | null
  pickedUpAt: string | null
  deliveredAt: string | null
  riderEarnings: number | null
  order: {
    id: string
    finalAmount: number
    createdAt: string
    vendor: { name: string }
  }
}

export type RiderDeliveriesResult = {
  items: RiderDeliveryRow[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export async function getRiderDeliveriesAdmin(
  riderId: string,
  page = 1,
  limit = 20,
): Promise<RiderDeliveriesResult> {
  const { data } = await axiosInstance.get<ApiSuccess<RiderDeliveriesResult>>(
    `/delivery/admin/riders/${riderId}/deliveries`,
    { params: { page, limit } },
  )
  return assertData(data, 'Failed to load deliveries')
}

export type RiderStats = {
  totalDeliveries: number
  totalEarnings: number
  rating: number
  todayDeliveries: number
  todayEarnings: number
}

export async function getRiderStatsAdmin(riderId: string): Promise<RiderStats> {
  const { data } = await axiosInstance.get<ApiSuccess<RiderStats>>(
    `/delivery/admin/riders/${riderId}/stats`,
  )
  return assertData(data, 'Failed to load rider stats')
}

export async function assignRiderToOrder(orderId: string, riderId: string): Promise<void> {
  const { data } = await axiosInstance.post<ApiSuccess<null>>('/delivery/assign', { orderId, riderId })
  if (!data.success) throw new Error(data.message ?? 'Assign failed')
}

export async function updateRiderMaxConcurrent(
  riderId: string,
  maxConcurrentDeliveries: number,
): Promise<RiderAdminRow> {
  const { data } = await axiosInstance.patch<ApiSuccess<RiderAdminRow>>(`/delivery/admin/riders/${riderId}`, {
    maxConcurrentDeliveries,
  })
  return assertData(data, 'Failed to update rider')
}

export type AdminOnboardRiderBody = {
  name: string
  phone: string
  password: string
  vehicleType: 'BIKE' | 'BICYCLE' | 'SCOOTER'
  vehicleNumber?: string
  licenseNumber?: string
  markVerified?: boolean
}

export type AdminOnboardRiderResult = RiderAdminRow

export async function onboardRiderAdmin(body: AdminOnboardRiderBody): Promise<AdminOnboardRiderResult> {
  const { data } = await axiosInstance.post<ApiSuccess<AdminOnboardRiderResult>>(
    '/delivery/admin/riders/onboard',
    body,
  )
  return assertData(data, 'Onboard failed')
}
