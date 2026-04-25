import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GripVertical, Layers, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm, type Resolver } from 'react-hook-form'
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
import { Button, buttonVariants } from '@/components/ui/button'
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
  activateCategory,
  createCategory,
  deactivateCategory,
  deleteCategory,
  listCategoriesAll,
  reorderCategories,
  updateCategory,
  uploadCategoryImage,
} from '@/services/catalog-admin.service'
import type { CatalogCategory } from '@/types/catalog'
import { cn } from '@/lib/utils'

const categoryFormSchema = z.object({
  name: z.string().min(2, 'Min 2 characters').max(100),
  tagline: z.string().max(200).optional(),
  sortOrder: z.coerce.number().int().min(0),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogCategory | null>(null)
  const [items, setItems] = useState<CatalogCategory[]>([])
  const [imageFile, setImageFile] = useState<File | null>(null)

  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)
  const [pendingValues, setPendingValues] = useState<CategoryFormValues | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CatalogCategory | null>(null)
  const [toggleTarget, setToggleTarget] = useState<CatalogCategory | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['catalog-categories-all'],
    queryFn: listCategoriesAll,
  })

  const sorted = useMemo(() => {
    if (!data) return []
    return [...data].sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name))
  }, [data])

  useEffect(() => {
    setItems(sorted)
  }, [sorted])

  const form = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema) as Resolver<CategoryFormValues>,
    defaultValues: { name: '', tagline: '', sortOrder: 0 },
  })

  useEffect(() => {
    if (!sheetOpen) return
    if (editing) {
      form.reset({
        name: editing.name,
        tagline: editing.tagline ?? '',
        sortOrder: editing.sortOrder,
      })
    } else {
      const nextOrder = items.length ? Math.max(...items.map((c) => c.sortOrder)) + 1 : 0
      form.reset({ name: '', tagline: '', sortOrder: nextOrder })
    }
    setImageFile(null)
  }, [sheetOpen, editing, items, form])

  const createMut = useMutation({
    mutationFn: createCategory,
    onError: (e) => toast.error(getApiErrorMessage(e, 'Create failed')),
  })

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: CategoryFormValues }) =>
      updateCategory(id, {
        name: body.name.trim(),
        sortOrder: body.sortOrder,
        tagline: body.tagline?.trim() ? body.tagline.trim() : null,
      }),
    onError: (e) => toast.error(getApiErrorMessage(e, 'Update failed')),
  })

  const reorderMut = useMutation({
    mutationFn: reorderCategories,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success('Order saved')
    },
    onError: (e) => {
      toast.error(getApiErrorMessage(e, 'Reorder failed'))
      setItems(sorted)
    },
  })

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  function openCreate() {
    setEditing(null)
    setSheetOpen(true)
  }

  function openEdit(c: CatalogCategory) {
    setEditing(c)
    setSheetOpen(true)
  }

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = items.findIndex((i) => i.id === active.id)
    const newIndex = items.findIndex((i) => i.id === over.id)
    if (oldIndex < 0 || newIndex < 0) return
    const next = arrayMove(items, oldIndex, newIndex)
    setItems(next)
    reorderMut.mutate(next.map((c) => c.id))
  }

  async function onSubmitForm(values: CategoryFormValues) {
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body: values })
        if (imageFile) await uploadCategoryImage(editing.id, imageFile)
      } else {
        const created = await createMut.mutateAsync({
          name: values.name.trim(),
          sortOrder: values.sortOrder,
          ...(values.tagline?.trim() && { tagline: values.tagline.trim() }),
        })
        if (imageFile) await uploadCategoryImage(created.id, imageFile)
      }
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success(editing ? 'Category saved' : 'Category created')
      setSheetOpen(false)
      setEditing(null)
      setImageFile(null)
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Save failed'))
    }
  }

  async function confirmDeleteCategory() {
    if (!deleteTarget) return
    const id = deleteTarget.id
    setDeleteTarget(null)
    try {
      await deleteCategory(id)
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success('Category deleted')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Delete failed'))
    }
  }

  async function confirmToggleCategory() {
    if (!toggleTarget) return
    const c = toggleTarget
    setToggleTarget(null)
    try {
      if (c.isActive) await deactivateCategory(c.id)
      else await activateCategory(c.id)
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success(c.isActive ? 'Deactivated' : 'Activated')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Update failed'))
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Categories</h1>
          <p className="text-muted-foreground text-sm">Manage catalog categories and display order</p>
        </div>
        <Button type="button" onClick={openCreate} className="gap-2">
          <Plus className="size-4" aria-hidden />
          Add category
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All categories</CardTitle>
          <CardDescription>Drag rows to reorder. Inactive categories stay in the list when using “all”.</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No categories yet.</p>
          ) : (
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
              <SortableContext items={items.map((c) => c.id)} strategy={verticalListSortingStrategy}>
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-border border-b">
                        <th className="w-10 pb-2" aria-label="Reorder" />
                        <th className="pb-2 font-medium">Image</th>
                        <th className="pb-2 font-medium">Name</th>
                        <th className="pb-2 font-medium">Sort</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Actions</th>
                        <th className="pb-2 w-10" aria-label="Sub-categories" />
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => (
                        <SortableRow
                          key={c.id}
                          category={c}
                          onEdit={openEdit}
                          onToggle={(cat) => setToggleTarget(cat)}
                          onDelete={(cat) => setDeleteTarget(cat)}
                          subcategoriesTo={`/admin/subcategories?categoryId=${c.id}`}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </SortableContext>
            </DndContext>
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
            <SheetTitle>{editing ? 'Edit category' : 'New category'}</SheetTitle>
            <SheetDescription>
              {editing
                ? 'Update name or sort; optional new image replaces the current one on S3.'
                : 'Create a category; you can attach an image file after save.'}
            </SheetDescription>
          </SheetHeader>
          <form
            className="flex flex-1 flex-col gap-4 px-4 pb-4"
            onSubmit={form.handleSubmit((values) => {
              setPendingValues(values)
              setSaveConfirmOpen(true)
            })}
          >
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" {...form.register('name')} aria-invalid={!!form.formState.errors.name} />
              {form.formState.errors.name && (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-tagline">Tagline (optional)</Label>
              <textarea
                id="cat-tagline"
                rows={2}
                placeholder="Short line on the storefront category page…"
                className="border-input bg-background placeholder:text-muted-foreground focus-visible:ring-ring flex min-h-[72px] w-full rounded-lg border px-3 py-2 text-sm shadow-sm focus-visible:ring-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register('tagline')}
              />
              {form.formState.errors.tagline && (
                <p className="text-destructive text-xs">{form.formState.errors.tagline.message}</p>
              )}
            </div>
            <ImageUploadField
              label="Image (optional)"
              file={imageFile}
              onFileChange={setImageFile}
              currentImageUrl={editing?.imageUrl}
              hint="JPEG or PNG. Selected image previews before save."
            />
            <div className="space-y-2">
              <Label htmlFor="cat-order">Sort order</Label>
              <Input
                id="cat-order"
                type="number"
                min={0}
                {...form.register('sortOrder', { valueAsNumber: true })}
              />
              {form.formState.errors.sortOrder && (
                <p className="text-destructive text-xs">{form.formState.errors.sortOrder.message}</p>
              )}
            </div>
            <SheetFooter className="mt-auto flex-row gap-2 p-0">
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
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{editing ? 'Save category?' : 'Create category?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingValues ? (
                <>
                  <strong>{pendingValues.name.trim()}</strong>
                  {' · '}
                  sort order {pendingValues.sortOrder}
                  {imageFile ? ' · new image will be uploaded after save.' : ''}
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
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete <strong>{deleteTarget?.name}</strong>. This only succeeds if no products use
              this category.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void confirmDeleteCategory()}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toggleTarget} onOpenChange={(o) => !o && setToggleTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{toggleTarget?.isActive ? 'Deactivate category?' : 'Activate category?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {toggleTarget?.isActive
                ? `“${toggleTarget?.name}” will be hidden from new listings until activated again.`
                : `“${toggleTarget?.name}” will be available again for catalog use.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmToggleCategory()}>
              {toggleTarget?.isActive ? 'Deactivate' : 'Activate'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function SortableRow({
  category: c,
  onEdit,
  onToggle,
  onDelete,
  subcategoriesTo,
}: {
  category: CatalogCategory
  onEdit: (c: CatalogCategory) => void
  onToggle: (c: CatalogCategory) => void | Promise<void>
  onDelete: (c: CatalogCategory) => void | Promise<void>
  subcategoriesTo: string
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
  })
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <tr
      ref={setNodeRef}
      style={style}
      className={cn('border-border/80 border-b', isDragging && 'bg-muted/50')}
    >
      <td className="py-2 pr-2">
        <button
          type="button"
          className="text-muted-foreground hover:text-foreground cursor-grab p-1 active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="size-4" aria-hidden />
        </button>
      </td>
      <td className="py-2 pr-2">
        {c.imageUrl ? (
          <img src={c.imageUrl} alt="" className="size-9 rounded-md object-cover" />
        ) : (
          <div className="bg-muted size-9 rounded-md" />
        )}
      </td>
      <td className="py-2 pr-4 font-medium">{c.name}</td>
      <td className="text-muted-foreground py-2 pr-4">{c.sortOrder}</td>
      <td className="py-2 pr-4">
        <Badge variant={c.isActive ? 'default' : 'secondary'}>{c.isActive ? 'Active' : 'Inactive'}</Badge>
      </td>
      <td className="py-2 text-right">
        <div className="flex justify-end gap-1">
          <Button type="button" variant="ghost" size="icon-sm" onClick={() => onEdit(c)} aria-label="Edit">
            <Pencil className="size-3.5" />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => void onToggle(c)}>
            {c.isActive ? 'Deactivate' : 'Activate'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-destructive"
            onClick={() => void onDelete(c)}
            aria-label="Delete"
          >
            <Trash2 className="size-3.5" />
          </Button>
        </div>
      </td>
      <td className="py-2 text-right">
        <Link
          to={subcategoriesTo}
          title="Sub-categories"
          aria-label="Open sub-categories for this category"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
        >
          <Layers className="size-3.5" />
        </Link>
      </td>
    </tr>
  )
}
