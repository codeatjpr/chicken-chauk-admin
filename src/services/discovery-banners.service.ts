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

export type BannerLinkType = 'VENDOR' | 'PRODUCT' | 'COUPON' | 'EXTERNAL' | 'STATIC'

export type BannerPlacement = 'HERO_CAROUSEL' | 'MIDDLE_PROMO' | 'PRODUCT_HIGHLIGHT' | 'BOTTOM_STRIP'

export type BannerLayoutPreset = 'RATIO_16_9' | 'RATIO_2_1' | 'RATIO_6_1' | 'RATIO_3_4'

export type BannerPageScope = 'HOME' | 'CATEGORY'

export type BannerRow = {
  id: string
  title: string
  imageUrl: string
  imageUrlMobile: string | null
  imageUrlDesktop: string | null
  placement: BannerPlacement
  layoutPreset: BannerLayoutPreset
  pageScope: BannerPageScope
  categoryId: string | null
  isClickable: boolean
  category: { id: string; name: string } | null
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

export async function listBanners(page = 1, limit = 20): Promise<PaginatedResult<BannerRow>> {
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<BannerRow>>>('/discovery/banners', {
    params: { page, limit },
  })
  return assertData(data, 'Failed to load banners')
}

export type CreateBannerFields = {
  title: string
  linkType: BannerLinkType
  linkId?: string
  externalUrl?: string
  city?: string
  sortOrder?: number
  startsAt?: string
  endsAt?: string
  isActive?: boolean
  placement?: BannerPlacement
  layoutPreset?: BannerLayoutPreset
  pageScope?: BannerPageScope
  categoryId?: string
  isClickable?: boolean
}

/** Multipart: field `image` (required) + optional `imageMobile`, `imageDesktop`. */
export async function createBannerMultipart(
  fields: CreateBannerFields,
  imageFile: File,
  opts?: { imageMobile?: File; imageDesktop?: File },
): Promise<BannerRow> {
  const fd = new FormData()
  fd.append('image', imageFile)
  if (opts?.imageMobile) fd.append('imageMobile', opts.imageMobile)
  if (opts?.imageDesktop) fd.append('imageDesktop', opts.imageDesktop)
  fd.append('title', fields.title)
  fd.append('linkType', fields.linkType)
  if (fields.linkId) fd.append('linkId', fields.linkId)
  if (fields.externalUrl) fd.append('externalUrl', fields.externalUrl)
  if (fields.city) fd.append('city', fields.city)
  fd.append('sortOrder', String(fields.sortOrder ?? 0))
  if (fields.startsAt) fd.append('startsAt', fields.startsAt)
  if (fields.endsAt) fd.append('endsAt', fields.endsAt)
  if (fields.isActive !== undefined) fd.append('isActive', fields.isActive ? 'true' : 'false')
  fd.append('placement', fields.placement ?? 'HERO_CAROUSEL')
  fd.append('layoutPreset', fields.layoutPreset ?? 'RATIO_16_9')
  fd.append('pageScope', fields.pageScope ?? 'HOME')
  if (fields.categoryId) fd.append('categoryId', fields.categoryId)
  fd.append('isClickable', fields.isClickable !== false ? 'true' : 'false')
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
    placement: BannerPlacement
    layoutPreset: BannerLayoutPreset
    pageScope: BannerPageScope
    categoryId: string | null
    isClickable: boolean
  }>,
): Promise<BannerRow> {
  const { data } = await axiosInstance.put<ApiSuccess<BannerRow>>(`/discovery/banners/${id}`, body)
  return assertData(data, 'Failed to update banner')
}

export async function deactivateBanner(id: string): Promise<void> {
  const { data } = await axiosInstance.delete<ApiSuccess<null>>(`/discovery/banners/${id}`)
  if (!data.success) throw new Error(data.message ?? 'Deactivate failed')
}

/** `slot` main = default image, mobile / desktop = responsive art. */
export async function replaceBannerImage(
  id: string,
  file: File,
  slot: 'main' | 'mobile' | 'desktop' = 'main',
): Promise<BannerRow> {
  const fd = new FormData()
  fd.append('image', file)
  const q = slot === 'main' ? '' : `?slot=${slot}`
  return adminPostFormData<BannerRow>(`/discovery/banners/${id}/image${q}`, fd)
}
