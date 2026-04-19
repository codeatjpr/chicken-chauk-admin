import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useState } from 'react'
import { Link } from 'react-router-dom'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import {
  assignRiderToOrder,
  getRiderDeliveriesAdmin,
  getRiderStatsAdmin,
  listRiders,
  type RiderAdminRow,
} from '@/services/delivery-admin.service'

const money = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
})

export function DeliveryRidersPage() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const limit = 20
  const [onlineFilter, setOnlineFilter] = useState<'any' | 'true' | 'false'>('any')
  const [verifiedFilter, setVerifiedFilter] = useState<'any' | 'true' | 'false'>('any')
  const [selected, setSelected] = useState<RiderAdminRow | null>(null)
  const [delPage, setDelPage] = useState(1)
  const delLimit = 15
  const [assignOrderId, setAssignOrderId] = useState('')
  const [assignRiderId, setAssignRiderId] = useState('')
  const [assignConfirmOpen, setAssignConfirmOpen] = useState(false)

  const ridersQ = useQuery({
    queryKey: ['admin-riders', page, onlineFilter, verifiedFilter],
    queryFn: () =>
      listRiders({
        page,
        limit,
        ...(onlineFilter !== 'any' && { isOnline: onlineFilter === 'true' }),
        ...(verifiedFilter !== 'any' && { isVerified: verifiedFilter === 'true' }),
      }),
  })

  const statsQ = useQuery({
    queryKey: ['admin-rider-stats', selected?.id],
    queryFn: () => getRiderStatsAdmin(selected!.id),
    enabled: !!selected,
  })

  const deliveriesQ = useQuery({
    queryKey: ['admin-rider-deliveries', selected?.id, delPage],
    queryFn: () => getRiderDeliveriesAdmin(selected!.id, delPage, delLimit),
    enabled: !!selected,
  })

  const assignMut = useMutation({
    mutationFn: () => assignRiderToOrder(assignOrderId.trim(), assignRiderId.trim()),
    onSuccess: () => {
      toast.success('Rider assigned')
      setAssignOrderId('')
      if (selected && assignRiderId.trim() === selected.id) {
        void queryClient.invalidateQueries({ queryKey: ['admin-rider-deliveries', selected.id] })
        void queryClient.invalidateQueries({ queryKey: ['admin-rider-stats', selected.id] })
      }
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Assign failed')),
  })

  const riders = ridersQ.data
  const items = riders?.items ?? []
  const rTotalPages = riders?.totalPages ?? 1
  const rHasPrev = page > 1
  const rHasNext = page < rTotalPages

  const del = deliveriesQ.data
  const dTotalPages = del?.totalPages ?? 1
  const dHasPrev = delPage > 1
  const dHasNext = delPage < dTotalPages

  function pickRider(row: RiderAdminRow) {
    setSelected(row)
    setDelPage(1)
    setAssignRiderId(row.id)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Delivery & riders</h1>
          <p className="text-muted-foreground text-sm">
            List riders, inspect history and stats, assign a rider to an order (admin).
          </p>
        </div>
        <Link to="/admin/delivery/onboard" className={cn(buttonVariants({ size: 'sm' }), 'shrink-0')}>
          Onboard rider
        </Link>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Assign rider to order</CardTitle>
          <CardDescription>Uses POST /delivery/assign with order and rider IDs.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label htmlFor="as-order">Order ID</Label>
            <Input
              id="as-order"
              className="font-mono text-xs"
              placeholder="UUID"
              value={assignOrderId}
              onChange={(e) => setAssignOrderId(e.target.value)}
            />
          </div>
          <div className="min-w-[12rem] flex-1 space-y-1">
            <Label htmlFor="as-rider">Rider ID</Label>
            <Input
              id="as-rider"
              className="font-mono text-xs"
              placeholder="UUID (defaults when you select a row)"
              value={assignRiderId}
              onChange={(e) => setAssignRiderId(e.target.value)}
            />
          </div>
          <Button
            type="button"
            disabled={assignMut.isPending || !assignOrderId.trim() || !assignRiderId.trim()}
            onClick={() => setAssignConfirmOpen(true)}
          >
            Assign
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={assignConfirmOpen} onOpenChange={setAssignConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Assign rider to order?</AlertDialogTitle>
            <AlertDialogDescription>
              Order <span className="font-mono text-xs">{assignOrderId.trim()}</span> → rider{' '}
              <span className="font-mono text-xs">{assignRiderId.trim()}</span>. This updates delivery routing for that
              order.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              disabled={assignMut.isPending}
              onClick={() => {
                setAssignConfirmOpen(false)
                assignMut.mutate()
              }}
            >
              Confirm assign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Riders</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <Label htmlFor="f-on">Online</Label>
            <select
              id="f-on"
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={onlineFilter}
              onChange={(e) => {
                setOnlineFilter(e.target.value as 'any' | 'true' | 'false')
                setPage(1)
              }}
            >
              <option value="any">Any</option>
              <option value="true">Online</option>
              <option value="false">Offline</option>
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="f-ver">Verified</Label>
            <select
              id="f-ver"
              className="border-input bg-background h-8 rounded-lg border px-2 text-sm"
              value={verifiedFilter}
              onChange={(e) => {
                setVerifiedFilter(e.target.value as 'any' | 'true' | 'false')
                setPage(1)
              }}
            >
              <option value="any">Any</option>
              <option value="true">Verified</option>
              <option value="false">Not verified</option>
            </select>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>All riders</CardTitle>
            <CardDescription>{riders ? `${riders.total} total` : ''}</CardDescription>
          </CardHeader>
          <CardContent>
            {ridersQ.isLoading ? (
              <Skeleton className="h-40 w-full" />
            ) : items.length === 0 ? (
              <p className="text-muted-foreground text-sm">No riders.</p>
            ) : (
              <>
                <div className="max-h-[28rem] overflow-y-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-border sticky top-0 bg-card border-b">
                        <th className="pb-2 font-medium">Name / phone</th>
                        <th className="pb-2 font-medium">Status</th>
                        <th className="pb-2 font-medium text-right">Select</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((row) => (
                        <tr
                          key={row.id}
                          className={`border-border/80 cursor-pointer border-b ${selected?.id === row.id ? 'bg-primary/5' : ''}`}
                          onClick={() => pickRider(row)}
                        >
                          <td className="py-2 pr-2">
                            <span className="font-medium">{row.user.name ?? '—'}</span>
                            <p className="text-muted-foreground text-xs">{row.user.phone}</p>
                            <p className="text-muted-foreground font-mono text-[10px]">{row.id}</p>
                          </td>
                          <td className="py-2 pr-2">
                            <div className="flex flex-wrap gap-1">
                              <Badge variant={row.isOnline ? 'secondary' : 'outline'}>
                                {row.isOnline ? 'Online' : 'Off'}
                              </Badge>
                              <Badge variant={row.isVerified ? 'secondary' : 'outline'}>
                                {row.isVerified ? 'Verified' : 'New'}
                              </Badge>
                              <Badge variant={row.isActive ? 'secondary' : 'destructive'}>
                                {row.isActive ? 'Active' : 'Inactive'}
                              </Badge>
                            </div>
                          </td>
                          <td className="py-2 text-right">
                            <Button type="button" size="sm" variant={selected?.id === row.id ? 'default' : 'outline'}>
                              View
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {rTotalPages > 1 && (
                  <div className="text-muted-foreground mt-3 flex items-center justify-between text-sm">
                    <span>
                      Page {page} / {rTotalPages}
                    </span>
                    <div className="flex gap-2">
                      <Button type="button" variant="outline" size="sm" disabled={!rHasPrev} onClick={() => setPage((p) => p - 1)}>
                        Prev
                      </Button>
                      <Button type="button" variant="outline" size="sm" disabled={!rHasNext} onClick={() => setPage((p) => p + 1)}>
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
          <CardHeader>
            <CardTitle>Rider detail</CardTitle>
            <CardDescription>
              {selected ? `${selected.user.name ?? selected.user.phone}` : 'Select a rider from the list.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selected ? (
              <p className="text-muted-foreground text-sm">No rider selected.</p>
            ) : (
              <>
                {statsQ.isLoading ? (
                  <Skeleton className="h-20 w-full" />
                ) : statsQ.data ? (
                  <div className="grid grid-cols-2 gap-2 text-sm sm:grid-cols-3">
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground text-xs">Total deliveries</p>
                      <p className="font-semibold">{statsQ.data.totalDeliveries}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground text-xs">Total earnings</p>
                      <p className="font-semibold">{money.format(statsQ.data.totalEarnings)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground text-xs">Rating</p>
                      <p className="font-semibold">{statsQ.data.rating.toFixed(1)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground text-xs">Today deliveries</p>
                      <p className="font-semibold">{statsQ.data.todayDeliveries}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-2">
                      <p className="text-muted-foreground text-xs">Today earnings</p>
                      <p className="font-semibold">{money.format(statsQ.data.todayEarnings)}</p>
                    </div>
                  </div>
                ) : null}

                <div>
                  <h3 className="mb-2 text-sm font-medium">Recent deliveries</h3>
                  {deliveriesQ.isLoading ? (
                    <Skeleton className="h-32 w-full" />
                  ) : !del?.items.length ? (
                    <p className="text-muted-foreground text-sm">No deliveries yet.</p>
                  ) : (
                    <>
                      <div className="max-h-60 overflow-y-auto">
                        <table className="w-full text-left text-xs">
                          <thead>
                            <tr className="border-border border-b">
                              <th className="pb-1 font-medium">Status</th>
                              <th className="pb-1 font-medium">Vendor</th>
                              <th className="pb-1 font-medium">Amount</th>
                              <th className="pb-1 font-medium">Assigned</th>
                            </tr>
                          </thead>
                          <tbody>
                            {del.items.map((d) => (
                              <tr key={d.id} className="border-border/60 border-b">
                                <td className="py-1 pr-2">{d.status}</td>
                                <td className="py-1 pr-2">{d.order.vendor.name}</td>
                                <td className="py-1 pr-2">{money.format(d.order.finalAmount)}</td>
                                <td className="text-muted-foreground py-1">
                                  {new Date(d.assignedAt).toLocaleString()}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                      {dTotalPages > 1 && (
                        <div className="text-muted-foreground mt-2 flex items-center justify-between text-xs">
                          <span>
                            {delPage} / {dTotalPages}
                          </span>
                          <div className="flex gap-1">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!dHasPrev}
                              onClick={() => setDelPage((p) => p - 1)}
                            >
                              Prev
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              disabled={!dHasNext}
                              onClick={() => setDelPage((p) => p + 1)}
                            >
                              Next
                            </Button>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
