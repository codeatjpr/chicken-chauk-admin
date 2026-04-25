import { adminPostFormData } from '@/lib/admin-multipart'
import { axiosInstance } from '@/lib/axiosInstance'
import type { ApiSuccess } from '@/types/api'
import type { CatalogCategory, CatalogSubCategory } from '@/types/catalog'

function assertData<T>(res: ApiSuccess<T>, label: string): T {
  if (!res.success || res.data === undefined) {
    throw new Error(res.message ?? label)
  }
  return res.data
}

export async function listCategoriesAll(): Promise<CatalogCategory[]> {
  const { data } = await axiosInstance.get<ApiSuccess<CatalogCategory[]>>('/catalog/categories', {
    params: { all: 'true' },
  })
  return assertData(data, 'Failed to load categories')
}

export async function createCategory(body: {
  name: string
  sortOrder?: number
  tagline?: string
}): Promise<CatalogCategory> {
  const { data } = await axiosInstance.post<ApiSuccess<CatalogCategory>>(
    '/catalog/categories',
    body,
  )
  return assertData(data, 'Failed to create category')
}

export async function updateCategory(
  id: string,
  body: Partial<{ name: string; sortOrder: number; tagline: string | null }>,
): Promise<CatalogCategory> {
  const { data } = await axiosInstance.put<ApiSuccess<CatalogCategory>>(
    `/catalog/categories/${id}`,
    body,
  )
  return assertData(data, 'Failed to update category')
}

export async function reorderCategories(categoryIds: string[]): Promise<void> {
  const { data } = await axiosInstance.put<ApiSuccess<null>>('/catalog/categories/reorder', {
    categoryIds,
  })
  if (!data.success) {
    throw new Error(data.message ?? 'Reorder failed')
  }
}

export async function activateCategory(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<unknown>>(
    `/catalog/categories/${id}/activate`,
  )
  if (!data.success) {
    throw new Error(data.message ?? 'Activate failed')
  }
}

export async function deactivateCategory(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<unknown>>(
    `/catalog/categories/${id}/deactivate`,
  )
  if (!data.success) {
    throw new Error(data.message ?? 'Deactivate failed')
  }
}

export async function deleteCategory(id: string): Promise<void> {
  const { data } = await axiosInstance.delete<ApiSuccess<null>>(`/catalog/categories/${id}`)
  if (!data.success) {
    throw new Error(data.message ?? 'Delete failed')
  }
}

/** Multipart field `image` — updates category.imageUrl on server (S3). */
export async function uploadCategoryImage(categoryId: string, file: File): Promise<CatalogCategory> {
  const fd = new FormData()
  fd.append('image', file)
  return adminPostFormData<CatalogCategory>(`/catalog/categories/${categoryId}/image`, fd)
}

export async function listSubcategoriesAll(categoryId: string): Promise<CatalogSubCategory[]> {
  const { data } = await axiosInstance.get<ApiSuccess<CatalogSubCategory[]>>(
    `/catalog/categories/${categoryId}/subcategories/all`,
  )
  return assertData(data, 'Failed to load sub-categories')
}

export async function createSubCategory(
  categoryId: string,
  body: { name: string; sortOrder?: number },
): Promise<CatalogSubCategory> {
  const { data } = await axiosInstance.post<ApiSuccess<CatalogSubCategory>>(
    `/catalog/categories/${categoryId}/subcategories`,
    body,
  )
  return assertData(data, 'Failed to create sub-category')
}

export async function updateSubCategory(
  id: string,
  body: Partial<{ name: string; sortOrder: number; imageUrl: string | null }>,
): Promise<CatalogSubCategory> {
  const { data } = await axiosInstance.put<ApiSuccess<CatalogSubCategory>>(
    `/catalog/subcategories/${id}`,
    body,
  )
  return assertData(data, 'Failed to update sub-category')
}

export async function activateSubCategory(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<unknown>>(
    `/catalog/subcategories/${id}/activate`,
  )
  if (!data.success) throw new Error(data.message ?? 'Activate failed')
}

export async function deactivateSubCategory(id: string): Promise<void> {
  const { data } = await axiosInstance.patch<ApiSuccess<unknown>>(
    `/catalog/subcategories/${id}/deactivate`,
  )
  if (!data.success) throw new Error(data.message ?? 'Deactivate failed')
}

export async function deleteSubCategory(id: string): Promise<void> {
  const { data } = await axiosInstance.delete<ApiSuccess<null>>(`/catalog/subcategories/${id}`)
  if (!data.success) throw new Error(data.message ?? 'Delete failed')
}

export async function uploadSubCategoryImage(
  subCategoryId: string,
  file: File,
): Promise<CatalogSubCategory> {
  const fd = new FormData()
  fd.append('image', file)
  return adminPostFormData<CatalogSubCategory>(`/catalog/subcategories/${subCategoryId}/image`, fd)
}
