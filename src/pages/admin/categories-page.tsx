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
import { GripVertical, ImagePlus, Pencil, Plus, Trash2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
  sortOrder: z.coerce.number().int().min(0),
})

type CategoryFormValues = z.infer<typeof categoryFormSchema>

export function CategoriesPage() {
  const queryClient = useQueryClient()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editing, setEditing] = useState<CatalogCategory | null>(null)
  const [items, setItems] = useState<CatalogCategory[]>([])
  const imageInputRef = useRef<HTMLInputElement>(null)

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
    defaultValues: { name: '', sortOrder: 0 },
  })

  useEffect(() => {
    if (!sheetOpen) return
    if (editing) {
      form.reset({
        name: editing.name,
        sortOrder: editing.sortOrder,
      })
    } else {
      const nextOrder = items.length ? Math.max(...items.map((c) => c.sortOrder)) + 1 : 0
      form.reset({ name: '', sortOrder: nextOrder })
    }
    if (imageInputRef.current) imageInputRef.current.value = ''
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
    const file = imageInputRef.current?.files?.[0] ?? null
    try {
      if (editing) {
        await updateMut.mutateAsync({ id: editing.id, body: values })
        if (file) await uploadCategoryImage(editing.id, file)
      } else {
        const created = await createMut.mutateAsync({
          name: values.name.trim(),
          sortOrder: values.sortOrder,
        })
        if (file) await uploadCategoryImage(created.id, file)
      }
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success(editing ? 'Category saved' : 'Category created')
      setSheetOpen(false)
      setEditing(null)
      if (imageInputRef.current) imageInputRef.current.value = ''
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Save failed'))
    }
  }

  async function onToggleActive(c: CatalogCategory) {
    try {
      if (c.isActive) await deactivateCategory(c.id)
      else await activateCategory(c.id)
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success(c.isActive ? 'Deactivated' : 'Activated')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Update failed'))
    }
  }

  async function onDelete(c: CatalogCategory) {
    if (!window.confirm(`Delete category “${c.name}”? This only works if no products use it.`)) return
    try {
      await deleteCategory(c.id)
      void queryClient.invalidateQueries({ queryKey: ['catalog-categories-all'] })
      toast.success('Category deleted')
    } catch (e) {
      toast.error(getApiErrorMessage(e, 'Delete failed'))
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
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((c) => (
                        <SortableRow key={c.id} category={c} onEdit={openEdit} onToggle={onToggleActive} onDelete={onDelete} />
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
            onSubmit={form.handleSubmit(async (values) => onSubmitForm(values))}
          >
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" {...form.register('name')} aria-invalid={!!form.formState.errors.name} />
              {form.formState.errors.name && (
                <p className="text-destructive text-xs">{form.formState.errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Image (optional)</Label>
              {editing?.imageUrl ? (
                <img src={editing.imageUrl} alt="" className="border-border mb-2 max-h-24 rounded-md border object-contain" />
              ) : null}
              <div className="flex items-center gap-2">
                <Input ref={imageInputRef} id="cat-image" type="file" accept="image/jpeg,image/png" className="text-sm" />
                <ImagePlus className="text-muted-foreground size-4 shrink-0" aria-hidden />
              </div>
              <p className="text-muted-foreground text-xs">JPEG or PNG. Saved after create/update.</p>
            </div>
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
    </div>
  )
}

function SortableRow({
  category: c,
  onEdit,
  onToggle,
  onDelete,
}: {
  category: CatalogCategory
  onEdit: (c: CatalogCategory) => void
  onToggle: (c: CatalogCategory) => void | Promise<void>
  onDelete: (c: CatalogCategory) => void | Promise<void>
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
    </tr>
  )
}
