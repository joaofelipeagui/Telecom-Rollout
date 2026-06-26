'use client'
import { useState, useEffect } from 'react'
import { Site, PROVIDERS, Provider, DIAStatus, DIA } from '@/lib/types'
import { updateSite, updateSiteDIA } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { X, Zap, MapPin, Download, Loader2 } from 'lucide-react'
import { generateKMZ, downloadBlob } from '@/lib/kmz'

const DIA_STATUS_LABELS: Record<DIAStatus, string> = {
  not_requested: 'Not Requested',
  requested: 'Requested',
  received: 'Received',
  confirmed: 'Confirmed',
  diverse_confirmed: 'Diversity Confirmed ✓',
}

const DIA_STATUS_COLORS: Record<DIAStatus, string> = {
  not_requested: 'text-gray-500',
  requested: 'text-yellow-400',
  received: 'text-blue-400',
  confirmed: 'text-green-400',
  diverse_confirmed: 'text-emerald-400',
}

interface Props {
  site: Site
  projectId: string
  onClose: () => void
  onUpdate: () => void
}

export function SiteDetailPanel({ site, projectId, onClose, onUpdate }: Props) {
  const [analyzing, setAnalyzing] = useState(false)
  const [aiDesc, setAiDesc] = useState(site.aiDescription || '')
  const [geocoding, setGeocoding] = useState(false)
  const [mapError, setMapError] = useState(false)

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  const fullAddress = `${site.address}, ${site.city} - ${site.state}`
  const lat = site.lat
  const lng = site.lng

  const satelliteUrl = mapboxToken && lat && lng
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${lng},${lat},17,0/600x400@2x?access_token=${mapboxToken}`
    : null

  async function geocodeSite() {
    if (site.lat && site.lng) return
    setGeocoding(true)
    try {
      const res = await fetch(`/api/geocode?address=${encodeURIComponent(fullAddress)}`)
      if (res.ok) {
        const { lat, lng } = await res.json()
        updateSite(projectId, site.id, { lat, lng })
        onUpdate()
      }
    } finally {
      setGeocoding(false)
    }
  }

  useEffect(() => { geocodeSite() }, [])

  async function analyzeWithAI() {
    setAnalyzing(true)
    try {
      let imageBase64: string | undefined
      if (satelliteUrl) {
        const imgRes = await fetch(satelliteUrl)
        const buf = await imgRes.arrayBuffer()
        imageBase64 = btoa(String.fromCharCode(...new Uint8Array(buf)))
      }
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'analyze_site',
          payload: { address: site.address, city: site.city, state: site.state, imageBase64 }
        })
      })
      const { result } = await res.json()
      setAiDesc(result)
      updateSite(projectId, site.id, { aiDescription: result })
      onUpdate()
    } finally {
      setAnalyzing(false)
    }
  }

  function updateDIA(provider: Provider, field: keyof DIA, value: string) {
    updateSiteDIA(projectId, site.id, provider, { [field]: value })
    onUpdate()
  }

  async function exportSingleKMZ() {
    const blob = await generateKMZ([site], site.name)
    downloadBlob(blob, `${site.name.replace(/\s+/g, '_')}.kmz`)
  }

  return (
    <div className="w-96 flex-shrink-0 bg-gray-900 border border-gray-800 rounded-xl overflow-auto max-h-[calc(100vh-200px)]">
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h3 className="font-semibold text-white text-sm">{site.name}</h3>
          <p className="text-xs text-gray-400">{fullAddress}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Satellite Map */}
      <div className="relative">
        {geocoding && (
          <div className="h-40 bg-gray-800 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-xs text-gray-400 ml-2">Locating on map...</span>
          </div>
        )}
        {!geocoding && satelliteUrl && !mapError && (
          <div className="relative">
            <img
              src={satelliteUrl}
              alt="Satellite view"
              className="w-full h-44 object-cover"
              onError={() => setMapError(true)}
            />
            <div className="absolute bottom-2 left-2 bg-black/60 text-xs text-gray-300 px-2 py-1 rounded">
              📡 Satellite view
            </div>
          </div>
        )}
        {!geocoding && (!satelliteUrl || mapError) && (
          <div className="h-40 bg-gray-800 flex flex-col items-center justify-center gap-2">
            <MapPin className="w-6 h-6 text-gray-600" />
            <p className="text-xs text-gray-500">{mapboxToken ? 'Could not load satellite view' : 'Configure MAPBOX_TOKEN for satellite view'}</p>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-300">AI Site Analysis</span>
          <Button size="sm" variant="outline" onClick={analyzeWithAI} disabled={analyzing}
            className="h-6 text-xs border-gray-700 text-gray-300 hover:text-white px-2">
            {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
            {analyzing ? 'Analyzing...' : 'Analyze'}
          </Button>
        </div>
        {aiDesc ? (
          <p className="text-xs text-gray-400 leading-relaxed">{aiDesc}</p>
        ) : (
          <p className="text-xs text-gray-600 italic">Click Analyze to get AI insights about this site from satellite imagery.</p>
        )}
      </div>

      {/* DIA Circuits */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-300">DIA Circuits</span>
          <Button size="sm" variant="ghost" onClick={exportSingleKMZ} className="h-6 text-xs text-gray-400 hover:text-white px-2">
            <Download className="w-3 h-3 mr-1" />
            KMZ
          </Button>
        </div>
        <div className="space-y-3">
          {PROVIDERS.map(provider => {
            const dia = site.dias[provider]
            return (
              <div key={provider} className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white">{provider}</span>
                  <span className={`text-xs ${DIA_STATUS_COLORS[dia?.status || 'not_requested']}`}>
                    {DIA_STATUS_LABELS[dia?.status || 'not_requested']}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Select
                    value={dia?.status || 'not_requested'}
                    onValueChange={(v) => v && updateDIA(provider, 'status', v)}
                  >
                    <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white flex-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-gray-900 border-gray-700">
                      {Object.entries(DIA_STATUS_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k} className="text-xs text-white">{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Input
                    placeholder="Circuit #"
                    value={dia?.circuitNumber || ''}
                    onChange={e => updateDIA(provider, 'circuitNumber', e.target.value)}
                    className="h-7 text-xs bg-gray-800 border-gray-700 text-white w-28"
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Status */}
      <div className="p-4">
        <span className="text-xs font-medium text-gray-300 block mb-2">Site Status</span>
        <Select
          value={site.status}
          onValueChange={(v) => { updateSite(projectId, site.id, { status: v as Site['status'] }); onUpdate() }}
        >
          <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            {['pending', 'in_progress', 'completed', 'blocked'].map(s => (
              <SelectItem key={s} value={s} className="text-white">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  )
}
