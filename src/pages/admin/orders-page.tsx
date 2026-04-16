import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
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
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  ADMIN_ORDER_TRANSITIONS,
  getAdminOrderDetail,
  listAdminOrders,
  updateAdminOrderStatus,
  type AdminOrderListItem,
} from '@/services/orders-admin.service'

const ORDER_STATUSES = [
  'PLACED',
  'CONFIRMED',
  'PREPARING',
  'READY',
  'PICKED_UP',
  'OUT_FOR_DELIVERY',
  'DELIVERED',
  'CANCELLED',
  'REFUNDED',
] as const

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

function AdminOrderStatusForm({
  orderId,
  allowedNext,
  onDone,
}: {
  orderId: string
  allowedNext: string[]
  onDone: () => void
}) {
  const [nextStatus, setNextStatus] = useState(allowedNext[0] ?? '')
  const [statusNote, setStatusNote] = useState('')

  const statusMut = useMutation({
    mutationFn: () =>
      updateAdminOrderStatus(orderId, {
        status: nextStatus,
        note: statusNote.trim() || undefined,
      }),
    onSuccess: () => {
      onDone()
      toast.success('Status updated')
      setStatusNote('')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Update failed')),
  })

  return (
    <div className="border-border space-y-2 border-t pt-4">
      <p className="font-medium">Admin action</p>
      <select
        className="border-input bg-background h-8 w-full rounded-lg border px-2 text-sm"
        value={nextStatus}
        onChange={(e) => setNextStatus(e.target.value)}
      >
        {allowedNext.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
      </select>
      <textarea
        className="border-input bg-background min-h-[3rem] w-full rounded-lg border px-2 py-1 text-sm"
        placeholder="Optional note (logged)"
        value={statusNote}
        onChange={(e) => setStatusNote(e.target.value)}
      />
      <Button type="button" disabled={!nextStatus || statusMut.isPending} onClick={() => statusMut.mutate()}>
        Update status
      </Button>
    </div>
  )
}

export function OrdersPage() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [from, setFrom] = useState(ymd(new Date(today.getTime() - 14 * 86400000)))
  const [to, setTo] = useState(ymd(today))
  const [status, setStatus] = useState('')
  const [vendorId, setVendorId] = useState('')
  const [page, setPage] = useState(1)
  const limit = 20

  const [selected, setSelected] = useState<AdminOrderListItem | null>(null)

  const range = rangeParams(from, to)

  const listQ = useQuery({
    queryKey: ['admin-orders', page, status, vendorId, range.from, range.to],
    queryFn: () =>
      listAdminOrders({
        page,
        limit,
        status: status || undefined,
        vendorId: vendorId.trim() || undefined,
        from: range.from,
        to: range.to,
      }),
  })

  const detailQ = useQuery({
    queryKey: ['admin-order', selected?.id],
    queryFn: () => getAdminOrderDetail(selected!.id),
    enabled: !!selected,
  })


  const items = listQ.data?.items ?? []
  const pr = listQ.data

  function openDetail(row: AdminOrderListItem) {
    setSelected(row)
  }

  const detail = detailQ.data
  const detailObj = detail && typeof detail === 'object' ? (detail as Record<string, unknown>) : null
  const statusForActions =
    typeof detailObj?.status === 'string' ? detailObj.status : selected?.status ?? ''
  const allowedNext = ADMIN_ORDER_TRANSITIONS[statusForActions] ?? []

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Orders</h1>
        <p className="text-muted-foreground text-sm">Platform-wide order list and admin status changes.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Filters</CardTitle>
          <CardDescription>Date range uses order creation time (UTC).</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor="o-from">From</Label>
            <Input
              id="o-from"
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
            <Label htmlFor="o-to">To</Label>
            <Input
              id="o-to"
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
            <Label htmlFor="o-status">Status</Label>
            <select
              id="o-status"
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
            >
              <option value="">Any</option>
              {ORDER_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="o-vendor">Vendor ID</Label>
            <Input
              id="o-vendor"
              placeholder="UUID"
              value={vendorId}
              onChange={(e) => {
                setVendorId(e.target.value)
                setPage(1)
              }}
              className="w-[14rem] font-mono text-xs"
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Orders</CardTitle>
          <CardDescription>{pr ? `${pr.total} in range` : ''}</CardDescription>
        </CardHeader>
        <CardContent>
          {listQ.isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : items.length === 0 ? (
            <p className="text-muted-foreground text-sm">No orders for these filters.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-border border-b">
                      <th className="pb-2 font-medium">When</th>
                      <th className="pb-2 font-medium">Vendor</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 font-medium">Payment</th>
                      <th className="pb-2 font-medium">Amount</th>
                      <th className="pb-2 font-medium">Items</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((row) => (
                      <tr
                        key={row.id}
                        className="border-border/80 hover:bg-muted/40 cursor-pointer border-b"
                        onClick={() => openDetail(row)}
                      >
                        <td className="text-muted-foreground py-2 pr-4 whitespace-nowrap">
                          {new Date(row.createdAt).toLocaleString()}
                        </td>
                        <td className="py-2 pr-4">{row.vendor.name}</td>
                        <td className="py-2 pr-4">
                          <Badge variant="secondary">{row.status}</Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs">{row.paymentStatus}</td>
                        <td className="py-2 pr-4">{money.format(row.finalAmount)}</td>
                        <td className="py-2">{row._count.items}</td>
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

      <Sheet open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <SheetContent className="flex w-full flex-col overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>Order detail</SheetTitle>
            <SheetDescription className="font-mono text-xs">{selected?.id}</SheetDescription>
          </SheetHeader>
          {detailQ.isLoading ? (
            <Skeleton className="mx-4 h-40 w-auto" />
          ) : detailObj ? (
            <div className="space-y-4 px-4 pb-4 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="text-muted-foreground">Status</div>
                <div>{String(detailObj.status ?? '—')}</div>
                <div className="text-muted-foreground">Amount</div>
                <div>
                  {typeof detailObj.finalAmount === 'number'
                    ? money.format(detailObj.finalAmount)
                    : '—'}
                </div>
                <div className="text-muted-foreground">Payment</div>
                <div>
                  {String(detailObj.paymentStatus ?? '—')} ({String(detailObj.paymentMethod ?? '—')})
                </div>
              </div>
              {Array.isArray(detailObj.items) && detailObj.items.length > 0 && (
                <div>
                  <p className="mb-2 font-medium">Items</p>
                  <ul className="space-y-1 text-xs">
                    {(detailObj.items as Record<string, unknown>[]).map((it, i) => (
                      <li key={i} className="border-border rounded border p-2">
                        <span className="font-medium">{String(it.productName ?? '')}</span>
                        <span className="text-muted-foreground">
                          {' '}
                          × {String(it.quantity ?? '')} {String(it.unit ?? '')}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {selected && allowedNext.length > 0 && (
                <AdminOrderStatusForm
                  key={`${selected.id}-${statusForActions}`}
                  orderId={selected.id}
                  allowedNext={allowedNext}
                  onDone={() => {
                    void queryClient.invalidateQueries({ queryKey: ['admin-orders'] })
                    void queryClient.invalidateQueries({ queryKey: ['admin-order', selected.id] })
                  }}
                />
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  )
}
