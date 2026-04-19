export type MasterProduct = {
  id: string
  categoryId: string
  name: string
  description: string | null
  imageUrl: string | null
  isActive: boolean
  createdAt: string
  category: { id: string; name: string }
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
