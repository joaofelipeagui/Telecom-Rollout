'use client'
import { useEffect, useRef, useState } from 'react'
import { Project, getRegionForCountry, RefreshType } from '@/lib/types'
import { Truck, Plane, Package, Clock, MapPin } from 'lucide-react'

// ── Regional distribution hubs ────────────────────────────────────────────────
const HUBS = {
  NAM:   { ground: { city: 'Chicago, IL',     lat: 41.8781, lng: -87.6298 }, air: { city: 'Miami, FL',      lat: 25.7617, lng: -80.1918 } },
  LATAM: { ground: { city: 'São Paulo, BR',   lat: -23.5505, lng: -46.6333 }, air: { city: 'Miami, FL',     lat: 25.7617, lng: -80.1918 } },
  EMEA:  { ground: { city: 'Amsterdam, NL',   lat: 52.3676, lng: 4.9041  }, air: { city: 'Frankfurt, DE',  lat: 50.1109, lng: 8.6821  } },
  APAC:  { ground: { city: 'Hong Kong',       lat: 22.3193, lng: 114.1694 }, air: { city: 'Singapore',     lat: 1.3521,  lng: 103.8198 } },
}

const EQUIPMENT: Record<string, string> = {
  SDWAN:    '2× Cisco C1111-8P SD-WAN · 1× Viptela vEdge',
  SAP:      '2× Cisco ISR 4351 · 1× NetScout nGeniusONE',
  WIFI:     '4× Cisco Meraki MR46 · 1× Meraki MX68',
  MPLS:     '2× Cisco ASR 1001-X · 1× Juniper MX5',
  FIBER:    '1× Cisco NCS 1004 · 2× SFP-10G-LR',
  LTE:      '1× Cradlepoint E3000 · 2× Sierra Wireless RV50X',
  VOIP:     '1× Cisco CUBE 4300 · 24× IP Phone 8845',
  COLOC:    '1× APC Smart-UPS · 2× Cisco Nexus 9300',
  HYBRID:   '2× Cisco ISR 4431 · 1× Viptela vEdge · 1× LTE module',
  DIA_ONLY: '2× Cisco ISR 4331 · 1× Cisco Catalyst 9200',
  default:  '2× Cisco ISR 4331 · 1× Cisco Catalyst 9200',
}

// ── Distance helper (km) ──────────────────────────────────────────────────────
function distKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Bearing for icon rotation
function bearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = (lng2 - lng1) * Math.PI / 180
  const y = Math.sin(dLng) * Math.cos(lat2 * Math.PI / 180)
  const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
    Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLng)
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360
}

// Interpolate between two points (straight for truck, slight arc for air)
function interp(
  lat1: number, lng1: number, lat2: number, lng2: number,
  t: number, arc = false
): [number, number] {
  if (!arc) return [lat1 + (lat2 - lat1) * t, lng1 + (lng2 - lng1) * t]
  // Arc: push midpoint slightly north/south for visual curve
  const midLat = (lat1 + lat2) / 2 + Math.sin(t * Math.PI) * Math.abs(lat2 - lat1) * 0.25
  const midLng = (lng1 + lng2) / 2
  const q = t < 0.5 ? 2 * t : 2 * (1 - t)
  const baseLat = lat1 + (lat2 - lat1) * t
  const baseLng = lng1 + (lng2 - lng1) * t
  return [baseLat + q * (midLat - (lat1 + lat2) / 2), baseLng + q * (midLng - (lng1 + lng2) / 2) * 0]
}

// ── Shipment model ────────────────────────────────────────────────────────────
export interface Shipment {
  id: string
  siteId: string
  siteName: string
  siteCity: string
  siteCountry: string
  destLat: number
  destLng: number
  originCity: string
  originLat: number
  originLng: number
  transport: 'truck' | 'air'
  equipment: string
  status: 'preparing' | 'in_transit' | 'customs' | 'delivered'
  progress: number   // 0–1
  etaHours: number
  distKm: number
}

function rand(min: number, max: number) { return Math.random() * (max - min) + min }

export function buildShipments(project: Project): Shipment[] {
  const shipments: Shipment[] = []
  const sitesWithCoords = project.sites.filter(s => s.lat && s.lng)

  sitesWithCoords.forEach((site, i) => {
    const region = getRegionForCountry(site.country)
    const hub = HUBS[region] ?? HUBS.EMEA

    // Decide air vs truck based on distance from ground hub
    const distGround = distKm(hub.ground.lat, hub.ground.lng, site.lat!, site.lng!)
    const useAir = distGround > 800
    const origin = useAir ? hub.air : hub.ground

    // Progress based on site status
    let progress: number
    let status: Shipment['status']
    if (site.status === 'completed') {
      progress = 1; status = 'delivered'
    } else if (site.status === 'in_progress') {
      progress = rand(0.35, 0.80); status = useAir ? 'in_transit' : 'in_transit'
    } else if (site.status === 'blocked') {
      progress = rand(0.10, 0.35); status = 'customs'
    } else {
      progress = rand(0.05, 0.30); status = useAir ? 'in_transit' : 'in_transit'
    }

    // Stagger starting progress so not all ships start at same point
    progress = Math.min(0.98, progress + (i % 5) * 0.04)

    const dist = distKm(origin.lat, origin.lng, site.lat!, site.lng!)
    const speedKmh = useAir ? 850 : 75
    const etaHours = Math.round(((1 - progress) * dist) / speedKmh)

    shipments.push({
      id: `ship_${site.id}`,
      siteId: site.id,
      siteName: site.name,
      siteCity: site.city,
      siteCountry: site.country,
      destLat: site.lat!,
      destLng: site.lng!,
      originCity: origin.city,
      originLat: origin.lat,
      originLng: origin.lng,
      transport: useAir ? 'air' : 'truck',
      equipment: EQUIPMENT[site.refreshType ?? 'default'] ?? EQUIPMENT.default,
      status,
      progress,
      etaHours,
      distKm: Math.round(dist),
    })
  })

  return shipments
}

// ── Status badge styles ────────────────────────────────────────────────────────
const STATUS_STYLE: Record<Shipment['status'], string> = {
  preparing:  'bg-gray-800 text-gray-300',
  in_transit: 'bg-blue-900/60 text-blue-300',
  customs:    'bg-orange-900/60 text-orange-300',
  delivered:  'bg-green-900/60 text-green-300',
}

// ── Component ─────────────────────────────────────────────────────────────────
interface Props { project: Project }

export function LogisticsMap({ project }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapInst   = useRef<any>(null)
  const markerMap = useRef<Map<string, any>>(new Map())
  const token     = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const [shipments,    setShipments]    = useState<Shipment[]>(() => buildShipments(project))
  const [selected,     setSelected]     = useState<Shipment | null>(null)
  const [mapLoaded,    setMapLoaded]    = useState(false)

  // Advance simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setShipments(prev => prev.map(s => {
        if (s.status === 'delivered' || s.status === 'customs' || s.status === 'preparing') return s
        const speed = s.transport === 'air' ? rand(0.0015, 0.003) : rand(0.0005, 0.0015)
        const next  = Math.min(0.999, s.progress + speed)
        const eta   = Math.round(((1 - next) * s.distKm) / (s.transport === 'air' ? 850 : 75))
        return { ...s, progress: next, etaHours: eta }
      }))
    }, 2000)
    return () => clearInterval(timer)
  }, [])

  // Init map
  useEffect(() => {
    if (!token || !mapRef.current || mapInst.current) return
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      import('mapbox-gl/dist/mapbox-gl.css')
      mapboxgl.accessToken = token
      const map = new mapboxgl.Map({
        container: mapRef.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [10, 20],
        zoom: 1.5,
        projection: 'mercator' as any,
      })
      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')
      map.on('load', () => {
        mapInst.current = map
        setMapLoaded(true)
      })
    })
    return () => { mapInst.current?.remove(); mapInst.current = null }
  }, [token])

  // Draw / update markers whenever shipments change or map loads
  useEffect(() => {
    if (!mapLoaded || !mapInst.current) return
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      const map = mapInst.current

      shipments.forEach(s => {
        const [curLat, curLng] = s.status === 'delivered'
          ? [s.destLat, s.destLng]
          : interp(s.originLat, s.originLng, s.destLat, s.destLng, s.progress, s.transport === 'air')

        const deg = bearing(curLat, curLng, s.destLat, s.destLng)

        const existing = markerMap.current.get(s.id)
        if (existing) {
          existing.setLngLat([curLng, curLat])
          const el: HTMLElement = existing.getElement()
          const inner = el.querySelector('.ship-icon') as HTMLElement
          if (inner) inner.style.transform = `rotate(${deg}deg)`
          return
        }

        // Create new marker
        const el = document.createElement('div')
        el.style.cssText = 'cursor:pointer;position:relative'
        const isAir = s.transport === 'air'
        const delivered = s.status === 'delivered'
        const stuck     = s.status === 'customs'

        const color = delivered ? '#22c55e' : stuck ? '#f97316' : isAir ? '#60a5fa' : '#facc15'
        const bgColor = delivered ? '#052e16' : stuck ? '#431407' : isAir ? '#1e3a5f' : '#422006'

        el.innerHTML = `
          <div style="
            background:${bgColor};
            border:1.5px solid ${color};
            border-radius:9999px;
            width:28px;height:28px;
            display:flex;align-items:center;justify-content:center;
            box-shadow:0 0 10px ${color}55;
            transition:transform 0.3s;
          ">
            <span class="ship-icon" style="
              font-size:14px;
              display:block;
              transform:rotate(${deg}deg);
              transition:transform 0.5s;
              line-height:1;
            ">${delivered ? '📦' : stuck ? '🔴' : isAir ? '✈️' : '🚛'}</span>
          </div>
          ${!delivered && !stuck ? `<span style="
            position:absolute;top:-3px;right:-3px;
            width:7px;height:7px;border-radius:50%;
            background:${color};
            animation:pulse 1.5s infinite;
          "></span>` : ''}
        `

        el.addEventListener('click', (e) => {
          e.stopPropagation()
          setSelected(s)
        })

        const marker = new mapboxgl.Marker({ element: el, anchor: 'center' })
          .setLngLat([curLng, curLat])
          .addTo(map)

        markerMap.current.set(s.id, marker)
      })

      // Draw destination pins and route lines once
      if (!map.getSource('routes')) {
        const features = shipments.map(s => ({
          type: 'Feature' as const,
          properties: { transport: s.transport },
          geometry: {
            type: 'LineString' as const,
            coordinates: [
              [s.originLng, s.originLat],
              [s.destLng,   s.destLat],
            ],
          },
        }))

        map.addSource('routes', { type: 'geojson', data: { type: 'FeatureCollection', features } })
        map.addLayer({
          id: 'routes-truck', type: 'line', source: 'routes',
          filter: ['==', ['get', 'transport'], 'truck'],
          paint: { 'line-color': '#facc15', 'line-width': 1, 'line-dasharray': [4, 4], 'line-opacity': 0.3 },
        })
        map.addLayer({
          id: 'routes-air', type: 'line', source: 'routes',
          filter: ['==', ['get', 'transport'], 'air'],
          paint: { 'line-color': '#60a5fa', 'line-width': 1, 'line-dasharray': [2, 3], 'line-opacity': 0.3 },
        })

        // Destination pins
        shipments.forEach(s => {
          const pin = document.createElement('div')
          pin.style.cssText = `
            width:10px;height:10px;border-radius:50%;
            background:${s.status==='delivered' ? '#22c55e' : '#6b7280'};
            border:2px solid rgba(255,255,255,0.3);
            box-shadow:0 0 6px rgba(255,255,255,0.2);
          `
          new mapboxgl.Marker({ element: pin, anchor: 'center' })
            .setLngLat([s.destLng, s.destLat])
            .addTo(map)
        })
      }
    })
  }, [shipments, mapLoaded])

  const active    = shipments.filter(s => s.status === 'in_transit').length
  const inAir     = shipments.filter(s => s.transport === 'air' && s.status === 'in_transit').length
  const onRoad    = shipments.filter(s => s.transport === 'truck' && s.status === 'in_transit').length
  const delivered = shipments.filter(s => s.status === 'delivered').length
  const stuck     = shipments.filter(s => s.status === 'customs').length

  if (!token) return (
    <div className="flex items-center justify-center h-64 bg-gray-900 rounded-xl border border-gray-800">
      <p className="text-gray-500 text-sm">Configure MAPBOX_TOKEN to enable the logistics map</p>
    </div>
  )

  return (
    <div className="space-y-4">
      {/* KPI strip */}
      <div className="grid grid-cols-5 gap-3">
        {[
          { label: 'Active Shipments', value: active,    icon: Package, color: 'text-blue-400',   bg: 'border-blue-800/30 bg-blue-950/20' },
          { label: 'In Air ✈',         value: inAir,     icon: Plane,   color: 'text-cyan-400',   bg: 'border-cyan-800/30 bg-cyan-950/20' },
          { label: 'On Road 🚛',        value: onRoad,    icon: Truck,   color: 'text-yellow-400', bg: 'border-yellow-800/30 bg-yellow-950/20' },
          { label: 'Delivered',         value: delivered, icon: Package, color: 'text-green-400',  bg: 'border-green-800/30 bg-green-950/20' },
          { label: 'Customs / Hold',    value: stuck,     icon: Clock,   color: 'text-orange-400', bg: 'border-orange-800/30 bg-orange-950/20' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
            <Icon className={`w-4 h-4 ${color} mb-1`} />
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Map */}
        <div className="flex-1 relative rounded-xl overflow-hidden" style={{ height: '520px' }}>
          <div ref={mapRef} className="w-full h-full" />

          {/* Legend */}
          <div className="absolute bottom-10 left-3 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-2 space-y-1.5">
            <div className="flex items-center gap-2"><span className="text-sm">✈️</span><span className="text-xs text-gray-300">Air freight</span></div>
            <div className="flex items-center gap-2"><span className="text-sm">🚛</span><span className="text-xs text-gray-300">Ground transport</span></div>
            <div className="flex items-center gap-2"><span className="text-sm">📦</span><span className="text-xs text-gray-300">Delivered</span></div>
            <div className="flex items-center gap-2"><span className="text-sm">🔴</span><span className="text-xs text-gray-300">Customs / Hold</span></div>
          </div>

          <style>{`
            @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.8)} }
            .mapboxgl-popup-content { background:#0f172a!important; border:1px solid #1e293b!important; border-radius:10px!important; padding:12px 14px!important; }
            .mapboxgl-popup-tip { display:none!important; }
          `}</style>
        </div>

        {/* Shipment list */}
        <div className="w-72 flex-shrink-0 space-y-2 overflow-auto" style={{ maxHeight: '520px' }}>
          <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Shipments</p>
          {shipments.map(s => {
            const isSelected = selected?.id === s.id
            const pct = Math.round(s.progress * 100)
            const barColor = s.status === 'delivered' ? 'bg-green-500' : s.status === 'customs' ? 'bg-orange-500' : s.transport === 'air' ? 'bg-blue-500' : 'bg-yellow-500'
            return (
              <button
                key={s.id}
                onClick={() => setSelected(isSelected ? null : s)}
                className={`w-full text-left p-3 rounded-xl border transition-all ${
                  isSelected ? 'border-blue-500/60 bg-blue-950/20' : 'border-gray-800 bg-gray-900/60 hover:border-gray-600'
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="text-sm">{s.transport === 'air' ? '✈️' : '🚛'}</span>
                    <span className="text-xs font-semibold text-white truncate">{s.siteName}</span>
                  </div>
                  <span className={`text-xs px-1.5 py-0.5 rounded-full flex-shrink-0 ${STATUS_STYLE[s.status]}`}>
                    {s.status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-gray-500 truncate mb-1.5">
                  {s.originCity} → {s.siteCity}, {s.siteCountry}
                </div>

                {/* Progress bar */}
                <div className="bg-gray-800 rounded-full h-1 mb-1.5">
                  <div className={`${barColor} h-1 rounded-full transition-all duration-500`} style={{ width: `${pct}%` }} />
                </div>

                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-500">{pct}% · {s.distKm.toLocaleString()} km</span>
                  {s.status !== 'delivered' && s.etaHours > 0 && (
                    <span className="text-gray-400">ETA: {s.etaHours < 24 ? `${s.etaHours}h` : `${Math.round(s.etaHours / 24)}d`}</span>
                  )}
                  {s.status === 'delivered' && <span className="text-green-400 font-semibold">Delivered ✓</span>}
                </div>

                {/* Expanded detail */}
                {isSelected && (
                  <div className="mt-2 pt-2 border-t border-gray-700 space-y-1">
                    <div className="text-xs text-gray-400">{s.equipment}</div>
                    <div className="flex items-center gap-1 text-xs text-gray-500">
                      <MapPin className="w-3 h-3" />{s.siteCity}, {s.siteCountry}
                    </div>
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
