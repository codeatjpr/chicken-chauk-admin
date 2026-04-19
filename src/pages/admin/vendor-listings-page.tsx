import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CheckCircle2, Eye, ImagePlus, Pencil, Plus, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
import { RichTextEditor } from '@/components/forms/rich-text-editor'
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
import { listMasterProducts } from '@/services/catalog-products.service'
import { listAllVendors } from '@/services/vendors-admin.service'
import type { MasterProduct } from '@/types/catalog-product'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

const QUANTITY_UNITS = [
  { value: 'g',   label: 'g — grams' },
  { value: 'kg',  label: 'kg — kilograms' },
  { value: 'ml',  label: 'ml — millilitres' },
  { value: 'l',   label: 'l — litres' },
  { value: 'pcs', label: 'pcs — pieces' },
  { value: 'doz', label: 'doz — dozen' },
  { value: 'nos', label: 'nos — numbers' },
]

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
  const [selectedVendorName, setSelectedVendorName] = useState('')
  const [selectedProductName, setSelectedProductName] = useState('')
  const [createPrice, setCreatePrice] = useState('')
  const [createMrp, setCreateMrp] = useState('')
  const [createSort, setCreateSort] = useState('0')
  const [createQtyValue, setCreateQtyValue] = useState('')
  const [createQtyUnit, setCreateQtyUnit] = useState('')
  const [createDescription, setCreateDescription] = useState('')
  const [createPieces, setCreatePieces] = useState('')
  const [createServings, setCreateServings] = useState('')
  const [editPrice, setEditPrice] = useState('')
  const [editMrp, setEditMrp] = useState('')
  const [editSort, setEditSort] = useState('')
  const [editStock, setEditStock] = useState('')
  const [editAvailable, setEditAvailable] = useState(false)
  const [editQtyValue, setEditQtyValue] = useState('')
  const [editQtyUnit, setEditQtyUnit] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPieces, setEditPieces] = useState('')
  const [editServings, setEditServings] = useState('')

  // Confirmation dialog state
  const [createConfirmOpen, setCreateConfirmOpen] = useState(false)
  const [editConfirmOpen, setEditConfirmOpen] = useState(false)
  const [deleteConfirmTarget, setDeleteConfirmTarget] = useState<{
    id: string
    productName: string
    vendorName: string
    fromDetailSheet?: boolean
  } | null>(null)

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
        productId: createProductId.trim(),
        price: Number(createPrice),
        mrp: createMrp.trim() ? Number(createMrp) : null,
        sortOrder: Number(createSort) || 0,
        quantityValue: createQtyValue.trim() ? Number(createQtyValue) : null,
        quantityUnit: createQtyUnit.trim() || null,
        description: createDescription.trim() || null,
        pieces: createPieces.trim() || null,
        servings: createServings.trim() || null,
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
        quantityValue: editQtyValue.trim() ? Number(editQtyValue) : null,
        quantityUnit: editQtyUnit.trim() || null,
        description: editDescription.trim() || null,
        pieces: editPieces.trim() || null,
        servings: editServings.trim() || null,
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
    setSelectedVendorName('')
    setCreateProductId('')
    setCreateProductSearch('')
    setSelectedProductName('')
    setCreatePrice('')
    setCreateMrp('')
    setCreateSort('0')
    setCreateQtyValue('')
    setCreateQtyUnit('')
    setCreateDescription('')
    setCreatePieces('')
    setCreateServings('')
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
    setEditQtyValue(row.quantityValue != null ? String(row.quantityValue) : '')
    setEditQtyUnit(row.quantityUnit ?? '')
    setEditDescription(row.description ?? '')
    setEditPieces(row.pieces ?? '')
    setEditServings(row.servings ?? '')
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
            <div className="min-w-48 flex-1 space-y-1">
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
            <div className="min-w-40 flex-1 space-y-1">
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
            <div className="min-w-40 flex-1 space-y-1">
              <Label htmlFor="vl-product">Product name</Label>
              <Input
                id="vl-product"
                placeholder="Matches master product name"
                value={listProductSearch}
                onChange={(e) => {
                  setListProductSearch(e.target.value)
                  setPage(1)
                }}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-40 flex-1 space-y-1">
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
                      <th className="pb-2 font-medium">Product</th>
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
                                onClick={() => setDeleteConfirmTarget({
                                  id: row.id,
                                  productName: row.product.name,
                                  vendorName: row.vendor.name,
                                })}
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
        <SheetContent className="flex max-h-dvh flex-col sm:max-w-lg">
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
                    <p className="text-muted-foreground text-xs">Product</p>
                    <p className="font-medium">{detailQ.data.product.name}</p>
                    <p className="text-muted-foreground text-xs">{detailQ.data.product.category.name}</p>
                    <p className="text-muted-foreground mt-1 font-mono text-[11px]">
                      product {detailQ.data.productId}
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
                    onClick={() => setDeleteConfirmTarget({
                      id: detailQ.data!.id,
                      productName: detailQ.data!.product.name,
                      vendorName: detailQ.data!.vendor.name,
                      fromDetailSheet: true,
                    })}
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
        <SheetContent className="flex max-h-dvh flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>New vendor listing</SheetTitle>
            <SheetDescription>
              Search vendor and product, set admin price. Stock starts at 0 until the vendor updates it.
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
            <div className="space-y-1">
              <Label>Find vendor</Label>
              {createVendorId ? (
                <div className="bg-muted flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    {selectedVendorName}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setCreateVendorId('')
                      setCreateVendorSearch('')
                      setSelectedVendorName('')
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <>
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
                              setSelectedVendorName(`${v.name} · ${v.city}`)
                              setCreateVendorSearch('')
                            }}
                          >
                            <span className="font-medium">{v.name}</span>
                            <span className="text-muted-foreground text-xs"> · {v.city}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )}
            </div>
            <div className="space-y-1">
              <Label>Find product</Label>
              {createProductId ? (
                <div className="bg-muted flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-sm">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="size-3.5 text-emerald-500" />
                    {selectedProductName}
                  </span>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={() => {
                      setCreateProductId('')
                      setCreateProductSearch('')
                      setSelectedProductName('')
                    }}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ) : (
                <>
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
                              setSelectedProductName(`${p.name} · ${p.category.name}`)
                              setCreateProductSearch('')
                            }}
                          >
                            <span className="font-medium">{p.name}</span>
                            <span className="text-muted-foreground text-xs"> · {p.category.name}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </>
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
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Quantity amount</Label>
                <Input
                  type="number"
                  min={0}
                  step="any"
                  placeholder={createQtyUnit ? `e.g. 200 ${createQtyUnit}` : 'e.g. 200'}
                  value={createQtyValue}
                  onChange={(e) => setCreateQtyValue(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Unit</Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
                  value={createQtyUnit}
                  onChange={(e) => setCreateQtyUnit(e.target.value)}
                >
                  <option value="">— none —</option>
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <RichTextEditor
                value={createDescription}
                onChange={setCreateDescription}
                placeholder="Vendor-specific description, e.g. 'Our farm-fresh cut, delivered same day'"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Pieces (optional)</Label>
                <Input
                  placeholder="e.g. 8-10 pieces"
                  value={createPieces}
                  onChange={(e) => setCreatePieces(e.target.value)}
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Servings (optional)</Label>
                <Input
                  placeholder="e.g. Serves 2-3"
                  value={createServings}
                  onChange={(e) => setCreateServings(e.target.value)}
                />
              </div>
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
                  !createPrice ||
                  Number(createPrice) <= 0
                }
                onClick={() => setCreateConfirmOpen(true)}
              >
                Review & create
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Create confirmation dialog ───────────────────────────────────── */}
      <AlertDialog open={createConfirmOpen} onOpenChange={setCreateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm new listing</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Please review the listing before creating:</p>
                <ul className="border-border space-y-1 rounded-lg border bg-muted/40 px-4 py-3 text-foreground">
                  <li><span className="text-muted-foreground">Vendor:</span> {selectedVendorName}</li>
                  <li><span className="text-muted-foreground">Product:</span> {selectedProductName}</li>
                  <li><span className="text-muted-foreground">Price:</span> ₹{createPrice}</li>
                  {createMrp && <li><span className="text-muted-foreground">MRP:</span> ₹{createMrp}</li>}
                  {createQtyValue && <li><span className="text-muted-foreground">Quantity:</span> {createQtyValue} {createQtyUnit}</li>}
                  {createPieces && <li><span className="text-muted-foreground">Pieces:</span> {createPieces}</li>}
                  {createServings && <li><span className="text-muted-foreground">Servings:</span> {createServings}</li>}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={createMut.isPending}
              onClick={() => { setCreateConfirmOpen(false); createMut.mutate() }}
            >
              Confirm & create
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!editRow} onOpenChange={(o) => !o && setEditRow(null)}>
        <SheetContent className="flex max-h-dvh flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Update vendor product</SheetTitle>
            <SheetDescription className="font-mono text-xs">{editRow?.id}</SheetDescription>
            {editRow && (
              <p className="text-muted-foreground pt-1 text-xs">
                {editRow.vendor.name} · {editRow.product.name}
              </p>
            )}
          </SheetHeader>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 pb-4">
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
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Quantity amount</Label>
                <Input type="number" min={0} step="any" placeholder={editQtyUnit ? `e.g. 200 ${editQtyUnit}` : 'e.g. 200'} value={editQtyValue} onChange={(e) => setEditQtyValue(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Quantity unit</Label>
                <select
                  className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
                  value={editQtyUnit}
                  onChange={(e) => setEditQtyUnit(e.target.value)}
                >
                  <option value="">— none —</option>
                  {QUANTITY_UNITS.map((u) => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <RichTextEditor
                value={editDescription}
                onChange={setEditDescription}
                placeholder="Vendor-specific description, e.g. 'Our farm-fresh cut, delivered same day'"
              />
            </div>
            <div className="flex gap-2">
              <div className="flex-1 space-y-1">
                <Label>Pieces (optional)</Label>
                <Input placeholder="e.g. 8-10 pieces" value={editPieces} onChange={(e) => setEditPieces(e.target.value)} />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Servings (optional)</Label>
                <Input placeholder="e.g. Serves 2-3" value={editServings} onChange={(e) => setEditServings(e.target.value)} />
              </div>
            </div>
            <SheetFooter className="flex-row gap-2 p-0 pt-2">
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
                onClick={() => setEditConfirmOpen(true)}
              >
                Review & save
              </Button>
            </SheetFooter>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Edit confirmation dialog ─────────────────────────────────────── */}
      <AlertDialog open={editConfirmOpen} onOpenChange={setEditConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm listing update</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>Save these changes for <strong>{editRow?.product.name}</strong> at <strong>{editRow?.vendor.name}</strong>?</p>
                <ul className="border-border space-y-1 rounded-lg border bg-muted/40 px-4 py-3 text-foreground">
                  <li><span className="text-muted-foreground">Price:</span> ₹{editPrice}</li>
                  {editMrp && <li><span className="text-muted-foreground">MRP:</span> ₹{editMrp}</li>}
                  <li><span className="text-muted-foreground">Stock:</span> {editStock}</li>
                  <li><span className="text-muted-foreground">Available:</span> {editAvailable ? 'Yes' : 'No'}</li>
                  {editQtyValue && <li><span className="text-muted-foreground">Quantity:</span> {editQtyValue} {editQtyUnit}</li>}
                  {editPieces && <li><span className="text-muted-foreground">Pieces:</span> {editPieces}</li>}
                  {editServings && <li><span className="text-muted-foreground">Servings:</span> {editServings}</li>}
                </ul>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={patchMut.isPending}
              onClick={() => { setEditConfirmOpen(false); patchMut.mutate() }}
            >
              Confirm & save
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete confirmation dialog ───────────────────────────────────── */}
      <AlertDialog
        open={!!deleteConfirmTarget}
        onOpenChange={(o) => { if (!o) setDeleteConfirmTarget(null) }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete listing?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently remove the listing for{' '}
              <strong>{deleteConfirmTarget?.productName}</strong> at{' '}
              <strong>{deleteConfirmTarget?.vendorName}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={delMut.isPending}
              onClick={() => {
                if (!deleteConfirmTarget) return
                const { id, fromDetailSheet } = deleteConfirmTarget
                setDeleteConfirmTarget(null)
                delMut.mutate(id, {
                  onSuccess: () => {
                    if (fromDetailSheet) setDetailListingId(null)
                  },
                })
              }}
            >
              Delete listing
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

