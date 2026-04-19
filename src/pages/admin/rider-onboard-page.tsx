import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/api-error'
import { cn } from '@/lib/utils'
import { onboardRiderAdmin } from '@/services/delivery-admin.service'

const VEHICLES = [
  { value: 'BIKE', label: 'Bike' },
  { value: 'SCOOTER', label: 'Scooter' },
  { value: 'BICYCLE', label: 'Bicycle' },
] as const

export function RiderOnboardPage() {
  const queryClient = useQueryClient()
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [vehicleType, setVehicleType] = useState<(typeof VEHICLES)[number]['value']>('BIKE')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [licenseNumber, setLicenseNumber] = useState('')
  const [markVerified, setMarkVerified] = useState(true)

  const mut = useMutation({
    mutationFn: () =>
      onboardRiderAdmin({
        name: name.trim(),
        phone: phone.trim(),
        password,
        vehicleType,
        vehicleNumber: vehicleNumber.trim() || undefined,
        licenseNumber: licenseNumber.trim() || undefined,
        markVerified,
      }),
    onSuccess: (rider) => {
      toast.success(`Rider created · ID ${rider.id.slice(0, 8)}…`)
      void queryClient.invalidateQueries({ queryKey: ['admin-riders'] })
      setPassword('')
      setPhone('')
      setName('')
      setVehicleNumber('')
      setLicenseNumber('')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Onboard failed')),
  })

  const canSubmit =
    name.trim().length >= 2 &&
    phone.trim().length >= 10 &&
    password.length >= 8 &&
    !mut.isPending

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div className="flex items-center gap-3">
        <Link
          to="/admin/delivery"
          className={cn(buttonVariants({ variant: 'ghost', size: 'icon-sm' }))}
          aria-label="Back to delivery"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Onboard rider</h1>
          <p className="text-muted-foreground text-sm">
            Creates a RIDER login (phone + password) and delivery profile. They can sign in to the rider app.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Account & vehicle</CardTitle>
          <CardDescription>Phone must be unique. Use a 10-digit Indian mobile (you may paste +91…).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="r-name">Full name</Label>
            <Input id="r-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-phone">Phone</Label>
            <Input id="r-phone" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="9876543210" />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-pass">Password (min 8)</Label>
            <Input
              id="r-pass"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-vt">Vehicle type</Label>
            <select
              id="r-vt"
              className="border-input bg-background h-9 w-full rounded-lg border px-2 text-sm"
              value={vehicleType}
              onChange={(e) => setVehicleType(e.target.value as (typeof VEHICLES)[number]['value'])}
            >
              {VEHICLES.map((v) => (
                <option key={v.value} value={v.value}>
                  {v.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-vnum">Vehicle number (optional)</Label>
            <Input id="r-vnum" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="r-lic">License number (optional)</Label>
            <Input id="r-lic" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={markVerified} onChange={(e) => setMarkVerified(e.target.checked)} />
            Verified for deliveries (can go online and be assigned)
          </label>
          <Button type="button" className="w-full" disabled={!canSubmit} onClick={() => mut.mutate()}>
            {mut.isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Creating…
              </>
            ) : (
              'Create rider'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
