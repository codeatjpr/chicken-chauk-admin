export type MasterProduct = {
  id: string
  categoryId: string
  name: string
  description: string | null
  imageUrl: string | null
  unit: string
  isActive: boolean
  createdAt: string
  category: { id: string; name: string }
}

export type ProductVariantRow = {
  id: string
  name: string
  weight: number
  unit: string
  isActive: boolean
  sortOrder: number
}

export type MasterProductWithVariants = MasterProduct & {
  variants: ProductVariantRow[]
}

export type ProductVendorUsageRow = {
  id: string
  price: number
  mrp: number | null
  stock: number
  isAvailable: boolean
  vendor: { id: string; name: string; city: string; isActive: boolean }
}

export type ProductVendorUsage = {
  productId: string
  vendorCount: number
  vendors: ProductVendorUsageRow[]
}
