'use client'
import { useState } from 'react'
import { Project, Site, Router, defaultRouter, isSiteLogisticsReady, isSiteDIAReady, isSiteFullyReady } from '@/lib/types'
import { updateSite } from '@/lib/store'
import { RouterCard } from './RouterCard'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Package, CheckCircle, Truck, Plane, AlertTriangle, ChevronRight } from 'lucide-react'

interface Props {
  project: Project
  onUpdate: () => void
}

export function LogisticsView({ project, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Site | null>(null)

  const filtered = project.sites.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase())
  )

  // Stats
  const fullyReady = project.sites.filter(isSiteFullyReady).length
  const logisticsReady = project.sites.filter(isSiteLogisticsReady).length
  const inFlight = project.sites.filter(s => s.routers?.some(r => r.status === 'in_flight')).length
  const inTransit = project.sites.filter(s => s.routers?.some(r => r.status === 'in_transit')).length

  function getRouters(site: Site): [Router, Router] {
    return site.routers ?? [defaultRouter('primary'), defaultRouter('backup')]
  }

  function saveRouters(site: Site, routers: [Router, Router]) {
    updateSite(project.id, site.id, { routers })
    onUpdate()
    setSelected(prev => prev?.id === site.id ? { ...prev, routers } : prev)
  }

  function siteStatusIcon(site: Site) {
    if (isSiteFullyReady(site)) return <CheckCircle className="w-3.5 h-3.5 text-green-400" />
    const routers = getRouters(site)
    if (routers.some(r => r.status === 'in_flight')) return <Plane className="w-3.5 h-3.5 text-blue-400" />
    if (routers.some(r => r.status === 'in_transit' || r.status === 'delivered')) return <Truck className="w-3.5 h-3.5 text-yellow-400" />
    return <Package className="w-3.5 h-3.5 text-gray-500" />
  }

  function siteStatusLabel(site: Site) {
    if (isSiteFullyReady(site)) return 'Ready'
    const routers = getRouters(site)
    if (routers.some(r => r.status === 'in_flight')) return 'In Flight'
    if (routers.some(r => r.status === 'in_transit')) return 'In Transit'
    if (routers.some(r => r.status === 'delivered')) return 'Delivered'
    if (routers.some(r => r.status === 'landed')) return 'Landed'
    if (routers.some(r => r.status === 'warehouse')) return 'Warehouse'
    return 'Ordered'
  }

  return (
    <div className="space-y-5">
      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Sites Ready', value: fullyReady, icon: CheckCircle, color: 'text-green-400' },
          { label: 'Routers Installed', value: logisticsReady, icon: Package, color: 'text-blue-400' },
          { label: 'In Flight', value: inFlight, icon: Plane, color: 'text-cyan-400' },
          { label: 'In Transit', value: inTransit, icon: Truck, color: 'text-yellow-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <Icon className={`w-4 h-4 ${color} mb-1`} />
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400">{label}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {/* Site list */}
        <div className="w-72 flex-shrink-0 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..."
              className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 h-9" />
          </div>
          <div className="text-xs text-gray-500">{filtered.length} sites</div>
          <div className="space-y-1 overflow-auto max-h-[calc(100vh-380px)]">
            {filtered.map(site => {
              const diaOk = isSiteDIAReady(site)
              const logOk = isSiteLogisticsReady(site)
              return (
                <button key={site.id} onClick={() => setSelected(site)}
                  className={`w-full text-left p-3 rounded-lg border transition-all ${
                    selected?.id === site.id ? 'border-blue-500/50 bg-blue-950/20' : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                  }`}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                      {siteStatusIcon(site)}
                      <span className="text-xs font-medium text-white truncate">{site.name}</span>
                    </div>
                    <span className="text-xs text-gray-500 flex-shrink-0">{siteStatusLabel(site)}</span>
                  </div>
                  <div className="flex gap-2 mt-1 ml-5">
                    <span className={`text-xs ${diaOk ? 'text-green-500' : 'text-gray-600'}`}>
                      {diaOk ? '✓' : '○'} DIA
                    </span>
                    <span className={`text-xs ${logOk ? 'text-green-500' : 'text-gray-600'}`}>
                      {logOk ? '✓' : '○'} Devices
                    </span>
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Router detail */}
        {selected ? (
          <div className="flex-1 space-y-4 overflow-auto max-h-[calc(100vh-320px)]">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-base font-semibold text-white">{selected.name}</h3>
                <p className="text-sm text-gray-400">{selected.address}, {selected.city} - {selected.state}</p>
              </div>
              <div className="flex gap-2">
                <Badge className={`text-xs ${isSiteDIAReady(selected) ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                  {isSiteDIAReady(selected) ? '✓ DIA Ready' : '○ DIA Pending'}
                </Badge>
                <Badge className={`text-xs ${isSiteLogisticsReady(selected) ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                  {isSiteLogisticsReady(selected) ? '✓ Devices Ready' : '○ Devices Pending'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              {(['primary', 'backup'] as const).map((role, i) => {
                const routers = getRouters(selected)
                return (
                  <RouterCard
                    key={role}
                    router={routers[i]}
                    siteAddress={`${selected.address}, ${selected.city} - ${selected.state}`}
                    onChange={(updated) => {
                      const newRouters: [Router, Router] = [...routers] as [Router, Router]
                      newRouters[i] = updated
                      saveRouters(selected, newRouters)
                    }}
                  />
                )
              })}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-600">
            <div className="text-center">
              <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p className="text-sm">Select a site to manage device logistics</p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
