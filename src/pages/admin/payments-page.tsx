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
  getPaymentsSummary,
  initiateRefund,
  listPaymentsAdmin,
  type PaymentAdminRow,
} from '@/services/payments-admin.service'

const PAYMENT_STATUSES = ['PENDING', 'SUCCESS', 'FAILED', 'REFUNDED'] as const
const PAYMENT_METHODS = ['UPI', 'CARD', 'COD', 'WALLET', 'NETBANKING'] as const

function ymd(d: Date) {
  return d.toISOString().slice(0, 10)
}

function rangeParams(fromYmd: string, toYmd: string) {
  return {
    from: `${fromYmd}T00:00:00.000Z`,
    to: `${toYmd}T23:59:59.999Z`,
  }
}

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function PaymentsPage() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [from, setFrom] = useState(ymd(new Date(today.getTime() - 30 * 86400000)))
  const [to, setTo] = useState(ymd(today))
  const [status, setStatus] = useState('')
  const [method, setMethod] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const [refundOpen, setRefundOpen] = useState(false)
  const [refundOrderId, setRefundOrderId] = useState('')
  const [refundAmount, setRefundAmount] = useState('')
  const [refundReason, setRefundReason] = useState('')
  const [refundConfirmOpen, setRefundConfirmOpen] = useState(false)

  const range = rangeParams(from, to)

  const summaryQ = useQuery({
    queryKey: ['admin-payments-summary', range.from, range.to],
    queryFn: () => getPaymentsSummary({ from: range.from, to: range.to }),
  })

  const listQ = useQuery({
    queryKey: ['admin-payments', page, status, method, search, range.from, range.to],
    queryFn: () =>
      listPaymentsAdmin({
        page,
        limit,
        status: status || undefined,
        method: method || undefined,
        from: range.from,
        to: range.to,
        search: search.trim() || undefined,
      }),
  })

  const refundMut = useMutation({
    mutationFn: () =>
      initiateRefund({
        orderId: refundOrderId.trim(),
        reason: refundReason.trim(),
        ...(refundAmount.trim() ? { amount: Number(refundAmount) } : {}),
      }),
    onSuccess: () => {
      toast.success('Refund initiated')
      setRefundOpen(false)
      setRefundReason('')
      setRefundAmount('')
      void queryClient.invalidateQueries({ queryKey: ['admin-payments'] })
      void queryClient.invalidateQueries({ queryKey: ['admin-payments-summary'] })
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Refund failed')),
  })

  function openRefund(row: PaymentAdminRow) {
    setRefundOrderId(row.orderId)
    setRefundAmount('')
    setRefundReason('')
    setRefundOpen(true)
  }

  const byStatus = summaryQ.data?.byStatus ?? {}
  const items = listQ.data?.items ?? []
  const pr = listQ.data

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Payments</h1>
        <p className="text-muted-foreground text-sm">
          Summary, ledger view, and admin refunds (online via gateway; COD recorded).
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Summary (range)</CardTitle>
          <CardDescription>Aggregates payment rows by status for the same date range below.</CardDescription>
        </CardHeader>
        <CardContent>
          {summaryQ.isLoading ? (
            <Skeleton className="h-16 w-full" />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {PAYMENT_STATUSES.map((s) => {
                const row = byStatus[s]
                return (
                  <div
                    key={s}
                    className="border-border bg-muted/30 rounded-lg border px-3 py-2 text-sm"
                  >
                    <p className="text-muted-foreground font-medium">{s}</p>
                    <p className="font-semibold">{money.format(row?.amount ?? 0)}</p>
                    <p className="text-muted-foreground text-xs">{row?.count ?? 0} payments</p>
                  </div>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date range uses payment creation time (UTC).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor="p-from">From</Label>
            <Input
              id="p-from"
              type="date"
              value={from}
              onChange={(e) => {
                setFrom(e.target.value)
                setPage(1)
              }}
              className="w-[11rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-to">To</Label>
            <Input
              id="p-to"
              type="date"
              value={to}
              onChange={(e) => {
                setTo(e.target.value)
                setPage(1)
              }}
              className="w-[11rem]"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-status">Status</Label>
            <select
              id="p-status"
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Any</option>
              {PAYMENT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="p-method">Method</Label>
            <select
              id="p-method"
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={method}
              onChange={(e) => {
                setMethod(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Any</option>
              {PAYMENT_METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label htmlFor="p-search">Search</Label>
            <Input
              id="p-search"
              placeholder="Order ID, gateway ID, phone digits…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1)
              }}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payments</CardTitle>
          <CardDescription>{pr ? `${pr.total} in range` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No payments for these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">When</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Method</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Order</th>
                      <th className="pb-2 font-medium">User</th>
                      <th className="pb-2 font-medium" />
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr key={row.id} className="border-border/80 border-b">
                        <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">
                          <Badge variant="secondary">{row.status}</Badge>
                        </td>
                        <td className="py-2 pr-4">{row.method}</td>
                        <td className="py-2 pr-4">{money.format(row.amount)}</td>
                        <td className="py-2 pr-4 font-mono text-xs">{row.orderId.slice(0, 8)}…</td>
                        <td className="py-2 pr-4 text-xs">{row.order.user.phone}</td>
                        <td className="py-2">
                          {row.status === 'SUCCESS' && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => openRefund(row)}
                            >
                              Refund
                            </Button>
                          )}
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

      <AlertDialog open={refundConfirmOpen} onOpenChange={setRefundConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Initiate refund?</AlertDialogTitle>
            <AlertDialogDescription>
              Order <span className="font-mono text-xs">{refundOrderId.trim()}</span>
              {refundAmount.trim() ? (
                <>
                  {' '}
                  · amount <strong>{refundAmount.trim()}</strong>
                </>
              ) : (
                ' · full payment amount (if empty)'
              )}
              . Reason: {refundReason.trim().slice(0, 120)}
              {refundReason.trim().length > 120 ? '…' : ''}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={refundMut.isPending}
              onClick={() => {
                setRefundConfirmOpen(false)
                refundMut.mutate()
              }}
            >
              Confirm refund
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Sheet open={refundOpen} onOpenChange={setRefundOpen}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-md">
          <SheetHeader>
            <SheetTitle>Initiate refund</SheetTitle>
            <SheetDescription>Order ID is fixed from the selected payment row.</SheetDescription>
          </SheetHeader>
          <div className="space-y-4 px-4 pb-4">
            <div className="space-y-1">
              <Label>Order ID</Label>
              <Input className="font-mono text-xs" value={refundOrderId} readOnly />
            </div>
            <div className="space-y-1">
              <Label htmlFor="refund-amt">Amount (optional)</Label>
              <Input
                id="refund-amt"
                type="number"
                min={0}
                step="0.01"
                placeholder="Full order payment if empty"
                value={refundAmount}
                onChange={(e) => setRefundAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="refund-reason">Reason</Label>
              <textarea
                id="refund-reason"
                className="border-input bg-background min-h-[5rem] w-full rounded-lg border px-2 py-1 text-sm"
                value={refundReason}
                onChange={(e) => setRefundReason(e.target.value)}
                placeholder="At least 3 characters"
              />
            </div>
            <Button
              type="button"
              disabled={
                refundMut.isPending || refundReason.trim().length < 3 || !refundOrderId.trim()
              }
              onClick={() => setRefundConfirmOpen(true)}
            >
              {refundMut.isPending ? 'Submitting…' : 'Submit refund'}
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
