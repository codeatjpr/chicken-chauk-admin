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
  getPayoutPreview,
  listPayouts,
  listPendingPayouts,
  processPayout,
  updatePayoutStatus,
  type PayoutAdminRow,
  type PayoutPreview,
} from '@/services/payouts-admin.service'

const PAYOUT_STATUSES = ['PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'] as const

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function toIsoStart(day: string) {
  return `${day}T00:00:00.000Z`
}

function toIsoEnd(day: string) {
  return `${day}T23:59:59.999Z`
}

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

function payoutPagination(pr: { page: number; totalPages: number } | undefined) {
  if (!pr || pr.totalPages <= 1) return null
  const hasPrev = pr.page > 1
  const hasNext = pr.page < pr.totalPages
  return { hasPrev, hasNext }
}

export function PayoutsPage() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [pvVendor, setPvVendor] = useState('')
  const [pvFrom, setPvFrom] = useState(ymd(new Date(today.getTime() - 7 * 86400000)))
  const [pvTo, setPvTo] = useState(ymd(today))
  const [preview, setPreview] = useState<PayoutPreview | null>(null)
  const [createRef, setCreateRef] = useState('')

  const [listStatus, setListStatus] = useState('')
  const [listVendor, setListVendor] = useState('')
  const [listFrom, setListFrom] = useState('')
  const [listTo, setListTo] = useState('')
  const [listPage, setListPage] = useState(1)
  const [pendingPage, setPendingPage] = useState(1)
  const limit = 20

  const [statusPayout, setStatusPayout] = useState<PayoutAdminRow | null>(null)
  const [newStatus, setNewStatus] = useState('COMPLETED')
  const [statusRef, setStatusRef] = useState('')

  const [createConfirmOpen, setCreateConfirmOpen] = useState(false)
  const [statusSaveConfirmOpen, setStatusSaveConfirmOpen] = useState(false)

  const previewMut = useMutation({
    mutationFn: () =>
      getPayoutPreview({
        vendorId: pvVendor.trim(),
        from: toIsoStart(pvFrom),
        to: toIsoEnd(pvTo),
      }),
    onSuccess: (d) => {
      setPreview(d)
      toast.success('Preview loaded')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Preview failed')),
  })

  const createMut = useMutation({
    mutationFn: () =>
      processPayout({
        vendorId: pvVendor.trim(),
        periodStart: toIsoStart(pvFrom),
        periodEnd: toIsoEnd(pvTo),
        transactionRef: createRef.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Payout created')
      setCreateRef('')
      setPreview(null)
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts-pending'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Create failed')),
  })

  const pendingQ = useQuery({
    queryKey: ['admin-payouts-pending', pendingPage],
    queryFn: () => listPendingPayouts(pendingPage, limit),
  })

  const listQ = useQuery({
    queryKey: ['admin-payouts', listPage, listStatus, listVendor, listFrom, listTo],
    queryFn: () =>
      listPayouts({
        page: listPage,
        limit,
        status: listStatus || undefined,
        vendorId: listVendor.trim() || undefined,
        ...(listFrom ? { from: toIsoStart(listFrom) } : {}),
        ...(listTo ? { to: toIsoEnd(listTo) } : {}),
      }),
  })

  const statusMut = useMutation({
    mutationFn: () =>
      updatePayoutStatus(statusPayout!.id, {
        status: newStatus,
        transactionRef: statusRef.trim() || undefined,
      }),
    onSuccess: () => {
      toast.success('Payout updated')
      setStatusPayout(null)
      setStatusRef('')
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-payouts-pending'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Update failed')),
  })

  const pendingItems = pendingQ.data?.items ?? []
  const listItems = listQ.data?.items ?? []
  const pendingPr = pendingQ.data
  const listPr = listQ.data
  const pendingNav = payoutPagination(pendingPr)
  const listNav = payoutPagination(listPr)

  const vendorIdOk = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(pvVendor.trim())
  const canCreate =
    !!preview && !preview.duplicatePayout && preview.payoutAmount > 0 && vendorIdOk

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Payouts</h1>
        <p className="text-muted-foreground text-sm">
          Vendor settlements from delivered orders (minus platform fee). Preview before creating a
          payout record.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Preview and create</CardTitle>
          <CardDescription>
            Period uses order <code className="text-xs">createdAt</code> for delivered orders.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[14rem] flex-1 space-y-1">
              <Label htmlFor="pv-vendor">Vendor ID</Label>
              <Input
                id="pv-vendor"
                className="font-mono text-xs"
                placeholder="UUID"
                value={pvVendor}
                onChange={(e) => {
                  setPvVendor(e.target.value)
                  setPreview(null)
                }}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pv-from">From</Label>
              <Input
                id="pv-from"
                type="date"
                value={pvFrom}
                onChange={(e) => {
                  setPvFrom(e.target.value)
                  setPreview(null)
                }}
                className="w-[11rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pv-to">To</Label>
              <Input
                id="pv-to"
                type="date"
                value={pvTo}
                onChange={(e) => {
                  setPvTo(e.target.value)
                  setPreview(null)
                }}
                className="w-[11rem]"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="button"
                variant="secondary"
                disabled={previewMut.isPending || !pvVendor.trim()}
                onClick={() => previewMut.mutate()}
              >
                {previewMut.isPending ? 'Loading…' : 'Load preview'}
              </Button>
            </div>
          </div>

          {preview && (
            <div className="border-border space-y-2 rounded-lg border p-3 text-sm">
              <p className="font-medium">
                {preview.vendor.name}{' '}
                <span className="text-muted-foreground font-normal">({preview.vendor.city})</span>
              </p>
              <p className="text-muted-foreground">
                Delivered orders: {preview.deliveredOrdersInPeriod} · Gross {money.format(preview.grossRevenue)} ·
                Commission {money.format(preview.platformCommission)} ·{' '}
                <span className="text-foreground font-semibold">
                  Payout {money.format(preview.payoutAmount)}
                </span>
              </p>
              {preview.duplicatePayout && (
                <p className="text-destructive text-sm">
                  Duplicate: existing payout {preview.duplicatePayout.id.slice(0, 8)}… status{' '}
                  {preview.duplicatePayout.status} ({money.format(preview.duplicatePayout.amount)}).
                </p>
              )}
              <div className="flex flex-wrap items-end gap-3 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="create-ref">Transaction ref (optional)</Label>
                  <Input
                    id="create-ref"
                    value={createRef}
                    onChange={(e) => setCreateRef(e.target.value)}
                    className="w-[14rem]"
                    placeholder="Bank / UTR"
                  />
                </div>
                <Button type="button" disabled={createMut.isPending || !canCreate} onClick={() => setCreateConfirmOpen(true)}>
                  {createMut.isPending ? 'Creating…' : 'Create payout'}
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pending payouts</CardTitle>
          <CardDescription>Oldest first — mark completed when paid out.</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingQ.isLoading ? (
            <Skeleton className="h-32 w-full" />
          ) : pendingItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No pending payouts.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">Vendor</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Period</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {pendingItems.map((row) => (
                      <tr key={row.id} className="border-border/80 border-b">
                        <td className="py-2 pr-4">{row.vendor.name}</td>
                        <td className="py-2 pr-4">{money.format(row.amount)}</td>
                        <td className="text-muted-foreground py-2 pr-4 text-xs">
                          {new Date(row.periodStart).toLocaleDateString()} –{' '}
                          {new Date(row.periodEnd).toLocaleDateString()}
                        </td>
                        <td className="py-2">
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setNewStatus('COMPLETED')
                              setStatusRef('')
                              setStatusPayout(row)
                            }}
                          >
                            Update status
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pendingNav && (
                <div className="text-muted-foreground mt-4 flex items-center justify-between text-sm">
                  <span>
                    Page {pendingPr!.page} of {pendingPr!.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!pendingNav.hasPrev}
                      onClick={() => setPendingPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!pendingNav.hasNext}
                      onClick={() => setPendingPage((p) => p + 1)}
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

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">All payouts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1">
              <Label htmlFor="lp-status">Status</Label>
              <select
                id="lp-status"
                className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
                value={listStatus}
                onChange={(e) => {
                  setListStatus(e.target.value)
                  setListPage(1)
                }}
              >
                <option value="">Any</option>
                {PAYOUT_STATUSES.map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="lp-from">From</Label>
              <Input
                id="lp-from"
                type="date"
                value={listFrom}
                onChange={(e) => {
                  setListFrom(e.target.value)
                  setListPage(1)
                }}
                className="w-[11rem]"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="lp-to">To</Label>
              <Input
                id="lp-to"
                type="date"
                value={listTo}
                onChange={(e) => {
                  setListTo(e.target.value)
                  setListPage(1)
                }}
                className="w-[11rem]"
              />
            </div>
            <div className="min-w-[12rem] flex-1 space-y-1">
              <Label htmlFor="lp-vendor">Vendor ID</Label>
              <Input
                id="lp-vendor"
                className="font-mono text-xs"
                placeholder="Optional"
                value={listVendor}
                onChange={(e) => {
                  setListVendor(e.target.value)
                  setListPage(1)
                }}
              />
            </div>
          </div>

          {listQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : listItems.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payouts.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">When</th>
                      <th className="pb-2 font-medium">Vendor</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Ref</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {listItems.map((row) => (
                      <tr key={row.id} className="border-border/80 border-b">
                        <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">{row.vendor.name}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="secondary">{row.status}</Badge>
                        </td>
                        <td className="py-2 pr-4">{money.format(row.amount)}</td>
                        <td className="text-muted-foreground max-w-[8rem] truncate py-2 pr-4 text-xs">
                          {row.transactionRef ?? '—'}
                        </td>
                        <td className="py-2">
                          {row.status !== 'COMPLETED' && row.status !== 'FAILED' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setNewStatus('COMPLETED')
                                setStatusRef('')
                                setStatusPayout(row)
                              }}
                            >
                              Status
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {listNav && (
                <div className="text-muted-foreground flex items-center justify-between text-sm">
                  <span>
                    Page {listPr!.page} of {listPr!.totalPages}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!listNav.hasPrev}
                      onClick={() => setListPage((p) => Math.max(1, p - 1))}
                    >
                      Previous
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!listNav.hasNext}
                      onClick={() => setListPage((p) => p + 1)}
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

      <AlertDialog open={createConfirmOpen} onOpenChange={setCreateConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Create payout record?</AlertDialogTitle>
            <AlertDialogDescription>
              {preview ? (
                <>
                  Vendor <strong>{preview.vendor.name}</strong> · amount{' '}
                  <strong>{money.format(preview.payoutAmount)}</strong> for the selected period. This records a payout in
                  the system.
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={createMut.isPending || !canCreate}
              onClick={() => {
                setCreateConfirmOpen(false)
                createMut.mutate()
              }}
            >
              Create payout
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={statusSaveConfirmOpen} onOpenChange={setStatusSaveConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Update payout status?</AlertDialogTitle>
            <AlertDialogDescription>
              Set status to <strong>{newStatus}</strong>
              {statusPayout ? (
                <>
                  {' '}
                  for <strong>{statusPayout.vendor.name}</strong> ({money.format(statusPayout.amount)}).
                </>
              ) : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={statusMut.isPending || !statusPayout}
              onClick={() => {
                setStatusSaveConfirmOpen(false)
                statusMut.mutate()
              }}
            >
              Confirm update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={!!statusPayout} onOpenChange={(o) => !o && setStatusPayout(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Update payout status</SheetTitle>
            <SheetDescription className="font-mono text-xs">{statusPayout?.id}</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <div className="space-y-1">
              <Label>New status</Label>
              <select
                className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
              >
                {PAYOUT_STATUSES.filter((s) => s !== 'PENDING').map((s) => (
                  <option key={s} value={s}>
                    {s}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="st-ref">Transaction ref (optional)</Label>
              <Input id="st-ref" value={statusRef} onChange={(e) => setStatusRef(e.target.value)} />
            </div>
            <Button
              type="button"
              disabled={statusMut.isPending || !statusPayout}
              onClick={() => setStatusSaveConfirmOpen(true)}
            >
              {statusMut.isPending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
