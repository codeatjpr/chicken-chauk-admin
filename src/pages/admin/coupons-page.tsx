import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  createCoupon,
  deactivateCoupon,
  getCoupon,
  listCoupons,
  updateCoupon,
  type CouponRow,
} from '@/services/coupons-admin.service'

type SheetMode = 'create' | 'edit' | null

const APPLICABLE = ['ALL', 'NEW_USERS', 'SPECIFIC_VENDOR'] as const
const DISCOUNT_TYPES = ['FLAT', 'PERCENT'] as const

function toIsoFromLocal(dtLocal: string) {
  if (!dtLocal) return undefined
  const d = new Date(dtLocal)
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString()
}

function localFromIso(iso: string | null) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

const emptyForm = {
  code: '',
  title: '',
  description: '',
  discountType: 'PERCENT' as (typeof DISCOUNT_TYPES)[number],
  discountValue: '',
  maxDiscountAmount: '',
  minOrderValue: '0',
  usageLimitTotal: '',
  usageLimitPerUser: '1',
  applicableFor: 'ALL' as (typeof APPLICABLE)[number],
  vendorId: '',
  isActive: true,
  expiresAtLocal: '',
}

type CouponFormState = typeof emptyForm

function mapCouponToForm(c: CouponRow): CouponFormState {
  return {
    code: c.code,
    title: c.title,
    description: c.description ?? '',
    discountType: c.discountType as (typeof DISCOUNT_TYPES)[number],
    discountValue: String(c.discountValue),
    maxDiscountAmount: c.maxDiscountAmount != null ? String(c.maxDiscountAmount) : '',
    minOrderValue: String(c.minOrderValue),
    usageLimitTotal: c.usageLimitTotal != null ? String(c.usageLimitTotal) : '',
    usageLimitPerUser: String(c.usageLimitPerUser),
    applicableFor: c.applicableFor as (typeof APPLICABLE)[number],
    vendorId: c.vendorId ?? '',
    isActive: c.isActive,
    expiresAtLocal: localFromIso(c.expiresAt),
  }
}

function CouponSheetForm({
  mode,
  coupon,
  onClose,
}: {
  mode: 'create' | 'edit'
  coupon?: CouponRow
  onClose: () => void
}) {
  const queryClient = useQueryClient()
  const [form, setForm] = useState<CouponFormState>(() =>
    mode === 'edit' && coupon ? mapCouponToForm(coupon) : { ...emptyForm },
  )
  const [saveConfirmOpen, setSaveConfirmOpen] = useState(false)

  function buildPayload(forCreate: boolean): Record<string, unknown> {
    const discountValue = Number(form.discountValue)
    const minOrderValue = Number(form.minOrderValue)
    const usageLimitPerUser = Number(form.usageLimitPerUser)
    const payload: Record<string, unknown> = {
      title: form.title.trim(),
      description: form.description.trim() || undefined,
      discountType: form.discountType,
      discountValue,
      minOrderValue,
      usageLimitPerUser,
      applicableFor: form.applicableFor,
      isActive: form.isActive,
    }
    const exp = toIsoFromLocal(form.expiresAtLocal)
    if (exp) payload.expiresAt = exp
    if (form.maxDiscountAmount.trim()) payload.maxDiscountAmount = Number(form.maxDiscountAmount)
    if (form.usageLimitTotal.trim()) payload.usageLimitTotal = Number(form.usageLimitTotal)
    if (form.applicableFor === 'SPECIFIC_VENDOR' && form.vendorId.trim()) {
      payload.vendorId = form.vendorId.trim()
    }
    if (forCreate) {
      payload.code = form.code.trim().toUpperCase()
    }
    return payload
  }

  const saveMut = useMutation({
    mutationFn: async () => {
      if (mode === 'create') {
        return createCoupon(buildPayload(true))
      }
      if (mode === 'edit' && coupon) {
        return updateCoupon(coupon.id, buildPayload(false))
      }
      throw new Error('No mode')
    },
    onSuccess: () => {
      toast.success(mode === 'create' ? 'Coupon created' : 'Coupon updated')
      onClose()
      void queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Save failed')),
  })

  return (
    <>
      <div className="space-y-3 px-4 pb-6 text-sm">
        {mode === 'create' && (
          <div className="space-y-1">
            <Label htmlFor="f-code">Code</Label>
            <Input
              id="f-code"
              className="font-mono uppercase"
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="f-title">Title</Label>
          <Input
            id="f-title"
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="f-desc">Description</Label>
          <Input
            id="f-desc"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label>Type</Label>
            <select
              className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
              value={form.discountType}
              onChange={(e) =>
                setForm((f) => ({ ...f, discountType: e.target.value as (typeof DISCOUNT_TYPES)[number] }))
              }
            >
              {DISCOUNT_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-val">Value</Label>
            <Input
              id="f-val"
              type="number"
              min={0}
              step="0.01"
              value={form.discountValue}
              onChange={(e) => setForm((f) => ({ ...f, discountValue: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="f-max">Max discount (optional)</Label>
            <Input
              id="f-max"
              type="number"
              min={0}
              value={form.maxDiscountAmount}
              onChange={(e) => setForm((f) => ({ ...f, maxDiscountAmount: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-min">Min order</Label>
            <Input
              id="f-min"
              type="number"
              min={0}
              value={form.minOrderValue}
              onChange={(e) => setForm((f) => ({ ...f, minOrderValue: e.target.value }))}
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label htmlFor="f-lim-t">Total uses (optional)</Label>
            <Input
              id="f-lim-t"
              type="number"
              min={1}
              value={form.usageLimitTotal}
              onChange={(e) => setForm((f) => ({ ...f, usageLimitTotal: e.target.value }))}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-lim-u">Per user</Label>
            <Input
              id="f-lim-u"
              type="number"
              min={1}
              value={form.usageLimitPerUser}
              onChange={(e) => setForm((f) => ({ ...f, usageLimitPerUser: e.target.value }))}
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label>Applicable for</Label>
          <select
            className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
            value={form.applicableFor}
            onChange={(e) =>
              setForm((f) => ({ ...f, applicableFor: e.target.value as (typeof APPLICABLE)[number] }))
            }
          >
            {APPLICABLE.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
        </div>
        {form.applicableFor === 'SPECIFIC_VENDOR' && (
          <div className="space-y-1">
            <Label htmlFor="f-vendor">Vendor ID</Label>
            <Input
              id="f-vendor"
              className="font-mono text-xs"
              value={form.vendorId}
              onChange={(e) => setForm((f) => ({ ...f, vendorId: e.target.value }))}
            />
          </div>
        )}
        <div className="space-y-1">
          <Label htmlFor="f-exp">Expires (local)</Label>
          <Input
            id="f-exp"
            type="datetime-local"
            value={form.expiresAtLocal}
            onChange={(e) => setForm((f) => ({ ...f, expiresAtLocal: e.target.value }))}
          />
        </div>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
          />
          Active
        </label>
        <Button
          type="button"
          disabled={
            saveMut.isPending ||
            !form.title.trim() ||
            !form.discountValue ||
            (mode === 'create' && form.code.trim().length < 3)
          }
          onClick={() => setSaveConfirmOpen(true)}
        >
          {saveMut.isPending ? 'Saving…' : 'Save'}
        </Button>
      </div>

      <AlertDialog open={saveConfirmOpen} onOpenChange={setSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{mode === 'create' ? 'Create coupon?' : 'Save coupon?'}</AlertDialogTitle>
            <AlertDialogDescription>
              {mode === 'create' ? (
                <>
                  Code <strong>{form.code.trim().toUpperCase()}</strong> · {form.title.trim()}
                </>
              ) : (
                <>Updates <strong>{form.title.trim()}</strong> ({form.code.trim().toUpperCase()}).</>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              disabled={saveMut.isPending}
              onClick={() => {
                setSaveConfirmOpen(false)
                saveMut.mutate()
              }}
            >
              {mode === 'create' ? 'Confirm create' : 'Confirm save'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

export function CouponsPage() {
  const queryClient = useQueryClient()
  const [activeFilter, setActiveFilter] = useState<'any' | 'true' | 'false'>('any')
  const [page, setPage] = useState(1)
  const limit = 20

  const [sheetMode, setSheetMode] = useState<SheetMode>(null)
  const [editId, setEditId] = useState<string | null>(null)

  const [deactivateTarget, setDeactivateTarget] = useState<CouponRow | null>(null)

  const listQ = useQuery({
    queryKey: ['admin-coupons', page, activeFilter],
    queryFn: () =>
      listCoupons({
        page,
        limit,
        ...(activeFilter === 'any' ? {} : { isActive: activeFilter === 'true' }),
      }),
  })

  const detailQ = useQuery({
    queryKey: ['admin-coupon', editId],
    queryFn: () => getCoupon(editId!),
    enabled: sheetMode === 'edit' && !!editId,
  })

  function openCreate() {
    setEditId(null)
    setSheetMode('create')
  }

  function openEdit(row: CouponRow) {
    setEditId(row.id)
    setSheetMode('edit')
  }

  function closeSheet() {
    setSheetMode(null)
    setEditId(null)
  }

  const deactivateMut = useMutation({
    mutationFn: deactivateCoupon,
    onSuccess: () => {
      toast.success('Coupon deactivated')
      void queryClient.invalidateQueries({ queryKey: ['admin-coupons'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Deactivate failed')),
  })

  const items = listQ.data?.items ?? []
  const pr = listQ.data

  const sheetOpen = sheetMode !== null
  const formLoading = sheetMode === 'edit' && detailQ.isLoading

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Coupons</h1>
          <p className="text-muted-foreground text-sm">Wallet promo codes (admin CRUD).</p>
        </div>
        <Button type="button" onClick={openCreate}>
          New coupon
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-1">
            <Label htmlFor="c-active">Active</Label>
            <select
              id="c-active"
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={activeFilter}
              onChange={(e) => {
                setActiveFilter(e.target.value as 'any' | 'true' | 'false')
                setPage(1)
              }}
            >
              <option value="any">Any</option>
              <option value="true">Active only</option>
              <option value="false">Inactive only</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Coupons</CardTitle>
          <CardDescription>{pr ? `${pr.total} total` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No coupons.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Code</th>
                      <th className="pb-2 font-medium">Title</th>
                      <th className="pb-2 font-medium">Discount</th>
                      <th className="pb-2 font-medium">Scope</th>
                      <th className="pb-2 font-medium">Used</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-border/80 border-b">
                        <td className="py-2 pr-4 font-mono text-xs font-semibold">{row.code}</td>
                        <td className="py-2 pr-4">{row.title}</td>
                        <td className="py-2 pr-4">
                          {row.discountType === 'PERCENT'
                            ? `${row.discountValue}%`
                            : `₹${row.discountValue}`}
                        </td>
                        <td className="py-2 pr-4 text-xs">{row.applicableFor}</td>
                        <td className="py-2 pr-4 text-xs">
                          {row.usedCount}
                          {row.usageLimitTotal != null ? ` / ${row.usageLimitTotal}` : ''}
                        </td>
                        <td className="py-2 pr-4">
                          {row.isActive ? (
                            <Badge variant="secondary">Active</Badge>
                          ) : (
                            <Badge variant="outline">Off</Badge>
                          )}
                        </td>
                        <td className="py-2">
                          <div className="flex flex-wrap gap-1">
                            <Button type="button" variant="outline" size="sm" onClick={() => openEdit(row)}>
                              Edit
                            </Button>
                            {row.isActive && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                disabled={deactivateMut.isPending}
                                onClick={() => setDeactivateTarget(row)}
                              >
                                Deactivate
                              </Button>
                            )}
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

      <Sheet open={sheetOpen} onOpenChange={(o) => !o && closeSheet()}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{sheetMode === 'create' ? 'New coupon' : 'Edit coupon'}</SheetTitle>
            <SheetDescription className="font-mono text-xs">
              {sheetMode === 'edit' ? editId : null}
            </SheetDescription>
          </SheetHeader>
          {sheetMode === 'create' ? (
            <CouponSheetForm mode="create" onClose={closeSheet} />
          ) : formLoading ? (
            <Skeleton className="mx-4 h-64 w-auto" />
          ) : detailQ.data ? (
            <CouponSheetForm key={editId} mode="edit" coupon={detailQ.data} onClose={closeSheet} />
          ) : (
            <p className="text-destructive px-4 text-sm">Could not load coupon.</p>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deactivateTarget} onOpenChange={(o) => !o && setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate coupon?</AlertDialogTitle>
            <AlertDialogDescription>
              <strong>{deactivateTarget?.code}</strong> ({deactivateTarget?.title}) will stop working for new
              checkouts.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deactivateMut.isPending}
              onClick={() => {
                if (!deactivateTarget) return
                const id = deactivateTarget.id
                setDeactivateTarget(null)
                deactivateMut.mutate(id)
              }}
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
