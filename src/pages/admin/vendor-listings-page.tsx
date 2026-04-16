import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  createAdminVendorListing,
  deleteAdminVendorListing,
  getAdminVendorListing,
  listAdminVendorListings,
  patchAdminVendorListing,
  uploadVendorListingImage,
  type AdminVendorListingRow,
} from '@/services/catalog-vendor-listings-admin.service'
import { listCategoriesAll } from '@/services/catalog-admin.service'
import { listMasterProducts, listProductVariants } from '@/services/catalog-products.service'
import { listAllVendors } from '@/services/vendors-admin.service'
import type { MasterProduct, ProductVariantRow } from '@/types/catalog-product'

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function variantOptionLabel(v: Pick<ProductVariantRow, 'name' | 'weight' | 'unit'>) {
  return `${v.name} · ${v.weight} ${v.unit}`
}

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function VendorListingsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20
  const [shopNameFilter, setShopNameFilter] = useState('')
  const [debouncedShopName, setDebouncedShopName] = useState('')
  const [cityFilter, setCityFilter] = useState('')
  const [debouncedCity, setDebouncedCity] = useState('')
  const [listProductSearch, setListProductSearch] = useState('')
  const [debouncedListProductSearch, setDebouncedListProductSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [availFilter, setAvailFilter] = useState<'any' | 'true' | 'false'>('any')
  const [stockFilter, setStockFilter] = useState<'any' | 'out' | 'in' | 'low'>('any')

  const [detailListingId, setDetailListingId] = useState<string | null>(null)
  const [createVendorSearch, setCreateVendorSearch] = useState('')
  const [debouncedVendorSearch, setDebouncedVendorSearch] = useState('')
  const [createProductSearch, setCreateProductSearch] = useState('')
  const [debouncedCreateProductPick, setDebouncedCreateProductPick] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [editRow, setEditRow] = useState<AdminVendorListingRow | null>(null)
  const [createVendorId, setCreateVendorId] = useState('')
  const [createProductId, setCreateProductId] = useState('')
  const [createVariantId, setCreateVariantId] = useState('')
  const [createPrice, setCreatePrice] = useState('')
  const [createMrp, setCreateMrp] = useState('')
  const [createSort, setCreateSort] = useState('0')
  const [editPrice, setEditPrice] = useState('')
  const [editMrp, setEditMrp] = useState('')
  const [editSort, setEditSort] = useState('')
  const [editStock, setEditStock] = useState('')
  const [editAvailable, setEditAvailable] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedShopName(shopNameFilter.trim()), 400)
    return () => clearTimeout(t)
  }, [shopNameFilter])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(cityFilter.trim()), 400)
    return () => clearTimeout(t)
  }, [cityFilter])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedListProductSearch(listProductSearch.trim()), 350)
    return () => clearTimeout(t)
  }, [listProductSearch])

  const listQ = useQuery({
    queryKey: [
      'admin-vendor-listings',
      page,
      debouncedShopName,
      debouncedCity,
      debouncedListProductSearch,
      availFilter,
      categoryFilter,
      stockFilter,
    ],
    queryFn: () =>
      listAdminVendorListings({
        page,
        limit,
        vendorName: debouncedShopName || undefined,
        city: debouncedCity || undefined,
        search: debouncedListProductSearch || undefined,
        categoryId: categoryFilter || undefined,
        ...(availFilter !== 'any' && { isAvailable: availFilter === 'true' }),
        ...(stockFilter !== 'any' && { stock: stockFilter }),
      }),
  })

  const productIdTrimmed = createProductId.trim()
  const variantsQ = useQuery({
    queryKey: ['product-variants', productIdTrimmed],
    queryFn: () => listProductVariants(productIdTrimmed),
    enabled: createOpen && UUID_RE.test(productIdTrimmed),
    staleTime: 60_000,
  })

  useEffect(() => {
    setCreateVariantId('')
  }, [createProductId])

  useEffect(() => {
    const rows = variantsQ.data
    if (!rows?.length) return
    if (rows.length === 1) setCreateVariantId(rows[0].id)
  }, [variantsQ.data])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedVendorSearch(createVendorSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [createVendorSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedCreateProductPick(createProductSearch.trim()), 300)
    return () => clearTimeout(t)
  }, [createProductSearch])

  const categoriesQ = useQuery({
    queryKey: ['catalog-categories-all'],
    queryFn: listCategoriesAll,
  })

  const detailQ = useQuery({
    queryKey: ['admin-vendor-listing-detail', detailListingId],
    queryFn: () => getAdminVendorListing(detailListingId!),
    enabled: !!detailListingId,
  })

  const vendorPickQ = useQuery({
    queryKey: ['admin-vendors-pick', debouncedVendorSearch],
    queryFn: () => listAllVendors({ page: 1, limit: 12, search: debouncedVendorSearch || undefined }),
    enabled: createOpen && debouncedVendorSearch.length >= 1,
  })

  const productPickQ = useQuery({
    queryKey: ['admin-products-pick', debouncedCreateProductPick],
    queryFn: () =>
      listMasterProducts({
        page: 1,
        limit: 12,
        search: debouncedCreateProductPick || undefined,
      }),
    enabled: createOpen && debouncedCreateProductPick.length >= 1,
  })

  const createMut = useMutation({
    mutationFn: () =>
      createAdminVendorListing({
        vendorId: createVendorId.trim(),
        variantId: createVariantId.trim(),
        price: Number(createPrice),
        mrp: createMrp.trim() ? Number(createMrp) : null,
        sortOrder: Number(createSort) || 0,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-vendor-listings'] })
      toast.success('Listing created')
      setCreateOpen(false)
      resetCreate()
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Create failed')),
  })

  const patchMut = useMutation({
    mutationFn: () =>
      patchAdminVendorListing(editRow!.id, {
        price: Number(editPrice),
        mrp: editMrp.trim() ? Number(editMrp) : null,
        sortOrder: Number(editSort) || 0,
        stock: Number(editStock),
        isAvailable: editAvailable,
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-vendor-listings'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-vendor-listing-detail'] })
      toast.success('Listing updated')
      setEditRow(null)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Update failed')),
  })

  const delMut = useMutation({
    mutationFn: deleteAdminVendorListing,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin-vendor-listings'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-vendor-listing-detail'] })
      toast.success('Listing removed')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Delete failed')),
  })

  function resetCreate() {
    setCreateVendorId('')
    setCreateVendorSearch('')
    setCreateProductId('')
    setCreateProductSearch('')
    setCreateVariantId('')
    setCreatePrice('')
    setCreateMrp('')
    setCreateSort('0')
  }

  function openEditFromDetail(row: AdminVendorListingRow & { vendor?: { isActive?: boolean } }) {
    setDetailListingId(null)
    openEdit(row as AdminVendorListingRow)
  }

  function openEdit(row: AdminVendorListingRow) {
    setEditRow(row)
    setEditPrice(String(row.price))
    setEditMrp(row.mrp != null ? String(row.mrp) : '')
    setEditSort(String(row.sortOrder))
    setEditStock(String(row.stock))
    setEditAvailable(row.isAvailable)
  }

  async function onPickListingImage(row: AdminVendorListingRow, file: File | null) {
    if (!file) return
    try {
      await uploadVendorListingImage(row.id, file)
      void queryClient.invalidateQueries({ queryKey: ['admin-vendor-listings'] })
      toast.success('Image updated')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Upload failed'))
    }
  }

  const items = listQ.data?.items ?? []
  const pr = listQ.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Vendor listings</h1>
          <p className="text-muted-foreground text-sm">
            Search by shop name and city, filter by product name, category, storefront availability, and stock band.
            Admins can set price, MRP, sort, stock, and availability; upload listing images; create or delete listings.
          </p>
        </div>
        <Button type="button" onClick={() => setCreateOpen(true)} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Add listing
        </Button>
      </div>

      <Card>
        <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0 pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => {
              setShopNameFilter('')
              setCityFilter('')
              setListProductSearch('')
              setCategoryFilter('')
              setAvailFilter('any')
              setStockFilter('any')
              setPage(1)
            }}
          >
            Clear filters
          </Button>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Label htmlFor="vl-shop">Shop name contains</Label>
              <Input
                id="vl-shop"
                placeholder="e.g. Fresh Meat House"
                value={shopNameFilter}
                onChange={(e) => {
                  setShopNameFilter(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label htmlFor="vl-city">City / location contains</Label>
              <Input
                id="vl-city"
                placeholder="e.g. Mumbai"
                value={cityFilter}
                onChange={(e) => {
                  setCityFilter(e.target.value)
                  setPage(1)
                }}
              />
            </div>
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label htmlFor="vl-product">Product or variant name</Label>
              <Input
                id="vl-product"
                placeholder="Matches master product or variant label"
                value={listProductSearch}
                onChange={(e) => {
                  setListProductSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[10rem] flex-1 space-y-1">
              <Label htmlFor="vl-cat">Category</Label>
              <select
                id="vl-cat"
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                value={categoryFilter}
                onChange={(e) => {
                  setCategoryFilter(e.target.value)
                  setPage(1)
                }}
              >
                <option value="">All categories</option>
                {(categoriesQ.data ?? []).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {!c.isActive ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vl-avail">Storefront availability</Label>
              <select
                id="vl-avail"
                className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                value={availFilter}
                onChange={(e) => {
                  setAvailFilter(e.target.value as 'any' | 'true' | 'false')
                  setPage(1)
                }}
              >
                <option value="any">Any</option>
                <option value="true">Available</option>
                <option value="false">Unavailable</option>
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vl-stock">Stock</Label>
              <select
                id="vl-stock"
                className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                value={stockFilter}
                onChange={(e) => {
                  setStockFilter(e.target.value as 'any' | 'out' | 'in' | 'low')
                  setPage(1)
                }}
              >
                <option value="any">Any</option>
                <option value="out">Out of stock (0)</option>
                <option value="in">In stock (&gt; 0)</option>
                <option value="low">Low (1–10)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Listings</CardTitle>
          <CardDescription>{pr ? `${pr.total} total` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No listings match.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Img</th>
                      <th className="pb-2 font-medium">Vendor</th>
                      <th className="pb-2 font-medium">Product / variant</th>
                      <th className="pb-2 font-medium">Price</th>
                      <th className="pb-2 font-medium">Stock</th>
                      <th className="pb-2 font-medium">Avail</th>
                      <th className="pb-2 font-medium text-right">View / actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => {
                      const img = row.imageUrl || row.product.imageUrl
                      return (
                        <tr key={row.id} className="border-border/80 border-b">
                          <td className="py-2 pr-2">
                            {img ? (
                              <img src={img} alt="" className="size-9 rounded-md object-cover" />
                            ) : (
                              <div className="bg-muted size-9 rounded-md" />
                            )}
                          </td>
                          <td className="py-2 pr-4">
                            <span className="font-medium">{row.vendor.name}</span>
                            <p className="text-muted-foreground text-xs">{row.vendor.city}</p>
                          </td>
                          <td className="py-2 pr-4">
                            {row.product.name}
                            <p className="text-muted-foreground text-xs">{row.product.category.name}</p>
                            <p className="text-muted-foreground text-xs">
                              {variantOptionLabel(row.variant)}
                            </p>
                          </td>
                          <td className="py-2 pr-4">
                            {money.format(row.price)}
                            {row.mrp != null && (
                              <span className="text-muted-foreground text-xs line-through">
                                {' '}
                                {money.format(row.mrp)}
                              </span>
                            )}
                          </td>
                          <td className="py-2 pr-4">{row.stock}</td>
                          <td className="py-2 pr-4">
                            <Badge variant={row.isAvailable ? 'secondary' : 'outline'}>
                              {row.isAvailable ? 'Yes' : 'No'}
                            </Badge>
                          </td>
                          <td className="py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                title="View listing"
                                onClick={() => setDetailListingId(row.id)}
                              >
                                <Eye className="size-3.5" />
                              </Button>
                              <label className="text-muted-foreground hover:text-foreground inline-flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-muted">
                                <input
                                  type="file"
                                  accept="image/jpeg,image/png"
                                  className="sr-only"
                                  onChange={(e) => void onPickListingImage(row, e.target.files?.[0] ?? null)}
                                />
                                <ImagePlus className="size-3.5" />
                              </label>
                              <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEdit(row)}>
                                <Pencil className="size-3.5" />
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon-sm"
                                className="text-destructive"
                                onClick={() => {
                                  if (window.confirm('Remove this vendor listing?')) delMut.mutate(row.id)
                                }}
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {pr && pr.totalPages > 1 && (
                <div className="text-muted-foreground mt-4 flex items-center justify-between text-sm">
                  <span>
                    Page {pr.page} of {pr.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!pr.hasPrev}
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!pr.hasNext}
                      onClick={() => setPage((p) => p + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Sheet
        open={!!detailListingId}
        onOpenChange={(o) => {
          if (!o) setDetailListingId(null)
        }}
      >
        <SheetContent className="flex max-h-[100dvh] flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Vendor product (read)</SheetTitle>
            <SheetDescription>Listing id and relationships. Stock and availability are vendor-controlled.</SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-4 overflow-y-auto px-4 pb-4">
            {detailQ.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : detailQ.data ? (
              <>
                <div className="space-y-1 text-sm">
                  <p className="text-muted-foreground text-xs">VendorProduct id</p>
                  <p className="font-mono text-xs break-all">{detailQ.data.id}</p>
                </div>
                <div className="grid gap-3 text-sm sm:grid-cols-2">
                  <div>
                    <p className="text-muted-foreground text-xs">Vendor</p>
                    <p className="font-medium">{detailQ.data.vendor.name}</p>
                    <p className="text-muted-foreground text-xs">
                      {detailQ.data.vendor.city} · vendor id{' '}
                      <span className="font-mono">{detailQ.data.vendorId}</span>
                    </p>
                    <Badge variant={detailQ.data.vendor.isActive ? 'secondary' : 'outline'} className="mt-1">
                      Vendor {detailQ.data.vendor.isActive ? 'active' : 'inactive'}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Product & variant</p>
                    <p className="font-medium">{detailQ.data.product.name}</p>
                    <p className="text-muted-foreground text-xs">{detailQ.data.product.category.name}</p>
                    <p className="text-muted-foreground text-xs">{variantOptionLabel(detailQ.data.variant)}</p>
                    <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                      product {detailQ.data.productId} · variant {detailQ.data.variantId}
                    </p>
                  </div>
                </div>
                <div className="grid gap-2 text-sm sm:grid-cols-2">
                  <div>
                    <span className="text-muted-foreground text-xs">Price</span>
                    <p className="font-medium">{money.format(detailQ.data.price)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">MRP</span>
                    <p>{detailQ.data.mrp != null ? money.format(detailQ.data.mrp) : '—'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Stock</span>
                    <p>{detailQ.data.stock}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Available</span>
                    <p>{detailQ.data.isAvailable ? 'Yes' : 'No'}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Sort order</span>
                    <p>{detailQ.data.sortOrder}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Updated</span>
                    <p className="text-xs">{new Date(detailQ.data.updatedAt).toLocaleString()}</p>
                  </div>
                </div>
                <div>
                  <p className="text-muted-foreground mb-2 text-xs">Listing image</p>
                  {detailQ.data.imageUrl || detailQ.data.product.imageUrl ? (
                    <img
                      src={detailQ.data.imageUrl || detailQ.data.product.imageUrl || ''}
                      alt=""
                      className="border-border max-h-40 rounded-lg border object-contain"
                    />
                  ) : (
                    <div className="bg-muted text-muted-foreground rounded-lg p-4 text-xs">No image</div>
                  )}
                  <label className="text-muted-foreground hover:text-foreground mt-2 inline-flex cursor-pointer items-center gap-2 text-xs">
                    <input
                      type="file"
                      accept="image/jpeg,image/png"
                      className="sr-only"
                      onChange={(e) =>
                        void (async () => {
                          const file = e.target.files?.[0]
                          if (!file || !detailListingId) return
                          try {
                            await uploadVendorListingImage(detailListingId, file)
                            void queryClient.invalidateQueries({ queryKey: ['admin-vendor-listing-detail', detailListingId] })
                            void queryClient.invalidateQueries({ queryKey: ['admin-vendor-listings'] })
                            toast.success('Image updated')
                          } catch (err) {
                            toast.error(getApiErrorMessage(err, 'Upload failed'))
                          }
                          e.target.value = ''
                        })()
                      }
                    />
                    <ImagePlus className="size-3.5" />
                    Replace image
                  </label>
                </div>
                <div className="flex flex-wrap gap-2 border-t pt-2">
                  <Button type="button" variant="outline" size="sm" onClick={() => setDetailListingId(null)}>
                    Close
                  </Button>
                  <Button type="button" size="sm" onClick={() => openEditFromDetail(detailQ.data)}>
                    Edit price / MRP / sort
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={() => {
                      if (!window.confirm('Delete this vendor product?')) return
                      delMut.mutate(detailQ.data!.id, {
                        onSuccess: () => {
                          setDetailListingId(null)
                        },
                      })
                    }}
                  >
                    Delete
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground text-sm">Could not load listing.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>

      <Sheet
        open={createOpen}
        onOpenChange={(o) => {
          setCreateOpen(o)
          if (!o) resetCreate()
        }}
      >
        <SheetContent className="flex max-h-[100dvh] flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New vendor listing</SheetTitle>
            <SheetDescription>
              Search vendor and product, pick variant, set admin price. Stock starts at 0 until the vendor updates it.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            <div className="space-y-1">
              <Label>Find vendor</Label>
              <Input
                placeholder="Type name, city, or phone…"
                value={createVendorSearch}
                onChange={(e) => setCreateVendorSearch(e.target.value)}
              />
              {vendorPickQ.data && vendorPickQ.data.items.length > 0 && (
                <ul className="border-border max-h-36 overflow-y-auto rounded-lg border text-sm">
                  {vendorPickQ.data.items.map((v) => (
                    <li key={v.id}>
                      <button
                        type="button"
                        className="hover:bg-muted w-full px-2 py-1.5 text-left"
                        onClick={() => {
                          setCreateVendorId(v.id)
                          setCreateVendorSearch(`${v.name} · ${v.city}`)
                        }}
                      >
                        <span className="font-medium">{v.name}</span>
                        <span className="text-muted-foreground text-xs"> · {v.city}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Label className="text-muted-foreground text-xs">Vendor id (editable)</Label>
              <Input className="font-mono text-xs" value={createVendorId} onChange={(e) => setCreateVendorId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Find product</Label>
              <Input
                placeholder="Type product name…"
                value={createProductSearch}
                onChange={(e) => setCreateProductSearch(e.target.value)}
              />
              {productPickQ.data && productPickQ.data.items.length > 0 && (
                <ul className="border-border max-h-36 overflow-y-auto rounded-lg border text-sm">
                  {productPickQ.data.items.map((p: MasterProduct) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        className="hover:bg-muted w-full px-2 py-1.5 text-left"
                        onClick={() => {
                          setCreateProductId(p.id)
                          setCreateProductSearch(`${p.name} (${p.category.name})`)
                        }}
                      >
                        <span className="font-medium">{p.name}</span>
                        <span className="text-muted-foreground text-xs"> · {p.category.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              <Label className="text-muted-foreground text-xs">Product id (editable)</Label>
              <Input className="font-mono text-xs" value={createProductId} onChange={(e) => setCreateProductId(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Variant</Label>
              {!UUID_RE.test(productIdTrimmed) ? (
                <p className="text-muted-foreground text-xs">Enter a valid product UUID to load variants.</p>
              ) : variantsQ.isLoading ? (
                <Skeleton className="h-8 w-full" />
              ) : variantsQ.isError ? (
                <p className="text-destructive text-xs">Could not load variants for this product.</p>
              ) : (
                <select
                  className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
                  value={createVariantId}
                  onChange={(e) => setCreateVariantId(e.target.value)}
                >
                  <option value="">Select variant…</option>
                  {(variantsQ.data ?? []).map((v) => (
                    <option key={v.id} value={v.id}>
                      {variantOptionLabel(v)}
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="space-y-1">
              <Label>Price (INR)</Label>
              <Input type="number" min={0} step="0.01" value={createPrice} onChange={(e) => setCreatePrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>MRP (optional)</Label>
              <Input type="number" min={0} step="0.01" value={createMrp} onChange={(e) => setCreateMrp(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sort order</Label>
              <Input type="number" min={0} value={createSort} onChange={(e) => setCreateSort(e.target.value)} />
            </div>
            <SheetFooter className="flex-row gap-2 p-0">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  createMut.isPending ||
                  !createVendorId.trim() ||
                  !createProductId.trim() ||
                  !createVariantId.trim() ||
                  !createPrice ||
                  Number(createPrice) <= 0
                }
                onClick={() => createMut.mutate()}
              >
                Create
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      <Sheet open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <SheetContent className="sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Update vendor product</SheetTitle>
            <SheetDescription className="font-mono text-xs">{editRow?.id}</SheetDescription>
            {editRow && (
              <p className="text-muted-foreground pt-1 text-xs">
                {editRow.vendor.name} · {editRow.product.name} · {variantOptionLabel(editRow.variant)}
              </p>
            )}
          </SheetHeader>
          <div className="space-y-3 px-4 pb-4">
            <div className="space-y-1">
              <Label>Price</Label>
              <Input type="number" min={0} step="0.01" value={editPrice} onChange={(e) => setEditPrice(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>MRP (optional)</Label>
              <Input type="number" min={0} step="0.01" value={editMrp} onChange={(e) => setEditMrp(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Sort order</Label>
              <Input type="number" min={0} value={editSort} onChange={(e) => setEditSort(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Stock</Label>
              <Input type="number" min={0} step="0.01" value={editStock} onChange={(e) => setEditStock(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-1">
              <input
                id="edit-avail"
                type="checkbox"
                className="size-4"
                checked={editAvailable}
                onChange={(e) => setEditAvailable(e.target.checked)}
              />
              <Label htmlFor="edit-avail" className="font-normal">
                Listed as available on storefront
              </Label>
            </div>
            <p className="text-muted-foreground text-xs">
              Availability can only be on if price is greater than zero (same rule as vendor app).
            </p>
            <SheetFooter className="flex-row gap-2 p-0">
              <Button type="button" variant="outline" onClick={() => setEditRow(null)}>
                Cancel
              </Button>
              <Button
                type="button"
                disabled={
                  patchMut.isPending ||
                  !editPrice ||
                  Number(editPrice) <= 0 ||
                  editStock.trim() === '' ||
                  Number(editStock) < 0 ||
                  !Number.isFinite(Number(editStock))
                }
                onClick={() => patchMut.mutate()}
              >
                Save
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
