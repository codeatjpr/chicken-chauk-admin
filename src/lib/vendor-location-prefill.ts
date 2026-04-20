import type { LocationSelection } from '@/types/location'

/** Google fallbacks when we don’t have a real formatted address — don’t put these in the address field. */
const GENERIC_DISPLAY = /^(current location|pinned location|selected location)$/i

/**
 * Full formatted address for the vendor “Address” field (editable by admin).
 * Prefers Google’s complete `displayName` / formatted address (e.g. road, area, city, state, PIN, country).
 */
export function addressLineFromSelection(sel: LocationSelection): string | undefined {
  const full = sel.displayName?.trim()
  if (full && !GENERIC_DISPLAY.test(full)) {
    return full
  }
  const a1 = sel.addressLine1?.trim()
  if (a1) return a1
  const ar = sel.area?.trim()
  if (ar) return ar
  return undefined
}

/** Values to copy into vendor address / city / PIN when a place is resolved (search or GPS). */
export function vendorFormPatchFromLocation(sel: LocationSelection): {
  addressLine?: string
  city?: string
  pincode?: string
} {
  const out: { addressLine?: string; city?: string; pincode?: string } = {}
  const addr = addressLineFromSelection(sel)
  if (addr) out.addressLine = addr
  if (sel.city?.trim()) out.city = sel.city.trim()
  const pin = sel.pincode?.replace(/\D/g, '').slice(0, 6)
  if (pin) out.pincode = pin
  return out
}
