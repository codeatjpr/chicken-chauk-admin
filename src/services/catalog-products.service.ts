import { adminPostFormData } from '@/lib/admin-multipart'
import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'
import type {
  MasterProduct,
  ProductVendorUsage,
} from '@/types/catalog-product'
import type { PaginatedResult } from '@/types/pagination'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export async function listMasterProducts(params: {
  page?: number
  limit?: number
  categoryId?: string
  subCategoryId?: string
  search?: string
  isActive?: boolean
}): Promise<PaginatedResult<MasterProduct>> {
  const { data } = await axiosInstance.get<ApiSuccess<PaginatedResult<MasterProduct>>>(
    '/catalog/products',
    {
      params: {
        ...params,
        ...(params.isActive !== undefined && { isActive: params.isActive ? 'true' : 'false' }),
      },
    },
  )
  return assertData(data, 'Failed to load products')
}

export async function createMasterProduct(body: {
  categoryId: string
  subCategoryId?: string | null
  name: string
  description?: string
}): Promise<MasterProduct> {
  const { data } = await axiosInstance.post<ApiSuccess<MasterProduct>>('/catalog/products', body)
  return assertData(data, 'Failed to create product')
}

export async function updateMasterProduct(
  id: string,
  body: Partial<{
    categoryId: string
    subCategoryId: string | null
    name: string
    description: string | null
  }>,
): Promise<MasterProduct> {
  const { data } = await axiosInstance.put<ApiSuccess<MasterProduct>>(`/catalog/products/${id}`, body)
  return assertData(data, 'Failed to update product')
}

export async function activateMasterProduct(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<unknown>>(`/catalog/products/${id}/activate`)
  if (!data.success) throw new Error(data.message ?? 'Activate failed')
}

export async function deactivateMasterProduct(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<unknown>>(`/catalog/products/${id}/deactivate`)
  if (!data.success) throw new Error(data.message ?? 'Deactivate failed')
}

export async function getProductVendorUsage(productId: string): Promise<ProductVendorUsage> {
  const { data } = await axiosInstance.get<ApiSuccess<ProductVendorUsage>>(
    `/catalog/products/${productId}/vendor-usage`,
  )
  return assertData(data, 'Failed to load vendor usage')
}

export async function getMasterProductById(productId: string): Promise<MasterProduct> {
  const { data } = await axiosInstance.get<ApiSuccess<MasterProduct>>(
    `/catalog/products/${productId}`,
  )
  return assertData(data, 'Failed to load product')
}

export async function uploadMasterProductImage(productId: string, file: File): Promise<MasterProduct> {
  const fd = new FormData()
  fd.append('image', file)
  return adminPostFormData<MasterProduct>(`/catalog/products/${productId}/image`, fd)
}
