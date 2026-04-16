import { useQuery } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import {
  getMetrics,
  getOrderFunnel,
  getRevenueChart,
  getTopVendors,
} from '@/services/admin-metrics.service'

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

export function DashboardPage() {
  const today = useMemo(() => new Date(), [])
  const defaultTo = ymd(today)
  const defaultFrom = ymd(new Date(today.getTime() - 30 * 86400000))

  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(defaultTo)
  const [city, setCity] = useState('')
  const [chartDays, setChartDays] = useState(30)

  const range = rangeParams(from, to)
  const cityTrim = city.trim() || undefined

  const metricsQ = useQuery({
    queryKey: ['admin-metrics', range.from, range.to, cityTrim ?? ''],
    queryFn: () => getMetrics({ ...range, city: cityTrim }),
  })

  const chartQ = useQuery({
    queryKey: ['admin-revenue-chart', chartDays, cityTrim ?? ''],
    queryFn: () => getRevenueChart({ days: chartDays, city: cityTrim }),
  })

  const funnelQ = useQuery({
    queryKey: ['admin-funnel', range.from, range.to],
    queryFn: () => getOrderFunnel(range),
  })

  const topQ = useQuery({
    queryKey: ['admin-top-vendors', range.from, range.to],
    queryFn: () => getTopVendors({ limit: 10, ...range }),
  })

  const funnelBars = funnelQ.data
    ? [
        { stage: 'Placed', count: funnelQ.data.placed },
        { stage: 'Confirmed+', count: funnelQ.data.confirmed },
        { stage: 'Delivered', count: funnelQ.data.delivered },
        { stage: 'Cancelled', count: funnelQ.data.cancelled },
        { stage: 'Refunded', count: funnelQ.data.refunded },
      ]
    : []

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Platform metrics and trends</p>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="from">From</Label>
          <Input
            id="from"
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="w-[11rem]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="to">To</Label>
          <Input id="to" type="date" value={to} onChange={(e) => setTo(e.target.value)} className="w-[11rem]" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="city">City (optional)</Label>
          <Input
            id="city"
            placeholder="Filter by vendor city"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            className="w-[14rem]"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="days">Chart days</Label>
          <Input
            id="days"
            type="number"
            min={1}
            max={365}
            value={chartDays}
            onChange={(e) => setChartDays(Number(e.target.value) || 30)}
            className="w-[6rem]"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Orders (period)"
          loading={metricsQ.isLoading}
          value={metricsQ.data ? String(metricsQ.data.orders.total) : '—'}
          hint={`${metricsQ.data?.orders.delivered ?? '—'} delivered`}
        />
        <MetricCard
          title="GMV"
          loading={metricsQ.isLoading}
          value={metricsQ.data ? money.format(metricsQ.data.revenue.gmv) : '—'}
          hint={`Platform ${metricsQ.data ? money.format(metricsQ.data.revenue.platformRevenue) : '—'}`}
        />
        <MetricCard
          title="Completion rate"
          loading={metricsQ.isLoading}
          value={metricsQ.data ? `${metricsQ.data.orders.completionRate}%` : '—'}
          hint="Delivered / total"
        />
        <MetricCard
          title="Today"
          loading={metricsQ.isLoading}
          value={
            metricsQ.data?.today
              ? `${metricsQ.data.today.deliveredOrders} delivered`
              : '—'
          }
          hint={
            metricsQ.data?.today
              ? `${metricsQ.data.today.cancelledOrders} cancelled`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Revenue & orders</CardTitle>
            <CardDescription>Daily GMV from delivered orders</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {chartQ.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : chartQ.data && chartQ.data.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartQ.data}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8 }}
                    formatter={(v: number, name) =>
                      name === 'revenue' ? money.format(v) : v
                    }
                  />
                  <Line type="monotone" dataKey="revenue" stroke="#e8563c" dot={false} strokeWidth={2} />
                  <Line type="monotone" dataKey="orders" stroke="#64748b" dot={false} strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-muted-foreground text-sm">No chart data for this range.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Order funnel</CardTitle>
            <CardDescription>Counts in the selected date range</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {funnelQ.isLoading ? (
              <Skeleton className="h-full w-full" />
            ) : funnelQ.data ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelBars}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip contentStyle={{ borderRadius: 8 }} />
                  <Bar dataKey="count" fill="#e8563c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Top vendors</CardTitle>
          <CardDescription>By GMV in the selected period</CardDescription>
        </CardHeader>
        <CardContent>
          {topQ.isLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : topQ.data && topQ.data.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-border border-b">
                    <th className="pb-2 font-medium">Vendor</th>
                    <th className="pb-2 font-medium">City</th>
                    <th className="pb-2 font-medium">Orders</th>
                    <th className="pb-2 font-medium">GMV</th>
                    <th className="pb-2 font-medium">Rating</th>
                  </tr>
                </thead>
                <tbody>
                  {topQ.data.map((row) => (
                    <tr key={row.vendor?.id ?? row.gmv} className="border-border/80 border-b">
                      <td className="py-2 pr-4">{row.vendor?.name ?? '—'}</td>
                      <td className="py-2 pr-4">{row.vendor?.city ?? '—'}</td>
                      <td className="py-2 pr-4">{row.orderCount}</td>
                      <td className="py-2 pr-4">{money.format(row.gmv)}</td>
                      <td className="py-2">{row.vendor?.rating?.toFixed(1) ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">No vendors in this period.</p>
          )}
        </CardContent>
      </Card>

      {metricsQ.data && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard
            title="New customers"
            loading={false}
            value={String(metricsQ.data.users.newCustomers)}
            hint="Registered in period"
          />
          <MetricCard
            title="Active vendors"
            loading={false}
            value={String(metricsQ.data.operations.activeVendors)}
            hint="Currently active"
          />
          <MetricCard
            title="Online riders"
            loading={false}
            value={String(metricsQ.data.operations.onlineRiders)}
            hint="Now"
          />
        </div>
      )}
    </div>
  )
}

function MetricCard({
  title,
  value,
  hint,
  loading,
}: {
  title: string
  value: string
  hint?: string
  loading: boolean
}) {
  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-muted-foreground text-sm font-medium">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-8 w-24" />
        ) : (
          <>
            <p className="text-xl font-semibold tracking-tight">{value}</p>
            {hint && <p className="text-muted-foreground mt-1 text-xs">{hint}</p>}
          </>
        )}
      </CardContent>
    </Card>
  )
}
