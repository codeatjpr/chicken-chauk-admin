import { Crosshair, Loader2, MapPin, Search, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  fetchPlaceAutocomplete,
  fetchPlaceDetails,
  placeDetailsToSelection,
  reverseGeocodeLatLng,
  type AutocompleteHit,
} from '@/lib/google-places-client'
import { splitLocationDisplay } from '@/lib/location-label'
import { cn } from '@/lib/utils'
import type { LocationSelection } from '@/types/location'

const DEBOUNCE_MS = 320
const MIN_INPUT_LEN = 2

function splitSuggestionLabel(label: string): { title: string; subtitle: string | null } {
  const idx = label.indexOf(',')
  if (idx === -1) return { title: label.trim(), subtitle: null }
  const title = label.slice(0, idx).trim()
  const subtitle = label.slice(idx + 1).trim() || null
  return { title: title || label.trim(), subtitle }
}

type PickerInnerProps = {
  apiKey: string
  onPickCoords: (lat: number, lng: number) => void
  onResolvedPlace?: (sel: LocationSelection) => void
  initialSearchText?: string
  initialSelectedSummary?: string
  className?: string
}

function LocationPickerInner({
  apiKey,
  onPickCoords,
  onResolvedPlace,
  initialSearchText = '',
  initialSelectedSummary = '',
  className,
}: PickerInnerProps) {
  const sessionTokenRef = useRef(crypto.randomUUID().replace(/-/g, ''))
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const onPickCoordsRef = useRef(onPickCoords)
  const onResolvedPlaceRef = useRef(onResolvedPlace)
  onPickCoordsRef.current = onPickCoords
  onResolvedPlaceRef.current = onResolvedPlace

  const [searchText, setSearchText] = useState(initialSearchText)
  const [searchHits, setSearchHits] = useState<AutocompleteHit[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [geoError, setGeoError] = useState<string | null>(null)
  const [geoLoading, setGeoLoading] = useState(false)
  const [fullAddress, setFullAddress] = useState(initialSelectedSummary)
  const [lookupLoading, setLookupLoading] = useState(false)

  useEffect(() => {
    setSearchText(initialSearchText)
  }, [initialSearchText])

  useEffect(() => {
    setFullAddress(initialSelectedSummary)
  }, [initialSelectedSummary])

  const emitSelection = useCallback((selection: LocationSelection) => {
    setFullAddress(selection.displayName)
    onPickCoordsRef.current(selection.latitude, selection.longitude)
    onResolvedPlaceRef.current?.(selection)
  }, [])

  const reverseAndApply = useCallback(
    async (lat: number, lng: number) => {
      setLookupLoading(true)
      setSearchError(null)
      try {
        const selection = await reverseGeocodeLatLng(lat, lng, apiKey)
        setSearchText(selection.displayName)
        emitSelection(selection)
      } catch {
        emitSelection({
          latitude: lat,
          longitude: lng,
          displayName: 'Current location',
        })
      } finally {
        setLookupLoading(false)
      }
    },
    [apiKey, emitSelection],
  )

  const runAutocomplete = useCallback(
    async (q: string) => {
      if (q.length < MIN_INPUT_LEN) {
        setSearchHits([])
        return
      }
      setSearchLoading(true)
      setSearchError(null)
      try {
        const hits = await fetchPlaceAutocomplete(q, sessionTokenRef.current, apiKey)
        if (hits.length === 0) {
          setSearchError('No results found.')
        }
        setSearchHits(hits)
      } catch (err) {
        console.error('[places-autocomplete]', err)
        setSearchError(
          err instanceof Error && err.message.length < 160
            ? err.message
            : 'Search failed. Enable Places API (New) for this key in Google Cloud.',
        )
        setSearchHits([])
      } finally {
        setSearchLoading(false)
      }
    },
    [apiKey],
  )

  const onSearchTextChange = (value: string) => {
    setSearchText(value)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null
      void runAutocomplete(value)
    }, DEBOUNCE_MS)
  }

  const clearSearch = () => {
    setSearchText('')
    setSearchHits([])
    setSearchError(null)
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
      debounceRef.current = null
    }
  }

  async function pickHit(hit: AutocompleteHit) {
    setSearchHits([])
    setSearchError(null)
    setLookupLoading(true)
    try {
      const details = await fetchPlaceDetails(hit.placeId, sessionTokenRef.current, apiKey)
      sessionTokenRef.current = crypto.randomUUID().replace(/-/g, '')
      const selection = placeDetailsToSelection(details)
      if (!selection) {
        setSearchError('Could not load that place.')
        return
      }
      setSearchText(selection.displayName)
      emitSelection(selection)
    } catch {
      setSearchError('Could not load place.')
    } finally {
      setLookupLoading(false)
    }
  }

  function handleUseMyLocation() {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('Location not supported.')
      return
    }

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude
        const lng = position.coords.longitude
        setGeoLoading(false)
        void reverseAndApply(lat, lng)
      },
      (error) => {
        setGeoLoading(false)
        setGeoError(
          error.code === 1 ? 'Permission denied — try search.' : 'GPS unavailable — try search.',
        )
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    )
  }

  const selectedParts = fullAddress ? splitLocationDisplay(fullAddress) : null

  return (
    <div className={cn('bg-card border-border min-w-0 max-w-full overflow-x-hidden rounded-lg border', className)}>
      <div className="min-w-0 space-y-3 p-3">
        <div className="space-y-1">
          <Label className="text-xs font-medium">Shop coordinates</Label>
          <p className="text-muted-foreground text-xs">
            Search for the shop on Google Places or use your current location. Latitude and longitude update the
            fields below — no map required.
          </p>
        </div>

        <div className="relative">
          {searchLoading ? (
            <Loader2
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 animate-spin"
              aria-hidden
            />
          ) : (
            <Search
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden
            />
          )}
          <Input
            value={searchText}
            onChange={(e) => onSearchTextChange(e.target.value)}
            placeholder="Search address, area, or landmark"
            className="border-input bg-muted/30 h-10 max-w-full pr-9 pl-9 text-sm"
            autoComplete="off"
            spellCheck={false}
            autoCorrect="off"
            autoCapitalize="off"
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                if (debounceRef.current) {
                  clearTimeout(debounceRef.current)
                  debounceRef.current = null
                }
                void runAutocomplete(searchText)
              }
            }}
            aria-label="Search shop address"
          />
          {searchText ? (
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-2 -translate-y-1/2 rounded-md p-1"
              onClick={clearSearch}
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={handleUseMyLocation}
          disabled={geoLoading}
          className={cn(
            'border-input flex w-full items-center gap-2.5 rounded-xl border bg-transparent px-3 py-2.5 text-left text-sm transition-colors',
            'hover:bg-muted/40 focus-visible:ring-ring focus-visible:ring-2 focus-visible:outline-none',
            'disabled:pointer-events-none disabled:opacity-50',
          )}
        >
          {geoLoading ? (
            <Loader2 className="text-primary size-4 shrink-0 animate-spin" aria-hidden />
          ) : (
            <Crosshair className="text-primary size-4 shrink-0" aria-hidden />
          )}
          <span className="text-primary font-medium">Use my current location</span>
        </button>

        {(searchError || geoError) && (
          <p className="text-destructive text-xs">{searchError || geoError}</p>
        )}

        {searchHits.length > 0 ? (
          <ul className="border-border bg-background divide-y divide-dashed max-h-[min(40vh,240px)] overflow-y-auto overflow-x-hidden rounded-lg border text-sm">
            {searchHits.map((hit) => {
              const split = splitSuggestionLabel(hit.label)
              const title = hit.title ?? split.title
              const subtitle = hit.subtitle ?? split.subtitle
              return (
                <li key={hit.placeId} className="min-w-0">
                  <button
                    type="button"
                    className="hover:bg-muted/50 flex w-full min-w-0 items-start gap-2 px-3 py-2.5 text-left transition-colors"
                    onClick={() => void pickHit(hit)}
                  >
                    <MapPin className="text-muted-foreground mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span className="min-w-0 flex-1 overflow-hidden">
                      <span className="text-foreground line-clamp-1 block font-medium" title={title}>
                        {title}
                      </span>
                      {subtitle ? (
                        <span
                          className="text-muted-foreground mt-0.5 line-clamp-2 block text-xs leading-snug"
                          title={subtitle}
                        >
                          {subtitle}
                        </span>
                      ) : null}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        ) : null}

        {fullAddress || lookupLoading ? (
          <div className="border-border/80 bg-muted/20 rounded-lg border border-dashed px-3 py-2">
            <p className="text-muted-foreground mb-1 text-[10px] font-medium tracking-wide uppercase">Selected</p>
            {lookupLoading ? (
              <p className="text-muted-foreground text-sm">Loading…</p>
            ) : selectedParts ? (
              <div className="space-y-0.5">
                <p
                  className="text-foreground line-clamp-1 text-sm font-semibold leading-snug"
                  title={selectedParts.primary}
                >
                  {selectedParts.primary}
                </p>
                {selectedParts.secondary ? (
                  <p
                    className="text-muted-foreground line-clamp-2 text-xs leading-snug"
                    title={selectedParts.secondary}
                  >
                    {selectedParts.secondary}
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

export type LocationPinMapProps = {
  latitude: string
  longitude: string
  onPick: (lat: number, lng: number) => void
  /** Optional: prefill address line / city / PIN when Places returns components. */
  onResolvedPlace?: (sel: LocationSelection) => void
  /** @deprecated Ignored (map removed). */
  height?: number
  className?: string
  readOnly?: boolean
  /** Shown in read-only mode and as initial “Selected” hint when editing. */
  initialSelectedSummary?: string
}

/**
 * Map-free shop location picker: Google Places search + current location (same flow as customer app).
 */
export function LocationPinMap({
  latitude,
  longitude,
  onPick,
  onResolvedPlace,
  className,
  readOnly = false,
  initialSelectedSummary = '',
  height: _height,
}: LocationPinMapProps) {
  void _height

  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined

  if (readOnly) {
    const hasCoords =
      latitude.trim() !== '' &&
      longitude.trim() !== '' &&
      !Number.isNaN(Number(latitude)) &&
      !Number.isNaN(Number(longitude))
    return (
      <div className={cn('bg-muted/20 border-border rounded-lg border px-3 py-3 text-sm', className)}>
        <p className="text-muted-foreground mb-1 text-xs font-medium">Shop location</p>
        {initialSelectedSummary ? (
          <p className="text-foreground text-xs leading-snug">{initialSelectedSummary}</p>
        ) : hasCoords ? (
          <p className="text-muted-foreground text-xs">Location is set for delivery.</p>
        ) : (
          <p className="text-muted-foreground text-xs">No location on file.</p>
        )}
      </div>
    )
  }

  if (!apiKey?.trim()) {
    return (
      <div
        className={cn(
          'rounded-xl border border-destructive/40 bg-destructive/5 p-3 text-sm',
          className,
        )}
      >
        <p className="font-medium text-destructive">Google Maps API key missing</p>
        <p className="text-muted-foreground mt-1 text-xs">
          Add <code className="text-foreground">VITE_GOOGLE_MAPS_API_KEY</code> to <code className="text-foreground">.env</code>{' '}
          (Places API New + Geocoding, HTTP referrer restrictions for this admin URL).
        </p>
      </div>
    )
  }

  return (
    <LocationPickerInner
      apiKey={apiKey}
      onPickCoords={onPick}
      onResolvedPlace={onResolvedPlace}
      initialSelectedSummary={initialSelectedSummary}
      className={className}
    />
  )
}
