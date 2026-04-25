import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Loader2Icon, Settings2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { getApiErrorMessage } from '@/lib/api-error'
import {
  fetchPlatformSettings,
  updatePlatformSettings,
  type PlatformFeeSettings,
} from '@/services/platform-settings-admin.service'

const QK = ['admin', 'platform-settings'] as const

type FormProps = { settings: PlatformFeeSettings }

function PlatformSettingsForm({ settings }: FormProps) {
  const qc = useQueryClient()
  const [base, setBase] = useState(String(settings.deliveryFeeBase))
  const [freeAbove, setFreeAbove] = useState(String(settings.deliveryFeeFreeAbove))
  const [platformPct, setPlatformPct] = useState(String(settings.platformFeePercent))
  const [platformFixed, setPlatformFixed] = useState(String(settings.platformFeeFixed ?? 0))

  const mut = useMutation({
    mutationFn: () => {
      const d = parseFloat(base)
      const f = parseFloat(freeAbove)
      const p = parseFloat(platformPct)
      const fixed = parseFloat(platformFixed)
      if (!Number.isFinite(d) || d < 0) throw new Error('Invalid delivery fee')
      if (!Number.isFinite(f) || f < 0) throw new Error('Invalid free-delivery threshold')
      if (!Number.isFinite(p) || p < 0 || p > 100) throw new Error('Platform % must be 0–100')
      if (!Number.isFinite(fixed) || fixed < 0) throw new Error('Invalid fixed platform fee')
      return updatePlatformSettings({
        deliveryFeeBase: d,
        deliveryFeeFreeAbove: f,
        platformFeePercent: p,
        platformFeeFixed: fixed,
      })
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: QK })
      toast.success('Settings saved')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Could not save')),
  })

  return (
    <div className="max-w-lg space-y-6">
      <div>
        <h1 className="text-foreground text-2xl font-semibold tracking-tight">
          Platform fees
        </h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Delivery and platform fees used in cart validation and order totals.
        </p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="size-5" aria-hidden />
            Fee rules
          </CardTitle>
          <CardDescription>
            Changes apply to new checkouts immediately. Past orders are unchanged.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="delivery-base">Flat delivery fee (INR)</Label>
            <Input
              id="delivery-base"
              inputMode="decimal"
              value={base}
              onChange={(e) => setBase(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Charged when the order subtotal is below the free-delivery threshold.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="free-above">Free delivery above (INR subtotal)</Label>
            <Input
              id="free-above"
              inputMode="decimal"
              value={freeAbove}
              onChange={(e) => setFreeAbove(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-fixed">Platform fee — fixed (INR per order)</Label>
            <Input
              id="platform-fixed"
              inputMode="decimal"
              value={platformFixed}
              onChange={(e) => setPlatformFixed(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              If greater than zero, customers pay this flat amount per order instead of the
              percentage below. Set to 0 to use only the percentage.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="platform-pct">Platform fee (% of items subtotal)</Label>
            <Input
              id="platform-pct"
              inputMode="decimal"
              value={platformPct}
              onChange={(e) => setPlatformPct(e.target.value)}
            />
            <p className="text-muted-foreground text-xs">
              Used when fixed fee is 0.
            </p>
          </div>
          <Button
            type="button"
            onClick={() => mut.mutate()}
            disabled={mut.isPending}
            className="gap-2"
          >
            {mut.isPending && <Loader2Icon className="size-4 animate-spin" />}
            Save
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

export function PlatformSettingsPage() {
  const q = useQuery({ queryKey: QK, queryFn: fetchPlatformSettings })

  if (q.isLoading) {
    return (
      <div className="max-w-lg space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  if (q.isError || !q.data) {
    return <p className="text-destructive text-sm">Could not load platform settings.</p>
  }

  return <PlatformSettingsForm key={q.dataUpdatedAt} settings={q.data} />
}
