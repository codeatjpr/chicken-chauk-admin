import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Pencil, Plus, Store } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useForm, type Resolver, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { ImageUploadField } from '@/components/forms/image-upload-field'
import { RichTextEditor } from '@/components/forms/rich-text-editor'
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api-error'
import { listCategoriesAll, listSubcategoriesAll } from '@/services/catalog-admin.service'
import {
  activateMasterProduct,
  createMasterProduct,
  deactivateMasterProduct,
  getProductVendorUsage,
  listMasterProducts,
  updateMasterProduct,
  uploadMasterProductImage,
} from '@/services/catalog-products.service'
import type { MasterProduct } from '@/types/catalog-product'

const productFormSchema = z.object({
  categoryId: z.string().uuid('Pick a category'),
  subCategoryId: z.union([z.string().uuid(), z.literal('')]).optional(),
  name: z.string().min(2).max(150),
  description: z.string().max(20000).optional(),
})

type ProductFormValues = z.infer<typeof productFormSchema>

export function ProductsPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<MasterProduct | null>(null)
  const [usageProduct, setUsageProduct] = useState<MasterProduct | null>(null)
  const [sheetImageFile, setSheetImageFile] = useState<File | null>(null)

  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<ProductFormValues | null>(null)
  const [toggleTarget, setToggleTarget] = useState<MasterProduct | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: categories } = useQuery({
    queryKey: ['catalog-categories-all'],
    queryFn: listCategoriesAll,
  })

  const productsQ = useQuery({
    queryKey: ['master-products', page, debouncedSearch, categoryId, activeFilter],
    queryFn: () =>
      listMasterProducts({
        page,
        limit,
        search: debouncedSearch || undefined,
        categoryId: categoryId || undefined,
        ...(activeFilter !== 'all' && { isActive: activeFilter === 'true' }),
      }),
  })

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(productFormSchema) as Resolver<ProductFormValues>,
    defaultValues: {
      categoryId: '',
      subCategoryId: '',
      name: '',
      description: '',
    },
  })

  const watchedCategoryId = form.watch('categoryId')
  const subCategoriesQ = useQuery({
    queryKey: ['catalog-subcategories', watchedCategoryId],
    queryFn: () => listSubcategoriesAll(watchedCategoryId),
    enabled: Boolean(watchedCategoryId) && sheetOpen,
  })

  useEffect(() => {
    if (!sheetOpen) return
    if (editing) {
      form.reset({
        categoryId: editing.categoryId,
        subCategoryId: editing.subCategoryId ?? '',
        name: editing.name,
        description: editing.description ?? '',
      })
    } else {
      const firstActive = (categories ?? []).find((c) => c.isActive)?.id ?? (categories ?? [])[0]?.id ?? ''
      form.reset({
        categoryId: firstActive,
        subCategoryId: '',
        name: '',
        description: '',
      })
    }
  }, [sheetOpen, editing, form, categories])

  const createMut = useMutation({
    mutationFn: createMasterProduct,
    onError: (e) => toast.error(getApiErrorMessage(e, 'Create failed')),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: ProductFormValues }) =>
      updateMasterProduct(id, {
        categoryId: body.categoryId,
        subCategoryId: body.subCategoryId?.trim() ? body.subCategoryId.trim() : null,
        name: body.name.trim(),
        description: body.description?.trim() || null,
      }),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Update failed')),
  })

  const usageQ = useQuery({
    queryKey: ['product-vendor-usage', usageProduct?.id],
    queryFn: () => getProductVendorUsage(usageProduct!.id),
    enabled: !!usageProduct,
  })

  function openCreate() {
    setEditing(null)
    setSheetImageFile(null)
    setSheetOpen(true)
  }

  function openEdit(p: MasterProduct) {
    setEditing(p)
    setSheetImageFile(null)
    setSheetOpen(true)
  }

  async function onSubmitForm(values: ProductFormValues) {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body: values })
        if (sheetImageFile) await uploadMasterProductImage(editing.id, sheetImageFile)
      } else {
        const p = await createMut.mutateAsync({
          categoryId: values.categoryId,
          ...(values.subCategoryId?.trim() && { subCategoryId: values.subCategoryId.trim() }),
          name: values.name.trim(),
          description: values.description?.trim() || undefined,
        })
        if (sheetImageFile) await uploadMasterProductImage(p.id, sheetImageFile)
      }
      void queryClient.invalidateQueries({ queryKey: ['master-products'] })
      toast.success(editing ? 'Product saved' : 'Product created')
      setSheetOpen(false)
      setEditing(null)
      setSheetImageFile(null)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Save failed'))
    }
  }

  async function confirmToggleProduct() {
    if (!toggleTarget) return
    const p = toggleTarget
    setToggleTarget(null)
    try {
      if (p.isActive) await deactivateMasterProduct(p.id)
      else await activateMasterProduct(p.id)
      void queryClient.invalidateQueries({ queryKey: ['master-products'] })
      toast.success(p.isActive ? 'Deactivated' : 'Activated')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Update failed'))
    }
  }

  async function onPickImage(p: MasterProduct, file: File | null) {
    if (!file) return
    try {
      await uploadMasterProductImage(p.id, file)
      void queryClient.invalidateQueries({ queryKey: ['master-products'] })
      toast.success('Image updated')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Upload failed'))
    }
  }

  const items = productsQ.data?.items ?? []
  const pr = productsQ.data

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Products</h1>
          <p className="text-muted-foreground text-sm">
            Master catalog — vendors set their own prices per shop when listing a product.
          </p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Add product
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Search and narrow the master product list.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Input
            placeholder="Search name…"
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
          <CardTitle>Catalog ({pr?.total ?? '—'} total)</CardTitle>
        </CardHeader>
        <CardContent>
          {productsQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No products match filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Image</th>
                      <th className="pb-2 font-medium">Name</th>
                      <th className="pb-2 font-medium">Category</th>
                      <th className="pb-2 font-medium">Sub</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((p) => (
                      <tr key={p.id} className="border-border/80 border-b">
                        <td className="py-2 pr-2">
                          {p.imageUrl ? (
                            <img
                              src={p.imageUrl}
                              alt=""
                              className="size-10 rounded-md object-cover"
                            />
                          ) : (
                            <div className="bg-muted size-10 rounded-md" />
                          )}
                        </td>
                        <td className="py-2 pr-4 font-medium">{p.name}</td>
                        <td className="text-muted-foreground py-2 pr-4">{p.category.name}</td>
                        <td className="text-muted-foreground py-2 pr-4">
                          {p.subCategory?.name ?? '—'}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant={p.isActive ? 'default' : 'secondary'}>
                            {p.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="py-2 text-right">
                          <div className="flex justify-end gap-1">
                            <label
                              className="text-muted-foreground hover:text-foreground inline-flex size-8 cursor-pointer items-center justify-center rounded-lg hover:bg-muted"
                              title="Upload image"
                            >
                              <input
                                type="file"
                                accept="image/*"
                                className="sr-only"
                                onChange={(e) => void onPickImage(p, e.target.files?.[0] ?? null)}
                              />
                              <ImagePlus className="size-3.5" />
                            </label>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => setUsageProduct(p)}
                              title="Vendors using this product"
                            >
                              <Store className="size-3.5" />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              onClick={() => openEdit(p)}
                              aria-label="Edit"
                            >
                              <Pencil className="size-3.5" />
                            </Button>
                            <Button type="button" variant="ghost" size="sm" onClick={() => setToggleTarget(p)}>
                              {p.isActive ? 'Deactivate' : 'Activate'}
                            </Button>
                          </div>
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
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o)
          if (!o) setEditing(null)
        }}
      >
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit product' : 'New product'}</SheetTitle>
            <SheetDescription>
              Master product metadata. Pricing is configured per vendor when they add this product to their shop.
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col overflow-hidden"
            onSubmit={form.handleSubmit((v) => {
              setPendingValues(v)
              setSaveConfirmOpen(true)
            })}
          >
            {/* Scrollable field area */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="p-cat">Category</Label>
              <select
                id="p-cat"
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                {...form.register('categoryId', {
                  onChange: () => {
                    form.setValue('subCategoryId', '', { shouldValidate: true })
                  },
                })}
              >
                <option value="" disabled>
                  Select…
                </option>
                {(categories ?? []).map((c) => (
                  <option key={c.id} value={c.id} disabled={!c.isActive && editing?.categoryId !== c.id}>
                    {c.name}
                    {!c.isActive ? ' (inactive)' : ''}
                  </option>
                ))}
              </select>
              {form.formState.errors.categoryId && (
                <p className="text-destructive text-xs">{form.formState.errors.categoryId.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-sub">Sub-category (optional)</Label>
              <select
                id="p-sub"
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                disabled={!watchedCategoryId || subCategoriesQ.isLoading}
                {...form.register('subCategoryId')}
              >
                <option value="">None</option>
                {(subCategoriesQ.data ?? [])
                  .filter(
                    (s) =>
                      s.isActive ||
                      (editing?.subCategoryId != null && s.id === editing.subCategoryId),
                  )
                  .map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                      {!s.isActive ? ' (inactive)' : ''}
                    </option>
                  ))}
              </select>
              {watchedCategoryId &&
              !subCategoriesQ.isLoading &&
              (subCategoriesQ.data?.filter((s) => s.isActive).length ?? 0) === 0 ? (
                <p className="text-muted-foreground text-xs">
                  No active sub-categories for this category. Add them under Sub-categories in the sidebar.
                </p>
              ) : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="p-name">Name</Label>
              <Input id="p-name" {...form.register('name')} />
              {form.formState.errors.name && (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Controller
                control={form.control}
                name="description"
                render={({ field }) => (
                  <RichTextEditor
                    value={field.value ?? ''}
                    onChange={field.onChange}
                    placeholder="Write a product description… supports bold, italic, lists."
                  />
                )}
              />
              {form.formState.errors.description && (
                <p className="text-destructive text-xs">{form.formState.errors.description.message}</p>
              )}
            </div>
            <ImageUploadField
              label="Image (optional)"
              file={sheetImageFile}
              onFileChange={setSheetImageFile}
              currentImageUrl={editing?.imageUrl}
              hint="JPEG/PNG. Selected image previews before save. You can also use the row upload button."
            />
            </div>{/* end scrollable area */}

            {/* Sticky footer — always visible */}
            <div className="border-t px-4 py-3 flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setSheetOpen(false)
                  setEditing(null)
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={createMut.isPending || updateMut.isPending || form.formState.isSubmitting}>
                {editing ? 'Save' : 'Create'}
              </Button>
            </div>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{editing ? 'Save product?' : 'Create product?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingValues ? (
                <>
                  <strong>{pendingValues.name.trim()}</strong>
                  {sheetImageFile ? ' · new image will upload after save.' : ''}
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setPendingValues(null)}>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={createMut.isPending || updateMut.isPending}
              onClick={() => {
                if (!pendingValues) return
                const v = pendingValues
                setSaveConfirmOpen(false)
                void onSubmitForm(v)
                setPendingValues(null)
              }}
            >
              {editing ? 'Confirm save' : 'Confirm create'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleTarget?.isActive ? 'Deactivate product?' : 'Activate product?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.isActive
                ? `“${toggleTarget?.name}” will be hidden from the master catalog until activated again.`
                : `“${toggleTarget?.name}” will be available for vendors to list again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmToggleProduct()}>
              {toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!usageProduct} onOpenChange={(o) => !o && setUsageProduct(null)}>
        <SheetContent className="flex flex-col sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Vendors</SheetTitle>
            <SheetDescription>
              {usageProduct ? `“${usageProduct.name}” is listed by these shops.` : ''}
            </SheetDescription>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-4 pb-4">
            {usageQ.isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : usageQ.data ? (
              <p className="text-muted-foreground mb-3 text-sm">
                {usageQ.data.vendorCount} vendor{usageQ.data.vendorCount === 1 ? '' : 's'}
              </p>
            ) : null}
            {usageQ.data && usageQ.data.vendors.length > 0 && (
              <ul className="space-y-2 text-sm">
                {usageQ.data.vendors.map((v) => (
                  <li
                    key={v.id}
                    className="border-border flex flex-wrap items-center justify-between gap-2 rounded-lg border p-2"
                  >
                    <span className="font-medium">{v.vendor.name}</span>
                    <span className="text-muted-foreground text-xs">
                      {v.vendor.city} · ₹{v.price.toFixed(0)} · stock {v.stock}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {usageQ.data && usageQ.data.vendors.length === 0 && (
              <p className="text-muted-foreground text-sm">No vendor has listed this product yet.</p>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
