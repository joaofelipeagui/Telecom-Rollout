'use client'
import { useState, useEffect, useRef } from 'react'
import { Site, PROVIDERS, Provider, DIAStatus, DIA, SitePhoto, RefreshType, REFRESH_TYPES, REFRESH_TYPE_LABELS, REFRESH_TYPE_COLORS } from '@/lib/types'
import { updateSite, updateSiteDIA, addChangeLog } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { X, Zap, MapPin, Download, Loader2, Camera, Trash2, CheckSquare, Image } from 'lucide-react'
import { generateKMZ, downloadBlob } from '@/lib/kmz'
import { SiteChecklist } from '@/components/SiteChecklist'

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

type Tab = 'dia' | 'checklist' | 'photos'

interface Props {
  site: Site
  projectId: string
  onClose: () => void
  onUpdate: () => void
  readonly?: boolean
}

export function SiteDetailPanel({ site, projectId, onClose, onUpdate, readonly }: Props) {
  const [tab, setTab] = useState<Tab>('dia')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiDesc, setAiDesc] = useState(site.aiDescription || '')
  const [geocoding, setGeocoding] = useState(false)
  const [mapError, setMapError] = useState(false)
  const photoRef = useRef<HTMLInputElement>(null)

  const mapboxToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN
  const fullAddress = `${site.address}, ${site.city} - ${site.state}`
  const satelliteUrl = mapboxToken && site.lat && site.lng
    ? `https://api.mapbox.com/styles/v1/mapbox/satellite-streets-v12/static/${site.lng},${site.lat},17,0/600x400@2x?access_token=${mapboxToken}`
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
    } finally { setGeocoding(false) }
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
        body: JSON.stringify({ type: 'analyze_site', payload: { address: site.address, city: site.city, state: site.state, imageBase64 } })
      })
      const { result } = await res.json()
      setAiDesc(result)
      updateSite(projectId, site.id, { aiDescription: result })
      onUpdate()
    } finally { setAnalyzing(false) }
  }

  function updateDIA(provider: Provider, field: keyof DIA, value: string) {
    const old = site.dias[provider]
    if (field === 'status') {
      addChangeLog(projectId, {
        siteId: site.id, siteName: site.name,
        field: `DIA ${provider} status`,
        oldValue: old?.status,
        newValue: value,
      })
    }
    updateSiteDIA(projectId, site.id, provider, { [field]: value })
    onUpdate()
  }

  function changeStatus(v: string) {
    updateSite(projectId, site.id, { status: v as Site['status'] }, {
      field: 'status',
      oldValue: site.status,
      newValue: v,
    })
    onUpdate()
  }

  function changeRefreshType(v: string) {
    const rt = v === 'none' ? undefined : v as RefreshType
    updateSite(projectId, site.id, { refreshType: rt }, {
      field: 'refreshType',
      oldValue: site.refreshType,
      newValue: v,
    })
    onUpdate()
  }

  async function exportSingleKMZ() {
    const blob = await generateKMZ([site], site.name)
    downloadBlob(blob, `${site.name.replace(/\s+/g, '_')}.kmz`)
  }

  // Photos
  function addPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = ev => {
      const photo: SitePhoto = {
        id: `ph_${Date.now()}`,
        name: file.name,
        dataUrl: ev.target?.result as string,
        uploadedAt: new Date().toISOString(),
      }
      const photos = [...(site.photos ?? []), photo]
      updateSite(projectId, site.id, { photos })
      onUpdate()
    }
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  function deletePhoto(id: string) {
    updateSite(projectId, site.id, { photos: (site.photos ?? []).filter(p => p.id !== id) })
    onUpdate()
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'dia', label: 'DIA Circuits' },
    { id: 'checklist', label: 'Checklist' },
    { id: 'photos', label: `Photos${site.photos?.length ? ` (${site.photos.length})` : ''}` },
  ]

  return (
    <div className="w-96 flex-shrink-0 card-glow bg-[#070d16] rounded-xl overflow-auto max-h-[calc(100vh-200px)]">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-800">
        <div>
          <h3 className="font-semibold text-white text-sm">{site.name}</h3>
          <p className="text-xs text-gray-400">{fullAddress}</p>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      {/* Satellite Map */}
      <div className="relative">
        {geocoding && (
          <div className="h-40 bg-gray-800 flex items-center justify-center">
            <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            <span className="text-xs text-gray-400 ml-2">Locating on map…</span>
          </div>
        )}
        {!geocoding && satelliteUrl && !mapError && (
          <div className="relative">
            <img src={satelliteUrl} alt="Satellite view" className="w-full h-44 object-cover"
              onError={() => setMapError(true)} />
            <div className="absolute bottom-2 left-2 bg-black/60 text-xs text-gray-300 px-2 py-1 rounded">
              📡 Satellite view
            </div>
          </div>
        )}
        {!geocoding && (!satelliteUrl || mapError) && (
          <div className="h-40 bg-gray-800 flex flex-col items-center justify-center gap-2">
            <MapPin className="w-6 h-6 text-gray-600" />
            <p className="text-xs text-gray-500">No satellite view available</p>
          </div>
        )}
      </div>

      {/* AI Analysis */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-300">AI Site Analysis</span>
          {!readonly && (
            <Button size="sm" variant="outline" onClick={analyzeWithAI} disabled={analyzing}
              className="h-6 text-xs border-gray-700 text-gray-300 hover:text-white px-2">
              {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
              {analyzing ? 'Analyzing…' : 'Analyze'}
            </Button>
          )}
        </div>
        {aiDesc
          ? <p className="text-xs text-gray-400 leading-relaxed">{aiDesc}</p>
          : <p className="text-xs text-gray-600 italic">Click Analyze to get AI insights from satellite imagery.</p>
        }
      </div>

      {/* Status + Refresh Type */}
      <div className="p-4 border-b border-gray-800 space-y-3">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-gray-300">Site Status</span>
          <Button size="sm" variant="ghost" onClick={exportSingleKMZ} className="h-6 text-xs text-gray-400 hover:text-white px-2">
            <Download className="w-3 h-3 mr-1" />KMZ
          </Button>
        </div>
        <Select value={site.status} onValueChange={v => v && changeStatus(v)} disabled={readonly}>
          <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            {['pending','in_progress','completed','blocked'].map(s => (
              <SelectItem key={s} value={s} className="text-white">{s.replace('_', ' ')}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-medium text-gray-300">Refresh Type</span>
            {site.refreshType && (
              <span className={`text-xs px-2 py-0.5 rounded border font-semibold ${REFRESH_TYPE_COLORS[site.refreshType]}`}>
                {site.refreshType}
              </span>
            )}
          </div>
          <Select value={site.refreshType || 'none'} onValueChange={v => v && changeRefreshType(v)} disabled={readonly}>
            <SelectTrigger className="bg-gray-800 border-gray-700 text-white text-sm">
              <SelectValue placeholder="No type assigned" />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              <SelectItem value="none" className="text-gray-400">No type assigned</SelectItem>
              {REFRESH_TYPES.map(t => (
                <SelectItem key={t} value={t} className="text-white">{t} — {REFRESH_TYPE_LABELS[t]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-gray-800">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 text-xs py-2.5 font-medium transition-colors ${tab === t.id ? 'text-blue-400 border-b-2 border-blue-500' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="p-4">
        {tab === 'dia' && (
          <div className="space-y-4">
            {PROVIDERS.map(provider => {
              const dia = site.dias[provider]
              return (
                <div key={provider} className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-white">{provider}</span>
                    <span className={`text-xs ${DIA_STATUS_COLORS[dia?.status || 'not_requested']}`}>
                      {DIA_STATUS_LABELS[dia?.status || 'not_requested']}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Select value={dia?.status || 'not_requested'}
                      onValueChange={v => v && updateDIA(provider, 'status', v)}>
                      <SelectTrigger className="h-7 text-xs bg-gray-800 border-gray-700 text-white flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700">
                        {Object.entries(DIA_STATUS_LABELS).map(([k, v]) => (
                          <SelectItem key={k} value={k} className="text-xs text-white">{v}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Input placeholder="Circuit #" value={dia?.circuitNumber || ''}
                      onChange={e => updateDIA(provider, 'circuitNumber', e.target.value)}
                      className="h-7 text-xs bg-gray-800 border-gray-700 text-white w-24"
                      readOnly={readonly} />
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <p className="text-label mb-1">Requested</p>
                      <Input type="date" value={dia?.requestedAt || ''}
                        onChange={e => updateDIA(provider, 'requestedAt', e.target.value)}
                        className="h-7 text-xs bg-gray-800 border-gray-700 text-white"
                        readOnly={readonly} />
                    </div>
                    <div className="flex-1">
                      <p className="text-label mb-1">SLA Deadline</p>
                      <Input type="date" value={dia?.slaDate || ''}
                        onChange={e => updateDIA(provider, 'slaDate', e.target.value)}
                        className={`h-7 text-xs bg-gray-800 border-gray-700 text-white ${
                          dia?.slaDate && new Date(dia.slaDate) < new Date() && dia.status !== 'confirmed' && dia.status !== 'diverse_confirmed'
                            ? 'border-red-500 text-red-400' : ''
                        }`}
                        readOnly={readonly} />
                    </div>
                  </div>
                  {dia?.slaDate && new Date(dia.slaDate) < new Date() && dia.status !== 'confirmed' && dia.status !== 'diverse_confirmed' && (
                    <p className="text-xs text-red-400">⚠ SLA overdue — {Math.abs(Math.ceil((new Date(dia.slaDate).getTime() - Date.now()) / 86400000))}d past deadline</p>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {tab === 'checklist' && (
          <SiteChecklist site={site} projectId={projectId} onUpdate={onUpdate} readonly={readonly} />
        )}

        {tab === 'photos' && (
          <div className="space-y-3">
            {!readonly && (
              <>
                <Button size="sm" variant="outline" onClick={() => photoRef.current?.click()}
                  className="w-full border-dashed border-gray-700 text-gray-400 hover:text-white h-20 flex-col gap-1">
                  <Camera className="w-5 h-5" />
                  <span className="text-xs">Upload site photo</span>
                </Button>
                <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={addPhoto} />
              </>
            )}
            {(site.photos ?? []).length === 0 && (
              <div className="text-center py-6 text-gray-600">
                <Image className="w-6 h-6 mx-auto mb-1 opacity-40" />
                <p className="text-xs">No photos yet</p>
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              {(site.photos ?? []).map(photo => (
                <div key={photo.id} className="relative group rounded-lg overflow-hidden bg-gray-800">
                  <img src={photo.dataUrl} alt={photo.name}
                    className="w-full h-28 object-cover" />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-colors flex items-center justify-center">
                    {!readonly && (
                      <button onClick={() => deletePhoto(photo.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity bg-red-600 rounded-full p-1">
                        <Trash2 className="w-3.5 h-3.5 text-white" />
                      </button>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 truncate px-1.5 py-1">{photo.name}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
