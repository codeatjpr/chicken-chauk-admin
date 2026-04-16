import { adminPostFormData } from '@/lib/admin-multipart'
import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'
import type {
  MasterProduct,
  MasterProductWithVariants,
  ProductVariantRow,
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
  name: string
  description?: string
  unit: string
}): Promise<MasterProduct> {
  const { data } = await axiosInstance.post<ApiSuccess<MasterProduct>>('/catalog/products', body)
  return assertData(data, 'Failed to create product')
}

export async function updateMasterProduct(
  id: string,
  body: Partial<{
    categoryId: string
    name: string
    description: string | null
    unit: string
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

/** Full master product including all variants (admin; used for variant CRUD). */
export async function getMasterProductById(productId: string): Promise<MasterProductWithVariants> {
  const { data } = await axiosInstance.get<ApiSuccess<MasterProductWithVariants>>(
    `/catalog/products/${productId}`,
  )
  return assertData(data, 'Failed to load product')
}

/** Active variants for a master product (public catalog — vendors pick SKUs). */
export async function listProductVariants(productId: string): Promise<ProductVariantRow[]> {
  const { data } = await axiosInstance.get<ApiSuccess<ProductVariantRow[]>>(
    `/catalog/products/${productId}/variants`,
  )
  return assertData(data, 'Failed to load variants')
}

export async function createProductVariant(
  productId: string,
  body: { name: string; weight: number; unit: string; sortOrder?: number; isActive?: boolean },
): Promise<ProductVariantRow> {
  const { data } = await axiosInstance.post<ApiSuccess<ProductVariantRow>>(
    `/catalog/products/${productId}/variants`,
    body,
  )
  return assertData(data, 'Failed to create variant')
}

export async function updateProductVariant(
  productId: string,
  variantId: string,
  body: Partial<{ name: string; weight: number; unit: string; sortOrder: number; isActive: boolean }>,
): Promise<ProductVariantRow> {
  const { data } = await axiosInstance.patch<ApiSuccess<ProductVariantRow>>(
    `/catalog/products/${productId}/variants/${variantId}`,
    body,
  )
  return assertData(data, 'Failed to update variant')
}

export async function deleteProductVariant(productId: string, variantId: string): Promise<void> {
  const { data } = await axiosInstance.delete<ApiSuccess<null>>(
    `/catalog/products/${productId}/variants/${variantId}`,
  )
  if (!data.success) throw new Error(data.message ?? 'Delete failed')
}

export async function uploadMasterProductImage(productId: string, file: File): Promise<MasterProduct> {
  const fd = new FormData()
  fd.append('image', file)
  return adminPostFormData<MasterProduct>(`/catalog/products/${productId}/image`, fd)
}
