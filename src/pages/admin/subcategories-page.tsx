import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ImagePlus, Pencil, Plus } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { z } from 'zod'
import { ImageUploadField } from '@/components/forms/image-upload-field'
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
import {
  activateSubCategory,
  createSubCategory,
  deactivateSubCategory,
  deleteSubCategory,
  listCategoriesAll,
  listSubcategoriesAll,
  updateSubCategory,
  uploadSubCategoryImage,
} from '@/services/catalog-admin.service'
import type { CatalogSubCategory } from '@/types/catalog'

const subFormSchema = z.object({
  categoryId: z.string().uuid('Pick a category'),
  name: z.string().min(2, 'Min 2 characters').max(100),
  sortOrder: z.coerce.number().int().min(0),
})

type SubFormValues = z.infer<typeof subFormSchema>

export function SubcategoriesPage() {
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()
  const categoryFilter = searchParams.get('categoryId') ?? ''

  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'true' | 'false'>('all')

  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogSubCategory | null>(null)
  const [sheetImageFile, setSheetImageFile] = useState<File | null>(null)
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<SubFormValues | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CatalogSubCategory | null>(null)
  const [toggleTarget, setToggleTarget] = useState<CatalogSubCategory | null>(null)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['catalog-categories-all'],
    queryFn: listCategoriesAll,
  })

  useEffect(() => {
    if (!categories?.length) return
    if (categoryFilter && categories.some((c) => c.id === categoryFilter)) return
    const id = categories.find((c) => c.isActive)?.id ?? categories[0].id
    setSearchParams({ categoryId: id }, { replace: true })
  }, [categories, categoryFilter, setSearchParams])

  const subCategoriesQ = useQuery({
    queryKey: ['catalog-subcategories', categoryFilter],
    queryFn: () => listSubcategoriesAll(categoryFilter),
    enabled: Boolean(categoryFilter),
  })

  const categoryById = useMemo(() => {
    const m = new Map<string, string>()
    for (const c of categories ?? []) m.set(c.id, c.name)
    return m
  }, [categories])

  const filteredRows = useMemo(() => {
    let rows = subCategoriesQ.data ?? []
    if (activeFilter === 'true') rows = rows.filter((s) => s.isActive)
    if (activeFilter === 'false') rows = rows.filter((s) => !s.isActive)
    if (debouncedSearch) {
      const q = debouncedSearch.toLowerCase()
      rows = rows.filter((s) => s.name.toLowerCase().includes(q))
    }
    return rows
  }, [subCategoriesQ.data, activeFilter, debouncedSearch])

  const form = useForm<SubFormValues>({
    resolver: zodResolver(subFormSchema) as Resolver<SubFormValues>,
    defaultValues: { categoryId: '', name: '', sortOrder: 0 },
  })

  useEffect(() => {
    if (!sheetOpen) return
    if (editing) {
      form.reset({
        categoryId: editing.categoryId,
        name: editing.name,
        sortOrder: editing.sortOrder,
      })
    } else {
      const subs = subCategoriesQ.data ?? []
      const nextOrder = subs.length ? Math.max(...subs.map((s) => s.sortOrder)) + 1 : 0
      const cat =
        (categories ?? []).find((c) => c.id === categoryFilter)?.id ??
        (categories ?? []).find((c) => c.isActive)?.id ??
        (categories ?? [])[0]?.id ??
        ''
      form.reset({ categoryId: cat, name: '', sortOrder: nextOrder })
    }
    setSheetImageFile(null)
  }, [sheetOpen, editing, form, categories, categoryFilter, subCategoriesQ.data])

  const createMut = useMutation({
    mutationFn: (args: { categoryId: string; name: string; sortOrder: number }) =>
      createSubCategory(args.categoryId, { name: args.name, sortOrder: args.sortOrder }),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Create failed')),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: SubFormValues }) =>
      updateSubCategory(id, {
        name: body.name.trim(),
        sortOrder: body.sortOrder,
      }),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Update failed')),
  })

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(row: CatalogSubCategory) {
    setEditing(row)
    setSheetOpen(true)
  }

  async function onSubmitForm(values: SubFormValues) {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body: values })
        if (sheetImageFile) await uploadSubCategoryImage(editing.id, sheetImageFile)
      } else {
        const row = await createMut.mutateAsync({
          categoryId: values.categoryId,
          name: values.name.trim(),
          sortOrder: values.sortOrder,
        })
        if (sheetImageFile) await uploadSubCategoryImage(row.id, sheetImageFile)
      }
      void queryClient.invalidateQueries({ queryKey: ['catalog-subcategories'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success(editing ? 'Sub-category saved' : 'Sub-category created')
      setSheetOpen(false)
      setEditing(null)
      setSheetImageFile(null)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Save failed'))
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    try {
      await deleteSubCategory(id)
      void queryClient.invalidateQueries({ queryKey: ['catalog-subcategories'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success('Sub-category deleted')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Delete failed'))
    }
  }

  async function confirmToggle() {
    if (!toggleTarget) return
    const s = toggleTarget
    setToggleTarget(null)
    try {
      if (s.isActive) await deactivateSubCategory(s.id)
      else await activateSubCategory(s.id)
      void queryClient.invalidateQueries({ queryKey: ['catalog-subcategories'] })
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success(s.isActive ? 'Deactivated' : 'Activated')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Update failed'))
    }
  }

  async function onPickImage(row: CatalogSubCategory, file: File | null) {
    if (!file) return
    try {
      await uploadSubCategoryImage(row.id, file)
      void queryClient.invalidateQueries({ queryKey: ['catalog-subcategories'] })
      toast.success('Image updated')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Upload failed'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Sub-categories</h1>
          <p className="text-muted-foreground text-sm">
            Chips on customer category pages. Link master products to a sub-category when editing products.
          </p>
        </div>
        <Button
          type="button"
          onClick={openCreate}
          className="gap-2"
          disabled={!categoryFilter || !(categories ?? []).length}
        >
          <Plus className="size-4" aria-hidden />
          Add sub-category
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Choose a parent category, then search or filter by status.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor="sub-filter-cat" className="text-xs">
              Category
            </Label>
            <select
              id="sub-filter-cat"
              className="border-input bg-background h-8 min-w-[200px] rounded-lg border px-2 text-sm"
              value={categoryFilter}
              disabled={categoriesLoading}
              onChange={(e) => {
                const id = e.target.value
                if (id) setSearchParams({ categoryId: id }, { replace: true })
              }}
            >
              {(categories ?? []).map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                  {!c.isActive ? ' (inactive)' : ''}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-search" className="text-xs">
              Search name
            </Label>
            <Input
              id="sub-search"
              placeholder="Contains…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="sub-active" className="text-xs">
              Status
            </Label>
            <select
              id="sub-active"
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={activeFilter}
              onChange={(e) => setActiveFilter(e.target.value as 'all' | 'true' | 'false')}
            >
              <option value="all">Active: any</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            {categoryFilter ? categoryById.get(categoryFilter) ?? 'Sub-categories' : 'Sub-categories'}
          </CardTitle>
          <CardDescription>
            {(subCategoriesQ.data?.length ?? 0)} total in this category
            {debouncedSearch || activeFilter !== 'all'
              ? ` · ${filteredRows.length} shown after filters`
              : ''}
            .
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categoriesLoading || !categoryFilter ? (
            <Skeleton className="h-48 w-full" />
          ) : subCategoriesQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : filteredRows.length === 0 ? (
            <p className="text-muted-foreground text-sm">No sub-categories match filters.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="pb-2 font-medium">Image</th>
                    <th className="pb-2 font-medium">Name</th>
                    <th className="pb-2 font-medium">Sort</th>
                    <th className="pb-2 font-medium">Status</th>
                    <th className="pb-2 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRows.map((s) => (
                    <tr key={s.id} className="border-border/80 border-b">
                      <td className="py-2 pr-2">
                        {s.imageUrl ? (
                          <img src={s.imageUrl} alt="" className="size-10 rounded-full object-cover" />
                        ) : (
                          <div className="bg-muted size-10 rounded-full" />
                        )}
                      </td>
                      <td className="py-2 pr-4 font-medium">{s.name}</td>
                      <td className="text-muted-foreground py-2 pr-4">{s.sortOrder}</td>
                      <td className="py-2 pr-4">
                        <Badge variant={s.isActive ? 'default' : 'secondary'}>
                          {s.isActive ? 'Active' : 'Inactive'}
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
                              onChange={(e) => void onPickImage(s, e.target.files?.[0] ?? null)}
                            />
                            <ImagePlus className="size-3.5" />
                          </label>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => openEdit(s)}
                            aria-label="Edit"
                          >
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button type="button" variant="ghost" size="sm" onClick={() => setToggleTarget(s)}>
                            {s.isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-destructive"
                            onClick={() => setDeleteTarget(s)}
                          >
                            Delete
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

      <Sheet
        open={sheetOpen}
        onOpenChange={(o) => {
          setSheetOpen(o)
          if (!o) setEditing(null)
        }}
      >
        <SheetContent className="flex flex-col sm:max-w-md">
          <SheetHeader>
            <SheetTitle>{editing ? 'Edit sub-category' : 'New sub-category'}</SheetTitle>
            <SheetDescription>
              {editing
                ? 'Update name and sort order; optional image replaces the chip photo on S3.'
                : 'Creates a sub-category under the selected parent category.'}
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 overflow-hidden"
            onSubmit={form.handleSubmit((v) => {
              setPendingValues(v)
              setSaveConfirmOpen(true)
            })}
          >
            <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="sub-form-cat">Parent category</Label>
                <select
                  id="sub-form-cat"
                  className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                  disabled={!!editing}
                  {...form.register('categoryId')}
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
                <Label htmlFor="sub-form-name">Name</Label>
                <Input id="sub-form-name" {...form.register('name')} />
                {form.formState.errors.name && (
                  <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="sub-form-order">Sort order</Label>
                <Input
                  id="sub-form-order"
                  type="number"
                  min={0}
                  {...form.register('sortOrder', { valueAsNumber: true })}
                />
              </div>
              <ImageUploadField
                label="Image (optional)"
                file={sheetImageFile}
                onFileChange={setSheetImageFile}
                currentImageUrl={editing?.imageUrl}
                hint="JPEG/PNG. Shown as the round chip on the storefront."
              />
            </div>
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
            <AlertDialogTitle>{editing ? 'Save sub-category?' : 'Create sub-category?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingValues ? (
                <>
                  <strong>{pendingValues.name.trim()}</strong>
                  {' · '}
                  sort {pendingValues.sortOrder}
                  {sheetImageFile ? ' · image will upload after save.' : ''}
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

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete sub-category?</AlertDialogTitle>
            <AlertDialogDescription>
              Removes <strong>{deleteTarget?.name}</strong>. Products using it will have their sub-category cleared.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDelete()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {toggleTarget?.isActive ? 'Deactivate sub-category?' : 'Activate sub-category?'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.isActive
                ? `“${toggleTarget?.name}” will be hidden from customer filters until activated again.`
                : `“${toggleTarget?.name}” will appear on the category page again.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmToggle()}>
              {toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
