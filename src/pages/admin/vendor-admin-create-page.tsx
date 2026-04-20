import { useMutation } from '@tanstack/react-query'
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react'
import { useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ImageUploadField } from '@/components/forms/image-upload-field'
import { LocationPinMap } from '@/components/maps/location-pin-map'
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
import { Button, buttonVariants } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getApiErrorMessage } from '@/lib/api-error'
import { vendorFormPatchFromLocation } from '@/lib/vendor-location-prefill'
import { cn } from '@/lib/utils'
import {
  adminCreateVendorOnboarding,
  adminSetVendorOnboardingBank,
  adminSetVendorOnboardingTimings,
  adminUploadVendorBanner,
  adminUploadVendorLogo,
  adminUploadVendorOnboardingDocument,
  approveVendor,
  type AdminCreateVendorBody,
  type VendorTimingInput,
} from '@/services/vendors-admin.service'

const STEPS = [
  { id: 1, title: 'Account & shop' },
  { id: 2, title: 'Documents' },
  { id: 3, title: 'Hours' },
  { id: 4, title: 'Bank' },
  { id: 5, title: 'Approve' },
] as const

const DOC_TYPES = ['FSSAI', 'GST', 'PAN', 'TRADE_LICENSE', 'BANK_STATEMENT'] as const

const DOC_LABELS: Record<(typeof DOC_TYPES)[number], string> = {
  FSSAI: 'FSSAI',
  GST: 'GST',
  PAN: 'PAN',
  TRADE_LICENSE: 'Trade license',
  BANK_STATEMENT: 'Bank statement',
}

const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

/** Strip spaces, optional +91 / 91 prefix — backend expects 10-digit Indian mobile. */
function normalizeIndianPhone(raw: string): string {
  let s = raw.trim().replace(/\s/g, '')
  if (s.startsWith('+91')) s = s.slice(3)
  else if (s.length === 12 && s.startsWith('91')) s = s.slice(2)
  return s
}

function defaultTimings(): VendorTimingInput[] {
  return Array.from({ length: 7 }, (_, dayOfWeek) => ({
    dayOfWeek,
    openTime: '09:00',
    closeTime: '22:00',
    isClosed: false,
  }))
}

export function VendorAdminCreatePage() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [vendorId, setVendorId] = useState<string | null>(null)

  const [name, setName] = useState('')
  const [ownerName, setOwnerName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [description, setDescription] = useState('')
  const [addressLine, setAddressLine] = useState('')
  const [city, setCity] = useState('')
  const [pincode, setPincode] = useState('')
  const [latitude, setLatitude] = useState('')
  const [longitude, setLongitude] = useState('')
  const [prepTime, setPrepTime] = useState('20')
  const [minOrderAmount, setMinOrderAmount] = useState('0')
  const [deliveryRadiusKm, setDeliveryRadiusKm] = useState('3')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [bannerFile, setBannerFile] = useState<File | null>(null)

  const [docFiles, setDocFiles] = useState<Partial<Record<(typeof DOC_TYPES)[number], File | null>>>({})
  const [timings, setTimings] = useState<VendorTimingInput[]>(defaultTimings)

  const [bankHolder, setBankHolder] = useState('')
  const [bankNumber, setBankNumber] = useState('')
  const [bankIfsc, setBankIfsc] = useState('')
  const [bankName, setBankName] = useState('')
  const [bankUpi, setBankUpi] = useState('')

  const actionRunRef = useRef<(() => void) | null>(null)
  const [actionDialog, setActionDialog] = useState<{
    open: boolean
    title: string
    description: string
    destructive?: boolean
  }>({ open: false, title: '', description: '' })

  function requestActionConfirm(opts: {
    title: string
    description: string
    destructive?: boolean
    run: () => void
  }) {
    actionRunRef.current = opts.run
    setActionDialog({
      open: true,
      title: opts.title,
      description: opts.description,
      destructive: opts.destructive,
    })
  }

  function flushActionConfirm() {
    const run = actionRunRef.current
    actionRunRef.current = null
    setActionDialog((s) => ({ ...s, open: false }))
    run?.()
  }

  const createMut = useMutation({
    mutationFn: async () => {
      const lat = Number(latitude)
      const lng = Number(longitude)
      const phoneDigits = normalizeIndianPhone(phone)
      if (!name.trim() || !ownerName.trim() || !phone.trim() || password.length < 8) {
        throw new Error('Name, owner, 10-digit phone, and password (8+ chars) are required.')
      }
      if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
        throw new Error('Phone must be a valid 10-digit Indian mobile (6–9 first digit). Remove +91 if present.')
      }
      if (!/^\d{6}$/.test(pincode.trim())) {
        throw new Error('PIN must be 6 digits.')
      }
      if (Number.isNaN(lat) || Number.isNaN(lng)) {
        throw new Error('Latitude and longitude must be numbers.')
      }
      const prep = Math.min(120, Math.max(5, Math.round(Number(prepTime)) || 20))
      const radius = Math.min(20, Math.max(0.5, Number(deliveryRadiusKm) || 3))
      const body: AdminCreateVendorBody = {
        name: name.trim(),
        ownerName: ownerName.trim(),
        phone: phoneDigits,
        addressLine: addressLine.trim(),
        city: city.trim(),
        pincode: pincode.trim(),
        latitude: lat,
        longitude: lng,
        password,
        prepTime: prep,
        minOrderAmount: Number(minOrderAmount) || 0,
        deliveryRadiusKm: radius,
      }
      if (email.trim()) body.email = email.trim()
      if (description.trim()) body.description = description.trim()
      const v = await adminCreateVendorOnboarding(body)
      setVendorId(v.id)
      if (logoFile) await adminUploadVendorLogo(v.id, logoFile)
      if (bannerFile) await adminUploadVendorBanner(v.id, bannerFile)
      return v
    },
    onSuccess: () => {
      toast.success('Vendor account created. Upload documents next.')
      setStep(2)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Create failed')),
  })

  const docsMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error('Missing vendor')
      const entries = DOC_TYPES.map((t) => [t, docFiles[t]] as const).filter(([, f]) => f)
      if (entries.length === 0) throw new Error('Select at least one document file to upload.')
      for (const [t, file] of entries) {
        if (file) await adminUploadVendorOnboardingDocument(vendorId, t, file)
      }
    },
    onSuccess: () => {
      toast.success('Documents uploaded')
      setStep(3)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Upload failed')),
  })

  const timingsMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error('Missing vendor')
      await adminSetVendorOnboardingTimings(vendorId, timings)
    },
    onSuccess: () => {
      toast.success('Hours saved')
      setStep(4)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Save hours failed')),
  })

  const bankMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error('Missing vendor')
      const upi = bankUpi.trim()
      const hasUpi = upi.length > 0
      const hasAnyBankField = !!(bankHolder.trim() || bankNumber.trim() || bankIfsc.trim() || bankName.trim())
      const hasFullBank = !!(
        bankHolder.trim() &&
        bankNumber.replace(/\s/g, '').length >= 9 &&
        bankIfsc.trim() &&
        bankName.trim()
      )
      if (!hasUpi && !hasFullBank) {
        throw new Error('Enter a UPI ID (e.g. shop@paytm) or complete all four bank fields.')
      }
      if (hasAnyBankField && !hasFullBank) {
        throw new Error('If using a bank account, fill holder, account number, IFSC, and bank name.')
      }
      const ifsc = bankIfsc.trim().toUpperCase()
      if (hasFullBank && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc)) {
        throw new Error('IFSC must look like ABCD0123456.')
      }
      if (hasFullBank && !/^\d{9,18}$/.test(bankNumber.replace(/\s/g, ''))) {
        throw new Error('Account number must be 9–18 digits.')
      }
      if (hasUpi && !/^[a-zA-Z0-9._-]{2,256}@[a-zA-Z][a-zA-Z0-9.-]*$/.test(upi)) {
        throw new Error('Invalid UPI ID format.')
      }
      await adminSetVendorOnboardingBank(vendorId, {
        ...(hasFullBank
          ? {
              accountHolderName: bankHolder.trim(),
              accountNumber: bankNumber.replace(/\s/g, ''),
              ifscCode: ifsc,
              bankName: bankName.trim(),
            }
          : {}),
        ...(hasUpi ? { upiId: upi } : {}),
      })
    },
    onSuccess: () => {
      toast.success('Bank details saved')
      setStep(5)
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Bank save failed')),
  })

  const approveMut = useMutation({
    mutationFn: async () => {
      if (!vendorId) throw new Error('Missing vendor')
      await approveVendor(vendorId)
    },
    onSuccess: () => {
      toast.success('Vendor approved — they can sign in with the phone and password you set.')
      navigate('/admin/vendors')
    },
    onError: (e) => toast.error(getApiErrorMessage(e, 'Approve failed')),
  })

  const step1Ok = useMemo(() => {
    const phoneDigits = normalizeIndianPhone(phone)
    return (
      name.trim().length >= 2 &&
      ownerName.trim().length >= 2 &&
      /^[6-9]\d{9}$/.test(phoneDigits) &&
      password.length >= 8 &&
      addressLine.trim().length >= 5 &&
      city.trim().length >= 2 &&
      /^\d{6}$/.test(pincode.trim()) &&
      latitude.trim() !== '' &&
      longitude.trim() !== '' &&
      !Number.isNaN(Number(latitude)) &&
      !Number.isNaN(Number(longitude))
    )
  }, [name, ownerName, phone, password, addressLine, city, pincode, latitude, longitude])

  const step1Hint = useMemo((): string | null => {
    if (step1Ok) return null
    if (name.trim().length < 2) return 'Enter shop name (at least 2 characters).'
    if (ownerName.trim().length < 2) return 'Enter owner full name (at least 2 characters).'
    const phoneDigits = normalizeIndianPhone(phone)
    if (!/^[6-9]\d{9}$/.test(phoneDigits)) {
      return 'Phone must be 10 digits starting with 6–9. You can paste +91 9876543210 — we strip the country code.'
    }
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (addressLine.trim().length < 5) return 'Address line must be at least 5 characters.'
    if (city.trim().length < 2) return 'Enter city (at least 2 characters).'
    if (!/^\d{6}$/.test(pincode.trim())) return 'PIN code must be exactly 6 digits.'
    if (latitude.trim() === '' || longitude.trim() === '' || Number.isNaN(Number(latitude)) || Number.isNaN(Number(longitude))) {
      return 'Set shop location: search the address or use “Use my location” (coordinates apply automatically).'
    }
    return null
  }, [step1Ok, name, ownerName, phone, password, addressLine, city, pincode, latitude, longitude])

  function updateTiming(day: number, patch: Partial<VendorTimingInput>) {
    setTimings((prev) => prev.map((t) => (t.dayOfWeek === day ? { ...t, ...patch } : t)))
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Onboard vendor (admin)</h1>
        <p className="text-muted-foreground text-sm">
          Create the vendor login, shop profile, compliance files, hours, and bank details, then approve — all from
          here.
        </p>
      </div>

      <div className="flex flex-wrap gap-1">
        {STEPS.map((s) => (
          <button
            key={s.id}
            type="button"
            disabled={s.id > 1 && !vendorId}
            onClick={() => {
              if (s.id === 1 || vendorId) setStep(s.id)
            }}
            className={cn(
              'rounded-full px-3 py-1 text-xs font-medium transition-colors',
              step === s.id ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80',
              s.id > 1 && !vendorId && 'pointer-events-none opacity-40',
            )}
          >
            {s.id}. {s.title}
          </button>
        ))}
      </div>

      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Account & shop</CardTitle>
            <CardDescription>
              Creates a VENDOR user (same phone) with your password and a pending shop. Approve on the last step.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field label="Shop name" value={name} onChange={setName} className="sm:col-span-2" />
            <Field label="Owner full name" value={ownerName} onChange={setOwnerName} />
            <Field label="Phone (10 digits)" value={phone} onChange={setPhone} placeholder="9876543210" />
            <Field label="Email (optional)" value={email} onChange={setEmail} type="email" />
            <Field
              label="Vendor app password"
              value={password}
              onChange={setPassword}
              type="password"
              className="sm:col-span-2"
              hint="Min. 8 characters — vendor uses this with phone to sign in."
            />
            <div className="space-y-2 sm:col-span-2">
              <LocationPinMap
                latitude={latitude}
                longitude={longitude}
                initialSelectedSummary=""
                onPick={(la, lo) => {
                  setLatitude(la.toFixed(6))
                  setLongitude(lo.toFixed(6))
                }}
                onResolvedPlace={(sel) => {
                  const p = vendorFormPatchFromLocation(sel)
                  if (p.addressLine) setAddressLine(p.addressLine)
                  if (p.city) setCity(p.city)
                  if (p.pincode) setPincode(p.pincode)
                }}
              />
            </div>
            <Field label="Address line" value={addressLine} onChange={setAddressLine} className="sm:col-span-2" />
            <Field label="City" value={city} onChange={setCity} />
            <Field label="PIN code" value={pincode} onChange={setPincode} />
            <Field label="Prep time (minutes)" value={prepTime} onChange={setPrepTime} />
            <Field label="Min order (₹)" value={minOrderAmount} onChange={setMinOrderAmount} />
            <Field label="Delivery radius (km)" value={deliveryRadiusKm} onChange={setDeliveryRadiusKm} />
            <Field label="Description (optional)" value={description} onChange={setDescription} className="sm:col-span-2" />
            <ImageUploadField
              label="Logo image (optional)"
              file={logoFile}
              onFileChange={setLogoFile}
              className="sm:col-span-2"
              previewClassName="w-full"
              hint="Upload a shop logo instead of pasting a URL."
            />
            <ImageUploadField
              label="Banner image (optional)"
              file={bannerFile}
              onFileChange={setBannerFile}
              className="sm:col-span-2"
              previewClassName="w-full"
              hint="Upload a wide banner instead of pasting a URL."
            />
            {step1Hint && (
              <p className="text-muted-foreground border-destructive/30 bg-destructive/5 rounded-md border px-3 py-2 text-sm sm:col-span-2">
                {step1Hint}
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 sm:col-span-2">
              <Link to="/admin/vendors" className={cn(buttonVariants({ variant: 'outline', size: 'sm' }), 'inline-flex')}>
                Cancel
              </Link>
              <Button
                type="button"
                disabled={!step1Ok || createMut.isPending}
                onClick={() =>
                  requestActionConfirm({
                    title: 'Create vendor account?',
                    description: `Creates the shop “${name.trim()}” and owner login. You can continue with documents next.`,
                    run: () => createMut.mutate(),
                  })
                }
              >
                {createMut.isPending ? (
                  <>
                    <Loader2 className="size-4 animate-spin" aria-hidden />
                    Creating…
                  </>
                ) : (
                  <>
                    Create & continue
                    <ChevronRight className="size-4" aria-hidden />
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 2 && vendorId && (
        <Card>
          <CardHeader>
            <CardTitle>Compliance documents</CardTitle>
            <CardDescription>JPEG, PNG, or PDF per file (max 5 MB). Upload what you have; you can add more later.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {DOC_TYPES.map((t) => (
              <div key={t} className="space-y-1">
                <Label>{DOC_LABELS[t]}</Label>
                <Input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  onChange={(e) =>
                    setDocFiles((prev) => ({ ...prev, [t]: e.target.files?.[0] ?? null }))
                  }
                />
              </div>
            ))}
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(1)}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                disabled={docsMut.isPending}
                onClick={() =>
                  requestActionConfirm({
                    title: 'Upload selected documents?',
                    description: 'Files you picked will be sent to compliance storage for this vendor.',
                    run: () => docsMut.mutate(),
                  })
                }
              >
                {docsMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Upload & continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && vendorId && (
        <Card>
          <CardHeader>
            <CardTitle>Operating hours</CardTitle>
            <CardDescription>Adjust each day (24h times). Mark closed if needed.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {timings.map((t) => (
              <div
                key={t.dayOfWeek}
                className="flex flex-wrap items-end gap-2 border-b border-border/60 pb-3 last:border-0"
              >
                <span className="text-muted-foreground w-12 text-sm font-medium">{DAY_NAMES[t.dayOfWeek]}</span>
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={t.isClosed}
                    onChange={(e) => updateTiming(t.dayOfWeek, { isClosed: e.target.checked })}
                  />
                  Closed
                </label>
                {!t.isClosed && (
                  <>
                    <div className="space-y-1">
                      <Label className="text-xs">Open</Label>
                      <Input
                        className="w-28 font-mono text-sm"
                        value={t.openTime}
                        onChange={(e) => updateTiming(t.dayOfWeek, { openTime: e.target.value })}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Close</Label>
                      <Input
                        className="w-28 font-mono text-sm"
                        value={t.closeTime}
                        onChange={(e) => updateTiming(t.dayOfWeek, { closeTime: e.target.value })}
                      />
                    </div>
                  </>
                )}
              </div>
            ))}
            <div className="flex justify-between gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setStep(2)}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                disabled={timingsMut.isPending}
                onClick={() =>
                  requestActionConfirm({
                    title: 'Save operating hours?',
                    description: 'Stores the weekly schedule for this vendor.',
                    run: () => timingsMut.mutate(),
                  })
                }
              >
                {timingsMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Save & continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 4 && vendorId && (
        <Card>
          <CardHeader>
            <CardTitle>Payout: bank and/or UPI</CardTitle>
            <CardDescription>
              Provide a UPI ID (e.g. shopname@paytm), full bank details, or both for settlements.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Field
              label="UPI ID (optional if bank below is complete)"
              value={bankUpi}
              onChange={setBankUpi}
              placeholder="merchant@paytm"
              className="sm:col-span-2"
              hint="Use the shop’s UPI if they prefer instant transfers."
            />
            <p className="text-muted-foreground sm:col-span-2 text-xs font-medium">Bank account (optional if UPI above)</p>
            <Field label="Account holder name" value={bankHolder} onChange={setBankHolder} className="sm:col-span-2" />
            <Field label="Account number" value={bankNumber} onChange={setBankNumber} className="sm:col-span-2" />
            <Field label="IFSC" value={bankIfsc} onChange={setBankIfsc} placeholder="HDFC0001234" />
            <Field label="Bank name" value={bankName} onChange={setBankName} />
            <div className="flex justify-between gap-2 sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setStep(3)}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                disabled={bankMut.isPending}
                onClick={() =>
                  requestActionConfirm({
                    title: 'Save payout details?',
                    description: 'Saves UPI and/or bank account for settlements.',
                    run: () => bankMut.mutate(),
                  })
                }
              >
                {bankMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Save & continue'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 5 && vendorId && (
        <Card>
          <CardHeader>
            <CardTitle>Approve shop</CardTitle>
            <CardDescription>
              Vendor ID: <code className="text-xs">{vendorId}</code>. This activates the shop on the marketplace.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="text-muted-foreground space-y-1 text-sm">
              <li className="flex items-center gap-2">
                <Check className="text-primary size-4 shrink-0" aria-hidden />
                Account & shop created
              </li>
              <li className="flex items-center gap-2">
                <Check className="text-primary size-4 shrink-0" aria-hidden />
                Documents, hours, and bank saved in previous steps
              </li>
            </ul>
            <div className="flex flex-wrap justify-between gap-2">
              <Button type="button" variant="outline" onClick={() => setStep(4)}>
                <ChevronLeft className="size-4" aria-hidden />
                Back
              </Button>
              <Button
                type="button"
                disabled={approveMut.isPending}
                onClick={() =>
                  requestActionConfirm({
                    title: 'Approve vendor on marketplace?',
                    description: 'This activates the shop so it can receive orders.',
                    destructive: false,
                    run: () => approveMut.mutate(),
                  })
                }
              >
                {approveMut.isPending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : 'Approve vendor'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <AlertDialog
        open={actionDialog.open}
        onOpenChange={(o) => {
          if (!o) {
            actionRunRef.current = null
            setActionDialog((s) => ({ ...s, open: false }))
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{actionDialog.title}</AlertDialogTitle>
            <AlertDialogDescription>{actionDialog.description}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className={
                actionDialog.destructive
                  ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90'
                  : undefined
              }
              onClick={() => flushActionConfirm()}
            >
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  className,
  type = 'text',
  placeholder,
  hint,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  className?: string
  type?: string
  placeholder?: string
  hint?: string
}) {
  return (
    <div className={className}>
      <Label className="text-xs">{label}</Label>
      <Input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="mt-1" />
      {hint ? <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p> : null}
    </div>
  )
}
