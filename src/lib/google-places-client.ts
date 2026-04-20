import type { LocationSelection } from '@/types/location'

const AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete'

type AutocompletePlacePrediction = {
  placeId?: string
  place?: string
  text?: { text?: string }
  structuredFormat?: {
    mainText?: { text?: string }
    secondaryText?: { text?: string }
  }
}

type AutocompleteSuggestion = {
  placePrediction?: AutocompletePlacePrediction
}

type AutocompleteResponse = {
  suggestions?: AutocompleteSuggestion[]
}

type AddressComponent = {
  longText?: string
  shortText?: string
  types?: string[]
}

export type PlaceDetailsPayload = {
  formattedAddress?: string
  displayName?: { text?: string }
  location?: { latitude?: number; longitude?: number }
  addressComponents?: AddressComponent[]
}

type GeocodeComponent = {
  long_name: string
  short_name: string
  types: string[]
}

type GeocodeResult = {
  formatted_address?: string
  address_components?: GeocodeComponent[]
}

type GeocodeResponse = {
  status: string
  results?: GeocodeResult[]
  error_message?: string
}

function pickComponent(
  components: AddressComponent[] | undefined,
  ...types: string[]
): string | undefined {
  if (!components?.length) return undefined
  const hit = components.find((c) => c.types?.some((t) => types.includes(t)))
  return hit?.longText?.trim() || hit?.shortText?.trim()
}

function pickGeocodeComponent(
  components: GeocodeComponent[] | undefined,
  ...types: string[]
): string | undefined {
  if (!components?.length) return undefined
  const hit = components.find((c) => c.types.some((t) => types.includes(t)))
  return hit?.long_name?.trim()
}

export function placeDetailsToSelection(details: PlaceDetailsPayload): LocationSelection | null {
  const lat = details.location?.latitude
  const lng = details.location?.longitude
  if (lat === undefined || lng === undefined || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }

  const components = details.addressComponents
  const streetNumber = pickComponent(components, 'street_number')
  const route = pickComponent(components, 'route')
  const premise = pickComponent(components, 'premise', 'subpremise')
  const line1Parts = [premise, streetNumber, route].filter(Boolean)
  const addressLine1Guess = line1Parts.length > 0 ? line1Parts.join(', ') : undefined

  const city =
    pickComponent(components, 'locality', 'administrative_area_level_2') ??
    pickComponent(components, 'postal_town')
  const state = pickComponent(components, 'administrative_area_level_1')
  const pincode = pickComponent(components, 'postal_code')
  const area =
    pickComponent(
      components,
      'sublocality_level_2',
      'sublocality_level_1',
      'sublocality',
      'neighborhood',
    ) ?? pickComponent(components, 'route')

  const displayName =
    details.formattedAddress?.trim() ||
    details.displayName?.text?.trim() ||
    'Selected location'

  return {
    latitude: lat,
    longitude: lng,
    displayName,
    city,
    state,
    pincode: pincode?.replace(/\D/g, '').slice(0, 6),
    area: area ?? city,
    addressLine1: addressLine1Guess,
  }
}

export function geocodeResultToSelection(result: GeocodeResult, lat: number, lng: number): LocationSelection {
  const components = result.address_components ?? []
  const streetNumber = pickGeocodeComponent(components, 'street_number')
  const route = pickGeocodeComponent(components, 'route')
  const premise = pickGeocodeComponent(components, 'premise', 'subpremise')
  const line1Parts = [premise, streetNumber, route].filter(Boolean)
  const addressLine1Guess = line1Parts.length > 0 ? line1Parts.join(', ') : undefined

  const city =
    pickGeocodeComponent(components, 'locality', 'administrative_area_level_2') ??
    pickGeocodeComponent(components, 'postal_town')
  const state = pickGeocodeComponent(components, 'administrative_area_level_1')
  const pincode = pickGeocodeComponent(components, 'postal_code')
  const area =
    pickGeocodeComponent(
      components,
      'sublocality_level_2',
      'sublocality_level_1',
      'sublocality',
      'neighborhood',
    ) ?? pickGeocodeComponent(components, 'route')

  return {
    latitude: lat,
    longitude: lng,
    displayName: result.formatted_address?.trim() ?? 'Pinned location',
    city,
    state,
    pincode: pincode?.replace(/\D/g, '').slice(0, 6),
    area: area ?? city,
    addressLine1: addressLine1Guess,
  }
}

export type AutocompleteHit = {
  placeId: string
  label: string
  title?: string
  subtitle?: string | null
}

async function readGoogleErrorBody(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: { message?: string; status?: string } }
    return j.error?.message ?? j.error?.status ?? ''
  } catch {
    return ''
  }
}

export async function fetchPlaceAutocomplete(
  input: string,
  sessionToken: string,
  apiKey: string,
): Promise<AutocompleteHit[]> {
  const q = input.trim()
  if (q.length < 2) return []

  const fieldMask =
    'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat'

  const res = await fetch(AUTOCOMPLETE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({
      input: q,
      sessionToken,
      includedRegionCodes: ['in'],
      languageCode: 'en',
      regionCode: 'IN',
    }),
  })

  if (!res.ok) {
    const detail = await readGoogleErrorBody(res)
    throw new Error(
      detail || `Autocomplete failed (${res.status}). Enable Places API (New) and check the API key.`,
    )
  }

  const data = (await res.json()) as AutocompleteResponse
  const suggestions = data.suggestions ?? []
  const out: AutocompleteHit[] = []

  for (const s of suggestions) {
    const pred = s.placePrediction
    const placeId = pred?.placeId
    if (!placeId) continue

    const flat = pred?.text?.text?.trim()
    const main = pred?.structuredFormat?.mainText?.text?.trim()
    const sub = pred?.structuredFormat?.secondaryText?.text?.trim()
    const label =
      flat ||
      [main, sub].filter(Boolean).join(', ') ||
      main ||
      ''

    if (!label) continue

    out.push({
      placeId,
      label,
      title: main || undefined,
      subtitle: sub || null,
    })
  }

  return out
}

export async function fetchPlaceDetails(
  placeId: string,
  sessionToken: string,
  apiKey: string,
): Promise<PlaceDetailsPayload> {
  const url = new URL(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}`)
  url.searchParams.set('sessionToken', sessionToken)

  const res = await fetch(url.toString(), {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'id,formattedAddress,displayName,location,addressComponents,shortFormattedAddress',
    },
  })

  if (!res.ok) {
    throw new Error(`Place details failed (${res.status})`)
  }

  return (await res.json()) as PlaceDetailsPayload
}

export async function reverseGeocodeLatLng(
  lat: number,
  lng: number,
  apiKey: string,
): Promise<LocationSelection> {
  const url = new URL('https://maps.googleapis.com/maps/api/geocode/json')
  url.searchParams.set('latlng', `${lat},${lng}`)
  url.searchParams.set('key', apiKey)
  url.searchParams.set('region', 'in')

  const res = await fetch(url.toString())
  if (!res.ok) {
    throw new Error(`Geocoding failed (${res.status})`)
  }

  const data = (await res.json()) as GeocodeResponse
  if (data.status !== 'OK' || !data.results?.[0]) {
    if (data.status === 'REQUEST_DENIED') {
      console.warn(
        '[geocoding] REQUEST_DENIED:',
        data.error_message ?? 'Enable Geocoding API for this browser key and allow it under API key restrictions.',
      )
    } else {
      console.warn('[geocoding] No address for coordinates:', data.status, data.error_message ?? '')
    }
    return {
      latitude: lat,
      longitude: lng,
      displayName: 'Current location',
    }
  }

  return geocodeResultToSelection(data.results[0], lat, lng)
}
