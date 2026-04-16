import { adminPostFormData } from '@/lib/admin-multipart'
import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'
import type { PaginatedResult } from '@/types/pagination'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export type BannerRow = {
  id: string
  title: string
  imageUrl: string
  linkType: string
  linkId: string | null
  externalUrl: string | null
  city: string | null
  sortOrder: number
  isActive: boolean
  startsAt: string | null
  endsAt: string | null
  createdAt: string
}

export type BannerLinkType = 'VENDOR' | 'PRODUCT' | 'COUPON' | 'EXTERNAL' | 'STATIC'

export async function listBanners(page = 1, limit = 20): Promise<PaginatedResult<BannerRow>> {
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<BannerRow>>>('/discovery/banners', {
    params: { page, limit },
  })
  return assertData(data, 'Failed to load banners')
}

/** Multipart: field `image` + text fields (no imageUrl). */
export async function createBannerMultipart(
  fields: {
    title: string
    linkType: BannerLinkType
    linkId?: string
    externalUrl?: string
    city?: string
    sortOrder?: number
    startsAt?: string
    endsAt?: string
    isActive?: boolean
  },
  imageFile: File,
): Promise<BannerRow> {
  const fd = new FormData()
  fd.append('image', imageFile)
  fd.append('title', fields.title)
  fd.append('linkType', fields.linkType)
  if (fields.linkId) fd.append('linkId', fields.linkId)
  if (fields.externalUrl) fd.append('externalUrl', fields.externalUrl)
  if (fields.city) fd.append('city', fields.city)
  fd.append('sortOrder', String(fields.sortOrder ?? 0))
  if (fields.startsAt) fd.append('startsAt', fields.startsAt)
  if (fields.endsAt) fd.append('endsAt', fields.endsAt)
  if (fields.isActive !== undefined) fd.append('isActive', fields.isActive ? 'true' : 'false')
  return adminPostFormData<BannerRow>('/discovery/banners', fd)
}

export async function updateBanner(
  id: string,
  body: Partial<{
    title: string
    linkType: BannerLinkType
    linkId: string | null
    externalUrl: string | null
    city: string | null
    sortOrder: number
    startsAt: string | null
    endsAt: string | null
    isActive: boolean
  }>,
): Promise<BannerRow> {
  const { data } = await axiosInstance.put<ApiSuccess<BannerRow>>(`/discovery/banners/${id}`, body)
  return assertData(data, 'Failed to update banner')
}

export async function deactivateBanner(id: string): Promise<void> {
  const { data } = await axiosInstance.delete<ApiSuccess<null>>(`/discovery/banners/${id}`)
  if (!data.success) throw new Error(data.message ?? 'Deactivate failed')
}

export async function replaceBannerImage(id: string, file: File): Promise<BannerRow> {
  const fd = new FormData()
  fd.append('image', file)
  return adminPostFormData<BannerRow>(`/discovery/banners/${id}/image`, fd)
}
