import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'

export type PlatformFeeSettings = {
  deliveryFeeBase: number
  deliveryFeeFreeAbove: number
  platformFeePercent: number
  platformFeeFixed: number
}

export async function fetchPlatformSettings(): Promise<PlatformFeeSettings> {
  const { data } = await axiosInstance.get<ApiSuccess<PlatformFeeSettings>>(
    '/admin/platform-settings',
  )
  if (!data.success || !data.data) {
    throw new Error(data.message ?? 'Could not load settings')
  }
  return data.data
}

export async function updatePlatformSettings(
  body: Partial<PlatformFeeSettings>,
): Promise<PlatformFeeSettings> {
  const { data } = await axiosInstance.patch<ApiSuccess<PlatformFeeSettings>>(
    '/admin/platform-settings',
    body,
  )
  if (!data.success || !data.data) {
    throw new Error(data.message ?? 'Could not save settings')
  }
  return data.data
}
