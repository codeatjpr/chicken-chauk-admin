import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
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
import { listCategoriesAll } from '@/services/catalog-admin.service'
import {
  createProductVariant,
  deleteProductVariant,
  getMasterProductById,
  listMasterProducts,
  updateProductVariant,
} from '@/services/catalog-products.service'
import type { MasterProduct, ProductVariantRow } from '@/types/catalog-product'

const UNITS = ['KG', 'GRAMS', 'PIECES', 'DOZEN'] as const

const variantFormSchema = z.object({
  name: z.string().min(1, 'Required').max(120),
  weight: z.coerce.number().positive('Must be > 0'),
  unit: z.enum(UNITS),
  sortOrder: z.coerce.number().int().min(0),
  isActive: z.boolean(),
})

type VariantFormValues = z.infer<typeof variantFormSchema>

function variantLabel(v: Pick<ProductVariantRow, 'name' | 'weight' | 'unit'>) {
  return `${v.name} · ${v.weight} ${v.unit}`
}

export function ProductVariantsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 15
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all')

  const [selectedProduct, setSelectedProduct] = useState<MasterProduct | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editingVariant, setEditingVariant] = useState<ProductVariantRow | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: categories } = useQuery({
    queryKey: ['catalog-categories-all'],
    queryFn: listCategoriesAll,
  })

  const productsQ = useQuery({
    queryKey: ['master-products', page, debouncedSearch, categoryId, activeFilter, 'variants-picker'],
    queryFn: () =>
      listMasterProducts({
        page,
        limit,
        search: debouncedSearch || undefined,
        categoryId: categoryId || undefined,
        ...(activeFilter !== 'all' && { isActive: activeFilter === 'true' }),
      }),
  })

  const detailQ = useQuery({
    queryKey: ['master-product-detail', selectedProduct?.id],
    queryFn: () => getMasterProductById(selectedProduct!.id),
    enabled: !!selectedProduct,
  })

  const form = useForm<VariantFormValues>({
    resolver: zodResolver(variantFormSchema) as Resolver<VariantFormValues>,
    defaultValues: {
      name: '',
      weight: 0.5,
      unit: 'GRAMS',
      sortOrder: 0,
      isActive: true,
    },
  })

  useEffect(() => {
    if (!sheetOpen) return
    const variants = detailQ.data?.variants ?? []
    const nextSort =
      editingVariant?.sortOrder ??
      (variants.length ? Math.max(...variants.map((v) => v.sortOrder)) + 1 : 0)
    if (editingVariant) {
      form.reset({
        name: editingVariant.name,
        weight: editingVariant.weight,
        unit: editingVariant.unit as VariantFormValues['unit'],
        sortOrder: editingVariant.sortOrder,
        isActive: editingVariant.isActive,
      })
    } else {
      form.reset({
        name: '',
        weight: 0.5,
        unit: 'GRAMS',
        sortOrder: nextSort,
        isActive: true,
      })
    }
  }, [sheetOpen, editingVariant, detailQ.data?.variants, form])

  const createMut = useMutation({
    mutationFn: (values: VariantFormValues) =>
      createProductVariant(selectedProduct!.id, {
        name: values.name.trim(),
        weight: values.weight,
        unit: values.unit,
        sortOrder: values.sortOrder,
        isActive: values.isActive,
      }),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Create failed')),
  })

  const updateMut = useMutation({
    mutationFn: ({
      variantId,
      values,
    }: {
      variantId: string
      values: VariantFormValues
    }) =>
      updateProductVariant(selectedProduct!.id, variantId, {
        name: values.name.trim(),
        weight: values.weight,
        unit: values.unit,
        sortOrder: values.sortOrder,
        isActive: values.isActive,
      }),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Update failed')),
  })

  const deleteMut = useMutation({
    mutationFn: (variantId: string) => deleteProductVariant(selectedProduct!.id, variantId),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Delete failed')),
  })

  function openCreateVariant() {
    if (!selectedProduct) return
    setEditingVariant(null)
    setSheetOpen(true)
  }

  function openEditVariant(v: ProductVariantRow) {
    setEditingVariant(v)
    setSheetOpen(true)
  }

  async function onSubmitVariant(values: VariantFormValues) {
    if (!selectedProduct) return
    try {
      if (editingVariant) {
        await updateMut.mutateAsync({ variantId: editingVariant.id, values })
      } else {
        await createMut.mutateAsync(values)
      }
      void queryClient.invalidateQueries({ queryKey: ['master-product-detail', selectedProduct.id] })
      void queryClient.invalidateQueries({ queryKey: ['master-products'] })
      toast.success(editingVariant ? 'Variant updated' : 'Variant created')
      setSheetOpen(false)
      setEditingVariant(null)
    } catch {
      /* toast in mutation */
    }
  }

  async function onDeleteVariant(v: ProductVariantRow) {
    if (!selectedProduct) return
    if (
      !window.confirm(
        `Delete variant “${variantLabel(v)}”? This fails if any vendor still lists this SKU.`,
      )
    ) {
      return
    }
    try {
      await deleteMut.mutateAsync(v.id)
      void queryClient.invalidateQueries({ queryKey: ['master-product-detail', selectedProduct.id] })
      void queryClient.invalidateQueries({ queryKey: ['master-products'] })
      toast.success('Variant deleted')
    } catch {
      /* toast in mutation */
    }
  }

  const items = productsQ.data?.items ?? []
  const pr = productsQ.data
  const variants = detailQ.data?.variants ?? []

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading flex items-center gap-2 text-2xl font-semibold tracking-tight">
            <Layers className="size-6" aria-hidden />
            Product variants
          </h1>
          <p className="text-muted-foreground text-sm">
            Pick a master product, then create or edit SKUs (cut, pack size, unit). Vendor listings attach to a
            variant.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Find product</CardTitle>
          <CardDescription>Search the catalog and select one row to manage its variants.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Search product name…"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              setPage(1)
            }}
            className="max-w-xs"
          />
          <select
            className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
            value={categoryId}
            onChange={(e) => {
              setCategoryId(e.target.value)
              setPage(1)
            }}
          >
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
                {!c.isActive ? ' (inactive)' : ''}
              </option>
            ))}
          </select>
          <select
            className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
            value={activeFilter}
            onChange={(e) => {
              setActiveFilter(e.target.value as 'all' | 'true' | 'false')
              setPage(1)
            }}
          >
            <option value="all">Active: any</option>
            <option value="true">Active only</option>
            <option value="false">Inactive only</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Products</CardTitle>
          <CardDescription>{pr ? `${pr.total} total` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {productsQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No products match.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Select</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr
                        key={p.id}
                        className={`border-border/80 border-b ${selectedProduct?.id === p.id ? 'bg-muted/40' : ''}`}
                      >
                        <td className="py-2 pr-4 font-medium">{p.name}</td>
                        <td className="text-muted-foreground py-2 pr-4">{p.category.name}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={p.isActive ? 'default' : 'secondary'}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <Button
                            type="button"
                            size="sm"
                            variant={selectedProduct?.id === p.id ? 'default' : 'outline'}
                            onClick={() => setSelectedProduct(p)}
                          >
                            Manage variants
                          </Button>
                        </td>
                      </tr>
                    ))}
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
                      onClick={() => setPage((x) => Math.max(1, x - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!pr.hasNext}
                      onClick={() => setPage((x) => x + 1)}
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

      {selectedProduct && (
        <Card>
          <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3 space-y-0">
            <div>
              <CardTitle>{selectedProduct.name}</CardTitle>
              <CardDescription>
                {selectedProduct.category.name} · unit {selectedProduct.unit}
                {!selectedProduct.isActive && (
                  <span className="text-destructive"> · Inactive product — variants still editable</span>
                )}
              </CardDescription>
            </div>
            <Button type="button" className="gap-2" onClick={openCreateVariant}>
              <Plus className="size-4" aria-hidden />
              Add variant
            </Button>
          </CardHeader>
          <CardContent>
            {detailQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : variants.length === 0 ? (
              <p className="text-muted-foreground text-sm">No variants yet. Add cuts/pack sizes here.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">SKU label</th>
                      <th className="pb-2 font-medium">Sort</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {variants.map((v) => (
                      <tr key={v.id} className="border-border/80 border-b">
                        <td className="py-2 pr-4">{variantLabel(v)}</td>
                        <td className="text-muted-foreground py-2 pr-4">{v.sortOrder}</td>
                        <td className="py-2 pr-4">
                          <Badge variant={v.isActive ? 'secondary' : 'outline'}>
                            {v.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <Button type="button" variant="ghost" size="icon-sm" onClick={() => openEditVariant(v)}>
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-destructive"
                              onClick={() => void onDeleteVariant(v)}
                              disabled={deleteMut.isPending}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o)
          if (!o) setEditingVariant(null)
        }}
      >
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editingVariant ? 'Edit variant' : 'New variant'}</SheetTitle>
            <SheetDescription>
              {selectedProduct ? `Product: ${selectedProduct.name}` : ''}. Name + weight + unit must be unique per
              product.
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 px-4 pb-4"
            onSubmit={form.handleSubmit((vals) => void onSubmitVariant(vals))}
          >
            <div className="space-y-2">
              <Label htmlFor="var-name">Display name</Label>
              <Input id="var-name" placeholder="e.g. Boneless, Curry cut" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-weight">Weight / pack size</Label>
              <Input id="var-weight" type="number" step="any" min={0} {...form.register('weight')} />
              {form.formState.errors.weight && (
                <p className="text-destructive text-xs">{form.formState.errors.weight.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-unit">Unit</Label>
              <select
                id="var-unit"
                className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
                {...form.register('unit')}
              >
                {UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="var-sort">Sort order</Label>
              <Input id="var-sort" type="number" min={0} {...form.register('sortOrder', { valueAsNumber: true })} />
            </div>
            <div className="flex items-center gap-2">
              <input
                id="var-active"
                type="checkbox"
                className="size-4"
                checked={form.watch('isActive')}
                onChange={(e) => form.setValue('isActive', e.target.checked, { shouldValidate: true })}
              />
              <Label htmlFor="var-active" className="font-normal">
                Active (shown to customers when product is active)
              </Label>
            </div>
            <SheetFooter className="mt-auto flex-row gap-2 p-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSheetOpen(false)
                  setEditingVariant(null)
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={createMut.isPending || updateMut.isPending || form.formState.isSubmitting}
              >
                {editingVariant ? 'Save' : 'Create'}
              </Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </div>
  )
}
