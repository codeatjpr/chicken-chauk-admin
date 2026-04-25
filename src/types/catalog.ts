export type CatalogCategory = {
  id: string
  name: string
  imageUrl: string | null
  tagline: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
  _count?: { products: number }
}

export type CatalogSubCategory = {
  id: string
  categoryId: string
  name: string
  imageUrl: string | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}
