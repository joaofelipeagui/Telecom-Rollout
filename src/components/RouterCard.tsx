'use client'
import { useState } from 'react'
import { Router, DeviceStatus, DEVICE_STATUS_LABELS, DEVICE_STATUS_COLORS } from '@/lib/types'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { Plane, Truck, Package, CheckCircle, Loader2, MapPin, ExternalLink } from 'lucide-react'

interface FlightInfo {
  flightNumber: string
  status: string
  departure: { airport: string; iata: string; scheduled: string; actual?: string }
  arrival: { airport: string; iata: string; scheduled: string; estimated?: string; actual?: string }
  airline: string
}

interface Props {
  router: Router
  siteAddress: string
  onChange: (updated: Router) => void
}

const STATUS_STEPS: DeviceStatus[] = ['ordered', 'warehouse', 'in_flight', 'landed', 'in_transit', 'delivered', 'installed']

const STATUS_ICONS: Record<DeviceStatus, React.ReactNode> = {
  ordered: <Package className="w-3.5 h-3.5" />,
  warehouse: <Package className="w-3.5 h-3.5" />,
  in_flight: <Plane className="w-3.5 h-3.5" />,
  landed: <Plane className="w-3.5 h-3.5" />,
  in_transit: <Truck className="w-3.5 h-3.5" />,
  delivered: <Truck className="w-3.5 h-3.5" />,
  installed: <CheckCircle className="w-3.5 h-3.5" />,
}

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

export function RouterCard({ router, siteAddress, onChange }: Props) {
  const [flightInfo, setFlightInfo] = useState<FlightInfo | null>(null)
  const [loadingFlight, setLoadingFlight] = useState(false)
  const [flightError, setFlightError] = useState('')

  const currentStep = STATUS_STEPS.indexOf(router.status)

  function update(field: keyof Router, value: string) {
    onChange({ ...router, [field]: value })
  }

  async function trackFlight() {
    if (!router.flightNumber) return
    setLoadingFlight(true)
    setFlightError('')
    try {
      const res = await fetch(`/api/flight?flight=${encodeURIComponent(router.flightNumber)}`)
      const data = await res.json()
      if (data.error) { setFlightError(data.error); return }
      setFlightInfo(data)
      if (data.status === 'active') onChange({ ...router, status: 'in_flight' })
      if (data.status === 'landed') onChange({ ...router, status: 'landed', flightETA: data.arrival?.actual || data.arrival?.estimated })
    } catch {
      setFlightError('Could not fetch flight data')
    } finally {
      setLoadingFlight(false)
    }
  }

  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(siteAddress + ', Brazil')}&navigate=yes`
  const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(siteAddress + ', Brazil')}`

  const roleColor = router.role === 'primary' ? 'border-blue-500/30 bg-blue-950/10' : 'border-purple-500/30 bg-purple-950/10'
  const roleLabel = router.role === 'primary' ? '🔵 PRIMARY' : '🟣 BACKUP'

  return (
    <div className={`border rounded-xl p-4 space-y-4 ${roleColor}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-gray-300">{roleLabel}</span>
          <span className="text-xs text-gray-500">Router</span>
        </div>
        <span className={`text-xs font-medium flex items-center gap-1 ${DEVICE_STATUS_COLORS[router.status]}`}>
          {STATUS_ICONS[router.status]}
          {DEVICE_STATUS_LABELS[router.status]}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex gap-1">
        {STATUS_STEPS.map((step, i) => (
          <div
            key={step}
            className={`flex-1 h-1 rounded-full transition-all ${i <= currentStep ? 'bg-blue-500' : 'bg-gray-700'}`}
          />
        ))}
      </div>

      {/* Fields */}
      <div className="grid grid-cols-2 gap-2">
        <div>
          <p className="text-xs text-gray-500 mb-1">TAG Number</p>
          <Input value={router.tagNumber} onChange={e => update('tagNumber', e.target.value)}
            placeholder="BR-04821" className="h-7 text-xs bg-gray-800 border-gray-700 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Model</p>
          <Input value={router.model} onChange={e => update('model', e.target.value)}
            placeholder="Cisco ISR4321" className="h-7 text-xs bg-gray-800 border-gray-700 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Serial Number</p>
          <Input value={router.serialNumber || ''} onChange={e => update('serialNumber', e.target.value)}
            placeholder="FTX2045A1B2" className="h-7 text-xs bg-gray-800 border-gray-700 text-white" />
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Status</p>
          <Select value={router.status} onValueChange={v => v && update('status', v)}>
            <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {STATUS_STEPS.map(s => (
                <SelectItem key={s} value={s} className="text-xs text-white">
                  {DEVICE_STATUS_LABELS[s]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Flight tracking */}
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-gray-300 flex items-center gap-1">
          <Plane className="w-3.5 h-3.5 text-blue-400" /> Flight Tracking
        </p>
        <div className="flex gap-2">
          <Input value={router.flightNumber || ''} onChange={e => update('flightNumber', e.target.value)}
            placeholder="e.g. LA8042 or GOL1423"
            className="h-7 text-xs bg-gray-800 border-gray-700 text-white flex-1" />
          <Button size="sm" onClick={trackFlight} disabled={loadingFlight || !router.flightNumber}
            className="h-7 text-xs bg-blue-700 hover:bg-blue-600 px-2">
            {loadingFlight ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Track'}
          </Button>
        </div>

        {flightError && <p className="text-xs text-red-400">{flightError}</p>}

        {flightInfo && (
          <div className="text-xs space-y-1 mt-2">
            <div className="flex justify-between">
              <span className="text-gray-400">{flightInfo.airline} · {flightInfo.flightNumber}</span>
              <span className={`font-medium ${flightInfo.status === 'landed' ? 'text-green-400' : flightInfo.status === 'active' ? 'text-blue-400' : 'text-gray-400'}`}>
                {flightInfo.status?.toUpperCase()}
              </span>
            </div>
            <div className="flex justify-between text-gray-400">
              <span>✈ {flightInfo.departure.iata} → {flightInfo.arrival.iata}</span>
              <span>ETA: {formatDateTime(flightInfo.arrival.estimated || flightInfo.arrival.scheduled)}</span>
            </div>
            {flightInfo.arrival.actual && (
              <div className="text-green-400">Landed: {formatDateTime(flightInfo.arrival.actual)}</div>
            )}
          </div>
        )}
      </div>

      {/* Last mile / truck */}
      <div className="bg-gray-800/50 rounded-lg p-3 space-y-2">
        <p className="text-xs font-medium text-gray-300 flex items-center gap-1">
          <Truck className="w-3.5 h-3.5 text-yellow-400" /> Last Mile Delivery
        </p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <p className="text-xs text-gray-500 mb-1">Courier</p>
            <Input value={router.courierName || ''} onChange={e => update('courierName', e.target.value)}
              placeholder="DHL / FedEx / Correios" className="h-7 text-xs bg-gray-800 border-gray-700 text-white" />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">Tracking #</p>
            <Input value={router.courierTracking || ''} onChange={e => update('courierTracking', e.target.value)}
              placeholder="BR99123456" className="h-7 text-xs bg-gray-800 border-gray-700 text-white" />
          </div>
        </div>

        {/* Navigate buttons */}
        <div className="flex gap-2 pt-1">
          <a href={wazeUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 text-xs bg-cyan-900/40 hover:bg-cyan-800/40 border border-cyan-700/30 text-cyan-300 rounded-lg py-1.5 transition-colors">
            <MapPin className="w-3.5 h-3.5" /> Open in Waze
          </a>
          <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 text-xs bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 rounded-lg py-1.5 transition-colors">
            <ExternalLink className="w-3.5 h-3.5" /> Google Maps
          </a>
        </div>
      </div>

      {/* Installation */}
      {(router.status === 'delivered' || router.status === 'installed') && (
        <div className="bg-green-950/20 border border-green-800/30 rounded-lg p-3 space-y-2">
          <p className="text-xs font-medium text-green-300 flex items-center gap-1">
            <CheckCircle className="w-3.5 h-3.5" /> Installation
          </p>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <p className="text-xs text-gray-500 mb-1">Installed by</p>
              <Input value={router.installedBy || ''} onChange={e => update('installedBy', e.target.value)}
                placeholder="Engineer name" className="h-7 text-xs bg-gray-800 border-gray-700 text-white" />
            </div>
            <div className="flex items-end">
              {router.status !== 'installed' ? (
                <Button size="sm" onClick={() => onChange({ ...router, status: 'installed', installedAt: new Date().toISOString() })}
                  className="h-7 w-full text-xs bg-green-700 hover:bg-green-600">
                  Mark Installed
                </Button>
              ) : (
                <p className="text-xs text-green-400">✓ {formatDateTime(router.installedAt)}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
