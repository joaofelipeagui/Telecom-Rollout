'use client'
import { useEffect, useRef, useState } from 'react'
import { Project, Site, getRegionForCountry } from '@/lib/types'
import { Truck, Plane, Package, Clock, MapPin, CheckCircle, ArrowLeft, ChevronRight } from 'lucide-react'

// ── Hubs & equipment ─────────────────────────────────────────────────────────
const HUBS = {
  NAM:   { ground: { city: 'Chicago, IL',   lat: 41.8781,  lng: -87.6298  }, air: { city: 'Miami, FL',     lat: 25.7617,  lng: -80.1918  } },
  LATAM: { ground: { city: 'São Paulo, BR', lat: -23.5505, lng: -46.6333  }, air: { city: 'Miami, FL',     lat: 25.7617,  lng: -80.1918  } },
  EMEA:  { ground: { city: 'Amsterdam, NL', lat: 52.3676,  lng: 4.9041   }, air: { city: 'Frankfurt, DE', lat: 50.1109,  lng: 8.6821   } },
  APAC:  { ground: { city: 'Hong Kong',     lat: 22.3193,  lng: 114.1694  }, air: { city: 'Singapore',    lat: 1.3521,   lng: 103.8198  } },
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

// ── Geometry helpers ──────────────────────────────────────────────────────────
function distKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLng = (lng2-lng1)*Math.PI/180
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLng/2)**2
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a))
}
function bearing(lat1: number, lng1: number, lat2: number, lng2: number) {
  const dLng=(lng2-lng1)*Math.PI/180
  const y=Math.sin(dLng)*Math.cos(lat2*Math.PI/180)
  const x=Math.cos(lat1*Math.PI/180)*Math.sin(lat2*Math.PI/180)-Math.sin(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.cos(dLng)
  return (Math.atan2(y,x)*180/Math.PI+360)%360
}
function interp(lat1:number,lng1:number,lat2:number,lng2:number,t:number):[number,number]{
  return [lat1+(lat2-lat1)*t, lng1+(lng2-lng1)*t]
}
function rand(min:number,max:number){return Math.random()*(max-min)+min}
function fmtEta(h:number){
  if(h<=0) return 'Arriving…'
  if(h<1)  return '< 1h'
  if(h<24) return `${h}h`
  return `${Math.round(h/24)}d`
}

// ── Shipment type ─────────────────────────────────────────────────────────────
export interface Shipment {
  id: string
  siteId: string
  siteName: string
  siteCity: string
  siteCountry: string
  refreshType?: string
  destLat: number; destLng: number
  originCity: string; originLat: number; originLng: number
  transport: 'truck'|'air'
  equipment: string
  status: 'preparing'|'in_transit'|'customs'|'delivered'
  progress: number
  etaHours: number
  distKm: number
  speedTier: 'fast'|'normal'|'slow'
}

// ── Timeline milestones ───────────────────────────────────────────────────────
interface Milestone { label: string; sub: string; threshold: number }

function getMilestones(s: Shipment): Milestone[] {
  if (s.transport === 'air') return [
    { label: 'Order Confirmed',      sub: 'PO issued to supplier',          threshold: 0    },
    { label: 'Warehouse Ready',      sub: `Staged at ${s.originCity}`,      threshold: 0.10 },
    { label: 'Airside Check-in',     sub: 'Cargo checked & manifested',     threshold: 0.20 },
    { label: `Departed ${s.originCity}`, sub: 'Aircraft airborne',          threshold: 0.27 },
    { label: 'En Route',             sub: 'Cruising altitude',              threshold: 0.50 },
    { label: 'Approach',             sub: `Descending to ${s.siteCity}`,    threshold: 0.80 },
    { label: 'Landed',               sub: 'Aircraft on ground',             threshold: 0.88 },
    { label: 'Customs Clearance',    sub: 'Import processing',              threshold: 0.93 },
    { label: 'Last Mile',            sub: 'Truck to customer site',         threshold: 0.97 },
    { label: 'Delivered',            sub: `${s.siteCity}, ${s.siteCountry}`,threshold: 1.00 },
  ]
  return [
    { label: 'Order Confirmed',      sub: 'PO issued to supplier',          threshold: 0    },
    { label: 'Warehouse Ready',      sub: `Staged at ${s.originCity}`,      threshold: 0.10 },
    { label: 'Loading Complete',     sub: 'Truck loaded & sealed',          threshold: 0.20 },
    { label: `Departed ${s.originCity}`, sub: 'On the road',               threshold: 0.25 },
    { label: 'Regional Hub',         sub: 'Intermediate stop',              threshold: 0.45 },
    { label: 'Border / Customs',     sub: 'Import clearance',               threshold: 0.60 },
    { label: 'Last Mile',            sub: `Approaching ${s.siteCity}`,      threshold: 0.82 },
    { label: 'On Site',              sub: 'Driver at customer premises',    threshold: 0.96 },
    { label: 'Delivered',            sub: `${s.siteCity}, ${s.siteCountry}`,threshold: 1.00 },
  ]
}

// ── Build shipments from project ──────────────────────────────────────────────
export function buildShipments(project: Project): Shipment[] {
  const sitesWithCoords = project.sites.filter(s => s.lat && s.lng)
  const activeSites = sitesWithCoords.filter(s => s.status !== 'completed' && s.status !== 'blocked')
  const fastSet = new Set(activeSites.slice(0, 3).map(s => s.id))
  const nearProgress = [0.56, 0.66, 0.76]
  let fastIdx = 0

  return sitesWithCoords.map(site => {
    const region = getRegionForCountry(site.country)
    const hub = HUBS[region] ?? HUBS.EMEA
    const useAir = distKm(hub.ground.lat, hub.ground.lng, site.lat!, site.lng!) > 800
    const origin = useAir ? hub.air : hub.ground

    let progress: number, status: Shipment['status'], speedTier: Shipment['speedTier'] = 'normal'

    if (site.status === 'completed')    { progress = 1;                    status = 'delivered' }
    else if (site.status === 'blocked') { progress = rand(0.10, 0.35);    status = 'customs' }
    else if (fastSet.has(site.id))      {
      progress = nearProgress[fastIdx++ % 3]; status = 'in_transit'; speedTier = 'fast'
    } else if (site.status === 'in_progress') { progress = rand(0.20, 0.65); status = 'in_transit' }
    else                                      { progress = rand(0.03, 0.25); status = 'in_transit'; speedTier = 'slow' }

    const dist = distKm(origin.lat, origin.lng, site.lat!, site.lng!)
    return {
      id: `ship_${site.id}`, siteId: site.id,
      siteName: site.name, siteCity: site.city, siteCountry: site.country,
      refreshType: site.refreshType,
      destLat: site.lat!, destLng: site.lng!,
      originCity: origin.city, originLat: origin.lat, originLng: origin.lng,
      transport: useAir ? 'air' : 'truck',
      equipment: EQUIPMENT[site.refreshType ?? 'default'] ?? EQUIPMENT.default,
      status, progress, speedTier,
      etaHours: Math.max(0, Math.round(((1-progress)*dist)/(useAir?850:75))),
      distKm: Math.round(dist),
    }
  })
}

// ── Tracking panel ────────────────────────────────────────────────────────────
function TrackingPanel({ shipment, onBack }: { shipment: Shipment; onBack: () => void }) {
  const milestones = getMilestones(shipment)
  const pct = Math.round(shipment.progress * 100)

  // Find current milestone index
  let currentMilestone = 0
  for (let i = milestones.length - 1; i >= 0; i--) {
    if (shipment.progress >= milestones[i].threshold) { currentMilestone = i; break }
  }

  const isAir = shipment.transport === 'air'
  const barColor = shipment.status === 'delivered' ? 'bg-green-500' : shipment.status === 'customs' ? 'bg-orange-500' : isAir ? 'bg-blue-500' : 'bg-yellow-500'
  const statusColor = shipment.status === 'delivered' ? 'text-green-400' : shipment.status === 'customs' ? 'text-orange-400' : isAir ? 'text-blue-400' : 'text-yellow-400'

  return (
    <div className="flex flex-col h-full overflow-auto space-y-4">
      {/* Back button */}
      <button onClick={onBack} className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors w-fit">
        <ArrowLeft className="w-3.5 h-3.5" /> All shipments
      </button>

      {/* Site header */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div>
            <h3 className="text-sm font-bold text-white">{shipment.siteName}</h3>
            <p className="text-xs text-gray-400">{shipment.siteCity}, {shipment.siteCountry}</p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full font-semibold ${
            shipment.status === 'delivered' ? 'bg-green-900/60 text-green-300' :
            shipment.status === 'customs'   ? 'bg-orange-900/60 text-orange-300' :
            'bg-blue-900/60 text-blue-300'
          }`}>
            {isAir ? '✈️' : '🚛'} {shipment.status.replace('_',' ')}
          </span>
        </div>
        {shipment.refreshType && (
          <div className="text-xs text-gray-500 mt-1">{shipment.refreshType} deployment</div>
        )}
      </div>

      {/* Progress */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="flex items-center justify-between mb-2">
          <span className={`text-2xl font-bold ${statusColor}`}>{pct}%</span>
          {shipment.status === 'delivered'
            ? <span className="text-green-400 text-sm font-semibold">✓ Delivered</span>
            : <span className="text-xs text-gray-400">ETA: <span className="text-white font-semibold">{fmtEta(shipment.etaHours)}</span></span>
          }
        </div>
        <div className="bg-gray-800 rounded-full h-2">
          <div className={`${barColor} h-2 rounded-full transition-all duration-700`} style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between mt-1.5 text-xs text-gray-600">
          <span>{shipment.originCity}</span>
          <span>{shipment.distKm.toLocaleString()} km</span>
          <span>{shipment.siteCity}</span>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Tracking Timeline</p>
        <div className="space-y-0">
          {milestones.map((m, idx) => {
            const done    = shipment.progress >= m.threshold
            const current = idx === currentMilestone && shipment.status !== 'delivered'
            const isLast  = idx === milestones.length - 1

            return (
              <div key={idx} className="flex gap-3">
                {/* Dot + line */}
                <div className="flex flex-col items-center">
                  <div className={`w-3 h-3 rounded-full flex-shrink-0 mt-0.5 border-2 transition-all ${
                    done    ? 'bg-green-500 border-green-500' :
                    current ? 'bg-blue-500 border-blue-500 animate-pulse' :
                              'bg-transparent border-gray-700'
                  }`} />
                  {!isLast && <div className={`w-0.5 flex-1 min-h-[20px] ${done ? 'bg-green-700' : 'bg-gray-800'}`} />}
                </div>
                {/* Label */}
                <div className={`pb-3 ${isLast ? '' : ''}`}>
                  <p className={`text-xs font-medium ${done ? 'text-white' : current ? 'text-blue-300' : 'text-gray-600'}`}>
                    {m.label}
                    {current && <span className="ml-1.5 text-xs text-blue-400 font-normal animate-pulse">← now</span>}
                  </p>
                  <p className={`text-xs ${done ? 'text-gray-500' : 'text-gray-700'}`}>{m.sub}</p>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Equipment */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Equipment</p>
        <p className="text-xs text-gray-300 leading-relaxed">{shipment.equipment}</p>
        <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
          <MapPin className="w-3 h-3" />
          <span>Destination: {shipment.siteCity}, {shipment.siteCountry}</span>
        </div>
      </div>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface Props { project: Project }

async function geocodeSites(sites: Site[]) {
  return Promise.all(sites.map(async s => {
    if (s.lat && s.lng) return s
    const addr = `${s.address}, ${s.city}${s.state ? `, ${s.state}` : ''}, ${s.country}`
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(addr)}`)
      if (!res.ok) return s
      const { lat, lng } = await res.json()
      return { ...s, lat, lng }
    } catch { return s }
  }))
}

export function LogisticsMap({ project }: Props) {
  const mapRef    = useRef<HTMLDivElement>(null)
  const mapInst   = useRef<any>(null)
  const markerMap = useRef<Map<string, any>>(new Map())
  const token     = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const [shipments,    setShipments]    = useState<Shipment[]>(() => buildShipments(project))
  const [geocoding,    setGeocoding]    = useState(() => project.sites.some(s => !s.lat || !s.lng))
  const [selected,     setSelected]     = useState<Shipment | null>(null)
  const [activeFilter, setActiveFilter] = useState<string | null>(null)
  const [deliveryFeed, setDeliveryFeed] = useState<{ id:string; siteName:string; ts:string; transport:string }[]>([])
  const [toast,        setToast]        = useState<{ siteName:string; transport:string } | null>(null)
  const [flashIds,     setFlashIds]     = useState<Set<string>>(new Set())
  const [mapLoaded,    setMapLoaded]    = useState(false)

  // Geocode sites missing coordinates then rebuild shipments
  useEffect(() => {
    if (!project.sites.some(s => !s.lat || !s.lng)) return
    setGeocoding(true)
    geocodeSites(project.sites).then(resolved => {
      setShipments(buildShipments({ ...project, sites: resolved }))
      setGeocoding(false)
    })
  }, [project.id])

  // Dismiss toast
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 4000); return () => clearTimeout(t) }, [toast])

  // Simulation tick
  useEffect(() => {
    const SPEEDS = { fast: () => rand(0.016, 0.022), normal: () => rand(0.004, 0.008), slow: () => rand(0.001, 0.003) }
    const timer = setInterval(() => {
      setShipments(prev => {
        const newDeliveries: typeof deliveryFeed = []
        const newFlash: string[] = []
        const next = prev.map(s => {
          if (s.status !== 'in_transit') return s
          const step = SPEEDS[s.speedTier]()
          const np = Math.min(1.0, s.progress + step)
          const eta = Math.max(0, Math.round(((1-np)*s.distKm)/(s.transport==='air'?850:75)))
          if (np >= 1.0) {
            newDeliveries.push({ id:`d_${s.id}_${Date.now()}`, siteName:s.siteName, ts:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}), transport:s.transport })
            newFlash.push(s.id)
            return { ...s, progress:1.0, status:'delivered' as const, etaHours:0 }
          }
          return { ...s, progress:np, etaHours:eta }
        })
        if (newDeliveries.length > 0) {
          setToast({ siteName:newDeliveries[0].siteName, transport:newDeliveries[0].transport })
          setDeliveryFeed(f => [...newDeliveries,...f].slice(0,20))
          setFlashIds(ids => { const c=new Set(ids); newFlash.forEach(id=>c.add(id)); return c })
          setTimeout(() => setFlashIds(ids => { const c=new Set(ids); newFlash.forEach(id=>c.delete(id)); return c }), 2000)
        }
        return next
      })
      // Sync selected shipment state
      setSelected(sel => sel ? (shipments.find(s => s.id === sel.id) ?? sel) : null)
    }, 1200)
    return () => clearInterval(timer)
  }, [])

  // Keep selected in sync with latest shipment data
  useEffect(() => {
    if (!selected) return
    const latest = shipments.find(s => s.id === selected.id)
    if (latest && latest.progress !== selected.progress) setSelected(latest)
  }, [shipments])

  // Init map
  useEffect(() => {
    if (!token || !mapRef.current || mapInst.current) return
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      import('mapbox-gl/dist/mapbox-gl.css')
      mapboxgl.accessToken = token
      const map = new mapboxgl.Map({
        container: mapRef.current!, style:'mapbox://styles/mapbox/dark-v11',
        center:[10,20], zoom:1.5, projection:'mercator' as any,
      })
      map.addControl(new mapboxgl.NavigationControl(),'bottom-right')
      map.on('load', () => { mapInst.current = map; setMapLoaded(true) })
    })
    return () => { mapInst.current?.remove(); mapInst.current = null }
  }, [token])

  // Fly to selected shipment
  useEffect(() => {
    if (!mapLoaded || !mapInst.current || !selected) return
    const [curLat, curLng] = selected.status === 'delivered'
      ? [selected.destLat, selected.destLng]
      : interp(selected.originLat, selected.originLng, selected.destLat, selected.destLng, selected.progress)
    mapInst.current.flyTo({ center:[curLng, curLat], zoom:4, speed:1.2, curve:1 })
  }, [selected?.id, mapLoaded])

  // Draw / update markers
  useEffect(() => {
    if (!mapLoaded || !mapInst.current) return
    import('mapbox-gl').then(({ default: mapboxgl }) => {
      const map = mapInst.current

      shipments.forEach(s => {
        const [curLat, curLng] = s.status === 'delivered'
          ? [s.destLat, s.destLng]
          : interp(s.originLat, s.originLng, s.destLat, s.destLng, s.progress)

        const deg       = s.status === 'delivered' ? 0 : bearing(curLat, curLng, s.destLat, s.destLng)
        const isFlash   = flashIds.has(s.id)
        const isSel     = selected?.id === s.id
        const delivered = s.status === 'delivered'
        const stuck     = s.status === 'customs'
        const isAir     = s.transport === 'air'
        const color     = delivered ? '#22c55e' : stuck ? '#f97316' : isAir ? '#60a5fa' : '#facc15'
        const bgColor   = delivered ? '#052e16' : stuck ? '#431407' : isAir ? '#1e3a5f' : '#422006'
        const icon      = delivered ? '📦' : stuck ? '🔴' : isAir ? '✈️' : '🚛'
        const size      = isSel ? '34px' : '26px'
        const glow      = isFlash ? `0 0 20px ${color}` : isSel ? `0 0 14px ${color}88` : `0 0 8px ${color}44`
        const border    = isSel ? `2.5px solid ${color}` : `1.5px solid ${color}88`

        const existing = markerMap.current.get(s.id)
        if (existing) {
          existing.setLngLat([curLng, curLat])
          const el = existing.getElement()
          const box = el.querySelector('.ship-box') as HTMLElement
          const ico = el.querySelector('.ship-icon') as HTMLElement
          if (box) {
            box.style.width = size; box.style.height = size
            box.style.boxShadow = glow; box.style.border = border
            box.style.transform = isFlash ? 'scale(1.7)' : 'scale(1)'
          }
          if (ico) ico.style.transform = `rotate(${deg}deg)`
          return
        }

        const el = document.createElement('div')
        el.style.cssText = 'cursor:pointer;position:relative'
        el.innerHTML = `
          <div class="ship-box" style="background:${bgColor};border:${border};border-radius:9999px;
            width:${size};height:${size};display:flex;align-items:center;justify-content:center;
            box-shadow:${glow};transition:all 0.3s;">
            <span class="ship-icon" style="font-size:13px;display:block;transform:rotate(${deg}deg);transition:transform 0.5s;line-height:1">${icon}</span>
          </div>
          ${!delivered&&!stuck?`<span style="position:absolute;top:-3px;right:-3px;width:7px;height:7px;border-radius:50%;background:${color};animation:shippen 1.5s infinite"></span>`:''}
        `
        el.addEventListener('click', e => { e.stopPropagation(); setSelected(s) })

        const marker = new mapboxgl.Marker({ element:el, anchor:'center' })
          .setLngLat([curLng, curLat]).addTo(map)
        markerMap.current.set(s.id, marker)
      })

      // Route lines + destination pins (once)
      if (!map.getSource('routes')) {
        map.addSource('routes', { type:'geojson', data:{ type:'FeatureCollection', features:
          shipments.map(s => ({ type:'Feature' as const, properties:{ transport:s.transport, id:s.id },
            geometry:{ type:'LineString' as const, coordinates:[[s.originLng,s.originLat],[s.destLng,s.destLat]] } }))
        }})
        map.addLayer({ id:'routes-truck', type:'line', source:'routes', filter:['==',['get','transport'],'truck'], paint:{'line-color':'#facc15','line-width':1,'line-dasharray':[4,4],'line-opacity':0.25} })
        map.addLayer({ id:'routes-air',   type:'line', source:'routes', filter:['==',['get','transport'],'air'],   paint:{'line-color':'#60a5fa','line-width':1,'line-dasharray':[2,3],'line-opacity':0.25} })
        shipments.forEach(s => {
          const pin = document.createElement('div')
          pin.style.cssText = `width:8px;height:8px;border-radius:50%;background:${s.status==='delivered'?'#22c55e':'#374151'};border:1.5px solid rgba(255,255,255,0.2);cursor:pointer`
          pin.addEventListener('click', () => setSelected(s))
          new mapboxgl.Marker({ element:pin, anchor:'center' }).setLngLat([s.destLng,s.destLat]).addTo(map)
        })
      }
    })
  }, [shipments, mapLoaded, flashIds, selected?.id])

  const active    = shipments.filter(s => s.status==='in_transit').length
  const inAir     = shipments.filter(s => s.transport==='air'   && s.status==='in_transit').length
  const onRoad    = shipments.filter(s => s.transport==='truck'  && s.status==='in_transit').length
  const delivered = shipments.filter(s => s.status==='delivered').length
  const stuck     = shipments.filter(s => s.status==='customs').length

  const KPI_FILTERS = [
    { key:'active',    label:'Active Shipments', value:active,    icon:Package,     color:'text-blue-400',   bg:'border-blue-800/30 bg-blue-950/20',     activeBg:'border-blue-500 bg-blue-900/40',   match:(s:Shipment) => s.status==='in_transit' },
    { key:'air',       label:'In Air ✈',          value:inAir,     icon:Plane,       color:'text-cyan-400',   bg:'border-cyan-800/30 bg-cyan-950/20',     activeBg:'border-cyan-500 bg-cyan-900/40',   match:(s:Shipment) => s.transport==='air' && s.status==='in_transit' },
    { key:'road',      label:'On Road 🚛',         value:onRoad,    icon:Truck,       color:'text-yellow-400', bg:'border-yellow-800/30 bg-yellow-950/20', activeBg:'border-yellow-500 bg-yellow-900/40', match:(s:Shipment) => s.transport==='truck' && s.status==='in_transit' },
    { key:'delivered', label:'Delivered',          value:delivered, icon:CheckCircle, color:'text-green-400',  bg:'border-green-800/30 bg-green-950/20',   activeBg:'border-green-500 bg-green-900/40', match:(s:Shipment) => s.status==='delivered' },
    { key:'customs',   label:'Customs / Hold',     value:stuck,     icon:Clock,       color:'text-orange-400', bg:'border-orange-800/30 bg-orange-950/20', activeBg:'border-orange-500 bg-orange-900/40', match:(s:Shipment) => s.status==='customs' },
  ]

  const visibleShipments = activeFilter
    ? shipments.filter(KPI_FILTERS.find(f => f.key === activeFilter)!.match)
    : shipments

  if (!token) return (
    <div className="flex items-center justify-center h-64 bg-gray-900 rounded-xl border border-gray-800">
      <p className="text-gray-500 text-sm">Configure MAPBOX_TOKEN to enable the logistics map</p>
    </div>
  )

  if (geocoding) return (
    <div className="flex flex-col items-center justify-center h-64 bg-gray-900 rounded-xl border border-gray-800 gap-3">
      <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-gray-400">Locating sites on the map…</p>
      <p className="text-xs text-gray-600">Geocoding {project.sites.filter(s => !s.lat || !s.lng).length} sites without coordinates</p>
    </div>
  )

  return (
    <div className="space-y-4">

      {/* Delivery toast */}
      {toast && (
        <div className="fixed top-6 right-6 z-50 animate-in slide-in-from-right-4 fade-in duration-300">
          <div className="flex items-center gap-3 bg-green-950 border border-green-600 rounded-xl px-4 py-3 shadow-2xl shadow-green-900/50">
            <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-green-300">Delivery Confirmed</p>
              <p className="text-xs text-green-500">{toast.transport==='air'?'✈️':'🚛'} {toast.siteName}</p>
            </div>
          </div>
        </div>
      )}

      {/* KPI strip — clickable filters */}
      <div className="grid grid-cols-5 gap-3">
        {KPI_FILTERS.map(({ key, label, value, icon:Icon, color, bg, activeBg }) => {
          const isActive = activeFilter === key
          return (
            <button key={key}
              onClick={() => setActiveFilter(isActive ? null : key)}
              className={`rounded-xl border px-4 py-3 text-left transition-all ${isActive ? activeBg : `${bg} hover:opacity-80`} ${isActive ? 'ring-1 ring-inset ring-white/10' : ''}`}>
              <Icon className={`w-4 h-4 ${color} mb-1`} />
              <div className={`text-2xl font-bold ${color}`}>{value}</div>
              <div className="text-xs text-gray-400 mt-0.5">{label}</div>
              {isActive && <div className="text-xs text-white/50 mt-0.5">click to clear</div>}
            </button>
          )
        })}
      </div>

      <div className="flex gap-4">
        {/* Map */}
        <div className="flex-1 relative rounded-xl overflow-hidden" style={{ height:'520px' }}>
          <div ref={mapRef} className="w-full h-full" />
          {!selected && (
            <div className="absolute top-3 left-3 bg-gray-900/90 backdrop-blur border border-gray-700/50 rounded-lg px-3 py-2">
              <p className="text-xs text-gray-400">Click any <span className="text-white">✈️ 🚛</span> or site pin for tracking</p>
            </div>
          )}
          <div className="absolute bottom-10 left-3 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-2 space-y-1.5">
            {[['✈️','Air freight'],['🚛','Ground transport'],['📦','Delivered'],['🔴','Customs / Hold']].map(([ico,lbl])=>(
              <div key={lbl} className="flex items-center gap-2"><span className="text-sm">{ico}</span><span className="text-xs text-gray-300">{lbl}</span></div>
            ))}
          </div>
          <style>{`
            @keyframes shippen{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.4;transform:scale(2)}}
            .mapboxgl-popup-content{background:#0f172a!important;border:1px solid #1e293b!important;border-radius:10px!important;padding:12px!important}
            .mapboxgl-popup-tip{display:none!important}
          `}</style>
        </div>

        {/* Right panel */}
        <div className="w-80 flex-shrink-0" style={{ height:'520px', overflowY:'auto' }}>
          {selected ? (
            <TrackingPanel
              shipment={shipments.find(s => s.id === selected.id) ?? selected}
              onBack={() => { setSelected(null); mapInst.current?.flyTo({ center:[10,20], zoom:1.5, speed:1 }) }}
            />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">
                  {activeFilter ? KPI_FILTERS.find(f=>f.key===activeFilter)?.label : 'All Shipments'}
                  <span className="ml-1.5 text-gray-600 normal-case font-normal">({visibleShipments.length})</span>
                </p>
                {activeFilter && (
                  <button onClick={() => setActiveFilter(null)} className="text-xs text-gray-500 hover:text-white transition-colors">
                    ✕ clear
                  </button>
                )}
              </div>
              {/* Recent deliveries */}
              {deliveryFeed.length > 0 && (
                <div className="bg-green-950/30 border border-green-800/40 rounded-xl overflow-hidden mb-3">
                  <div className="px-3 py-2 border-b border-green-800/30 flex items-center gap-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs font-semibold text-green-400">Recent Deliveries</span>
                  </div>
                  {deliveryFeed.slice(0,4).map(d => (
                    <div key={d.id} className="flex items-center gap-2 px-3 py-1.5 border-b border-green-900/30 last:border-0">
                      <span className="text-xs">{d.transport==='air'?'✈️':'🚛'}</span>
                      <span className="text-xs text-green-300 flex-1 truncate">{d.siteName}</span>
                      <span className="text-xs text-green-700 font-mono">{d.ts}</span>
                    </div>
                  ))}
                </div>
              )}
              {/* Site list */}
              {visibleShipments
                .slice()
                .sort((a,b) => {
                  if (a.speedTier==='fast' && b.speedTier!=='fast') return -1
                  if (b.speedTier==='fast' && a.speedTier!=='fast') return 1
                  return b.progress - a.progress
                })
                .map(s => {
                  const pct = Math.round(s.progress*100)
                  const isFlashing = flashIds.has(s.id)
                  const barColor = s.status==='delivered'?'bg-green-500':s.status==='customs'?'bg-orange-500':s.transport==='air'?'bg-blue-500':'bg-yellow-500'
                  return (
                    <button key={s.id} onClick={() => setSelected(s)}
                      className={`w-full text-left p-3 rounded-xl border transition-all group ${
                        isFlashing ? 'border-green-500 bg-green-950/30' : 'border-gray-800 bg-gray-900/60 hover:border-gray-600'
                      }`}>
                      <div className="flex items-center justify-between gap-2 mb-1.5">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-sm">{s.transport==='air'?'✈️':'🚛'}</span>
                          <span className="text-xs font-semibold text-white truncate">{s.siteName}</span>
                          {s.speedTier==='fast' && s.status==='in_transit' && (
                            <span className="text-xs px-1 rounded bg-blue-900 text-blue-300 flex-shrink-0">LIVE</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity text-xs text-blue-400">
                          Track <ChevronRight className="w-3 h-3" />
                        </div>
                      </div>
                      <div className="bg-gray-800 rounded-full h-1 mb-1">
                        <div className={`${barColor} h-1 rounded-full transition-all duration-700`} style={{ width:`${pct}%` }} />
                      </div>
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500">{s.originCity.split(',')[0]} → {s.siteCity}</span>
                        {s.status==='in_transit' && <span className="text-gray-400">{fmtEta(s.etaHours)}</span>}
                        {s.status==='delivered'  && <span className="text-green-400 font-semibold">✓ Delivered</span>}
                        {s.status==='customs'    && <span className="text-orange-400">On hold</span>}
                      </div>
                    </button>
                  )
                })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
