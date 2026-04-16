import L from 'leaflet'
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png'
import markerIcon from 'leaflet/dist/images/marker-icon.png'
import markerShadow from 'leaflet/dist/images/marker-shadow.png'
import 'leaflet/dist/leaflet.css'
import { Crosshair, Loader2, MapPin, Search } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { cn } from '@/lib/utils'

/** Default map center (India) when coordinates are empty or invalid. */
const DEFAULT_CENTER: L.LatLngTuple = [12.9716, 77.5946]

/** Nominatim policy: avoid hammering the public instance. */
const NOMINATIM_MIN_INTERVAL_MS = 1100

const pinIcon = L.icon({
  iconUrl: markerIcon,
  iconRetinaUrl: markerIcon2x,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  shadowAnchor: [12, 41],
  popupAnchor: [1, -34],
})

function parseCoords(latStr: string, lngStr: string): L.LatLngTuple | null {
  const lat = Number.parseFloat(latStr)
  const lng = Number.parseFloat(lngStr)
  if (Number.isNaN(lat) || Number.isNaN(lng)) return null
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null
  return [lat, lng]
}

type NominatimHit = {
  display_name: string
  lat: string
  lon: string
}

async function searchNominatim(query: string): Promise<NominatimHit[]> {
  const q = query.trim()
  if (!q) return []

  const url = new URL('https://nominatim.openstreetmap.org/search')
  url.searchParams.set('format', 'json')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '8')
  url.searchParams.set('countrycodes', 'in')
  url.searchParams.set('addressdetails', '1')

  const res = await fetch(url.toString(), {
    headers: {
      Accept: 'application/json',
      'Accept-Language': 'en',
      // Identifiable UA helps OSM policy; browser may still append its own.
      'X-Requested-With': 'ChickenChaukAdmin',
    },
  })
  if (!res.ok) throw new Error(`Search failed (${res.status})`)
  const data = (await res.json()) as NominatimHit[]
  return Array.isArray(data) ? data : []
}

export type LocationPinMapProps = {
  latitude: string
  longitude: string
  onPick: (lat: number, lng: number) => void
  /** Pixel height of the map box */
  height?: number
  className?: string
  /** Display-only: no search, drag, or click-to-move. */
  readOnly?: boolean
}

/**
 * OpenStreetMap + Leaflet: search by address / PIN / place, use device location, or click map to pin.
 */
export function LocationPinMap({
  latitude,
  longitude,
  onPick,
  height = 280,
  className,
  readOnly = false,
}: LocationPinMapProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<L.Map | null>(null)
  const markerRef = useRef<L.Marker | null>(null)
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const lastNominatimAt = useRef(0)

  const [mapReady, setMapReady] = useState(false)
  const [searchText, setSearchText] = useState('')
  const [searchLoading, setSearchLoading] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [searchHits, setSearchHits] = useState<NominatimHit[]>([])
  const [geoLoading, setGeoLoading] = useState(false)
  const [geoError, setGeoError] = useState<string | null>(null)

  const jumpTo = useCallback((lat: number, lng: number, zoom = 16) => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return
    const ll = L.latLng(lat, lng)
    marker.setLatLng(ll)
    map.setView(ll, zoom)
    onPickRef.current(lat, lng)
  }, [])

  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const parsed = parseCoords(latitude, longitude)
    const center: L.LatLngTuple = parsed ?? DEFAULT_CENTER
    const zoom = parsed ? 16 : 12

    const map = L.map(el, { scrollWheelZoom: true }).setView(center, zoom)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map)

    const marker = L.marker(center, { draggable: !readOnly, icon: pinIcon }).addTo(map)
    mapRef.current = map
    markerRef.current = marker

    const emit = (latlng: L.LatLng) => {
      onPickRef.current(latlng.lat, latlng.lng)
    }

    if (!readOnly) {
      marker.on('dragend', () => {
        emit(marker.getLatLng())
      })

      map.on('click', (e: L.LeafletMouseEvent) => {
        marker.setLatLng(e.latlng)
        map.panTo(e.latlng)
        emit(e.latlng)
      })

      // Initial pin is shown at `center` but drag/click never fired — sync parent lat/lng
      // so forms (e.g. vendor onboarding) are not stuck with empty coordinates.
      emit(L.latLng(center[0], center[1]))
    }

    const t = window.setTimeout(() => {
      map.invalidateSize()
      setMapReady(true)
    }, 150)

    return () => {
      window.clearTimeout(t)
      setMapReady(false)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [readOnly])

  useEffect(() => {
    const map = mapRef.current
    const marker = markerRef.current
    if (!map || !marker) return

    const parsed = parseCoords(latitude, longitude)
    if (!parsed) return

    const cur = marker.getLatLng()
    if (Math.abs(cur.lat - parsed[0]) < 1e-7 && Math.abs(cur.lng - parsed[1]) < 1e-7) return

    marker.setLatLng(parsed)
    map.setView(parsed, Math.max(map.getZoom(), 14), { animate: false })
  }, [latitude, longitude])

  async function handleSearch() {
    setSearchError(null)
    setSearchHits([])
    const q = searchText.trim()
    if (!q) {
      setSearchError('Type an address, area, or 6-digit PIN to search.')
      return
    }
    if (!mapReady) return

    const now = Date.now()
    const wait = NOMINATIM_MIN_INTERVAL_MS - (now - lastNominatimAt.current)
    if (wait > 0) {
      await new Promise((r) => setTimeout(r, wait))
    }
    lastNominatimAt.current = Date.now()

    setSearchLoading(true)
    try {
      const hits = await searchNominatim(q)
      if (hits.length === 0) {
        setSearchError('No results. Try a fuller address or another spelling.')
      } else {
        setSearchHits(hits)
      }
    } catch {
      setSearchError('Could not reach the map search service. Try again in a moment.')
    } finally {
      setSearchLoading(false)
    }
  }

  function pickHit(hit: NominatimHit) {
    const lat = Number.parseFloat(hit.lat)
    const lng = Number.parseFloat(hit.lon)
    if (Number.isNaN(lat) || Number.isNaN(lng)) return
    jumpTo(lat, lng, 17)
    setSearchHits([])
    setSearchError(null)
  }

  function handleUseMyLocation() {
    setGeoError(null)
    if (!navigator.geolocation) {
      setGeoError('Your browser does not support location.')
      return
    }
    if (!mapReady) return

    setGeoLoading(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        jumpTo(pos.coords.latitude, pos.coords.longitude, 17)
        setGeoLoading(false)
      },
      (err) => {
        setGeoLoading(false)
        const code = err.code
        const msg =
          code === 1
            ? 'Location permission denied. Allow location for this site, or use search / map click.'
            : code === 2
              ? 'Position unavailable. Try search instead.'
              : 'Could not get your location. Try search or click the map.'
        setGeoError(msg)
      },
      { enableHighAccuracy: true, timeout: 20_000, maximumAge: 60_000 },
    )
  }

  return (
    <div className={cn('overflow-hidden rounded-lg border border-border', className)}>
      {!readOnly ? (
      <div className="bg-card space-y-2 border-b border-border p-3">
        <Label className="text-xs font-medium">Find on map</Label>
        <p className="text-muted-foreground text-xs">
          Search by <strong>address</strong>, landmark, or <strong>6-digit PIN</strong> (India), use{' '}
          <strong>your current location</strong> if you are at the shop, or click the map to place the pin.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
          <div className="flex min-w-0 flex-1 gap-2">
            <Input
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="e.g. MG Road Bengaluru or 560001"
              className="min-w-0"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSearch()
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              className="shrink-0 gap-1.5"
              disabled={!mapReady || searchLoading}
              onClick={() => void handleSearch()}
            >
              {searchLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Search className="size-4" aria-hidden />}
              Search
            </Button>
          </div>
          <Button
            type="button"
            variant="outline"
            className="shrink-0 gap-1.5 sm:w-auto"
            disabled={!mapReady || geoLoading}
            onClick={() => handleUseMyLocation()}
          >
            {geoLoading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Crosshair className="size-4" aria-hidden />}
            My location
          </Button>
        </div>
        {searchError ? <p className="text-destructive text-xs">{searchError}</p> : null}
        {geoError ? <p className="text-destructive text-xs">{geoError}</p> : null}
        {searchHits.length > 0 ? (
          <ul className="border-input bg-muted/40 max-h-36 overflow-y-auto rounded-md border text-xs">
            {searchHits.map((hit, i) => (
              <li key={`${hit.lat}-${hit.lon}-${i}`} className="border-border/80 border-b last:border-0">
                <button
                  type="button"
                  className="hover:bg-muted flex w-full items-start gap-2 px-2 py-2 text-left"
                  onClick={() => pickHit(hit)}
                >
                  <MapPin className="text-primary mt-0.5 size-3.5 shrink-0" aria-hidden />
                  <span className="line-clamp-2">{hit.display_name}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      ) : (
        <div className="bg-card text-muted-foreground border-b border-border px-3 py-2 text-xs">
          Shop location (read-only)
        </div>
      )}
      <div ref={containerRef} className="bg-muted/30 w-full" style={{ height }} />
      <p className="text-muted-foreground border-t border-border bg-card px-2 py-1.5 text-xs">
        Map data © OpenStreetMap contributors
        {!readOnly ? (
          <>
            {' '}
            · Search uses{' '}
            <a href="https://nominatim.org" target="_blank" rel="noopener noreferrer" className="text-primary underline">
              Nominatim
            </a>{' '}
            (rate-limited). Click map or drag pin to fine-tune; lat/long fields below stay in sync.
          </>
        ) : null}
      </p>
    </div>
  )
}
