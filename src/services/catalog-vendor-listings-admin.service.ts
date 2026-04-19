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

export type AdminVendorListingRow = {
  id: string
  vendorId: string
  productId: string
  price: number
  mrp: number | null
  stock: number
  isAvailable: boolean
  sortOrder: number
  imageUrl?: string | null
  description: string | null
  quantityValue: number | null
  quantityUnit: string | null
  pieces: string | null
  servings: string | null
  updatedAt: string
  product: {
    id: string
    name: string
    imageUrl?: string | null
    category: { id: string; name: string }
  }
  vendor: { id: string; name: string; city: string }
}

export async function listAdminVendorListings(params: {
  page?: number
  limit?: number
  vendorId?: string
  /** Case-insensitive contains on shop name (ignored if vendorId is set). */
  vendorName?: string
  /** Case-insensitive contains on vendor city. */
  city?: string
  categoryId?: string
  /** Product or variant name (contains). */
  search?: string
  isAvailable?: boolean
  /** any (omit), out = 0 stock, in = &gt;0, low = 1–10 */
  stock?: 'out' | 'in' | 'low'
}): Promise<PaginatedResult<AdminVendorListingRow>> {
  const q: Record<string, string | number> = {}
  if (params.page != null) q.page = params.page
  if (params.limit != null) q.limit = params.limit
  if (params.vendorId) q.vendorId = params.vendorId
  if (params.vendorName) q.vendorName = params.vendorName
  if (params.city) q.city = params.city
  if (params.categoryId) q.categoryId = params.categoryId
  if (params.search) q.search = params.search
  if (params.isAvailable !== undefined) q.isAvailable = params.isAvailable ? 'true' : 'false'
  if (params.stock) q.stock = params.stock
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<AdminVendorListingRow>>>(
    '/catalog/admin/vendor-products',
    { params: q },
  )
  return assertData(data, 'Failed to load vendor listings')
}

export async function getAdminVendorListing(id: string): Promise<AdminVendorListingRow & { vendor: { isActive: boolean } }> {
  const { data } = await axiosInstance.get<ApiSuccess<AdminVendorListingRow & { vendor: { isActive: boolean } }>>(
    `/catalog/admin/vendor-products/${id}`,
  )
  return assertData(data, 'Failed to load listing')
}

export async function createAdminVendorListing(body: {
  vendorId: string
  productId: string
  price: number
  mrp?: number | null
  sortOrder?: number
  quantityValue?: number | null
  quantityUnit?: string | null
  description?: string | null
  pieces?: string | null
  servings?: string | null
}): Promise<AdminVendorListingRow> {
  const { data } = await axiosInstance.post<ApiSuccess<AdminVendorListingRow>>(
    '/catalog/admin/vendor-products',
    body,
  )
  return assertData(data, 'Failed to create listing')
}

export async function patchAdminVendorListing(
  id: string,
  body: Partial<{
    price: number
    mrp: number | null
    sortOrder: number
    stock: number
    isAvailable: boolean
    quantityValue: number | null
    quantityUnit: string | null
    description: string | null
    pieces: string | null
    servings: string | null
  }>,
): Promise<AdminVendorListingRow> {
  const { data } = await axiosInstance.patch<ApiSuccess<AdminVendorListingRow>>(
    `/catalog/admin/vendor-products/${id}`,
    body,
  )
  return assertData(data, 'Failed to update listing')
}

export async function deleteAdminVendorListing(id: string): Promise<void> {
  const { data } = await axiosInstance.delete<ApiSuccess<null>>(`/catalog/admin/vendor-products/${id}`)
  if (!data.success) throw new Error(data.message ?? 'Delete failed')
}

export async function uploadVendorListingImage(listingId: string, file: File): Promise<AdminVendorListingRow> {
  const fd = new FormData()
  fd.append('image', file)
  return adminPostFormData<AdminVendorListingRow>(`/catalog/admin/vendor-products/${listingId}/image`, fd)
}
