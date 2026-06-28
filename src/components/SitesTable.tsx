'use client'
import { useState } from 'react'
import { Project, Site, SiteStatus, Wave, Region, REGIONS, REGION_LABELS, REGION_COLORS, getRegionForCountry } from '@/lib/types'
import { updateSite } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useToast } from '@/components/ui/toast'
import { MapPin, ChevronRight, Search, Filter, SlidersHorizontal, X, Globe } from 'lucide-react'
import { SiteDetailPanel } from './SiteDetailPanel'

const STATUS_COLORS: Record<SiteStatus, string> = {
  pending:     'bg-gray-700/80 text-gray-300',
  in_progress: 'bg-blue-900/80 text-blue-300',
  completed:   'bg-green-900/80 text-green-300',
  blocked:     'bg-red-900/80 text-red-300',
}
const STATUS_DOT: Record<SiteStatus, string> = {
  pending:     'bg-gray-500',
  in_progress: 'bg-blue-400 dot-blue',
  completed:   'bg-green-400 dot-green',
  blocked:     'bg-red-400 dot-red',
}

interface Props {
  project: Project
  onUpdate: () => void
  readonly?: boolean
}

export function SitesTable({ project, onUpdate, readonly }: Props) {
  const toast = useToast()
  const [search,        setSearch]        = useState('')
  const [filterStatus,  setFilterStatus]  = useState('all')
  const [filterWave,    setFilterWave]    = useState('all')
  const [filterCountry, setFilterCountry] = useState('all')
  const [filterRegion,  setFilterRegion]  = useState('all')
  const [selectedSite,  setSelectedSite]  = useState<Site | null>(null)
  const [showFilters,   setShowFilters]   = useState(false)

  // Unique countries from sites
  const countries = Array.from(new Set(project.sites.map(s => s.country).filter(Boolean))).sort()
  const waves: Wave[] = [1, 2, 3]

  const activeFilters = [filterStatus, filterWave, filterCountry, filterRegion].filter(f => f !== 'all').length

  const filtered = project.sites.filter(site => {
    const q = search.toLowerCase()
    const matchSearch = !search ||
      site.name.toLowerCase().includes(q) ||
      (site.address || '').toLowerCase().includes(q) ||
      (site.city || '').toLowerCase().includes(q) ||
      (site.country || '').toLowerCase().includes(q)
    const matchStatus  = filterStatus  === 'all' || site.status === filterStatus
    const matchWave    = filterWave    === 'all' || String(site.wave) === filterWave
    const matchCountry = filterCountry === 'all' || site.country === filterCountry
    const matchRegion  = filterRegion  === 'all' || getRegionForCountry(site.country) === filterRegion
    return matchSearch && matchStatus && matchWave && matchCountry && matchRegion
  })

  function diaCount(site: Site) {
    const confirmed = Object.values(site.dias).filter(d =>
      d.status === 'confirmed' || d.status === 'diverse_confirmed').length
    return { total: Object.keys(site.dias).length, confirmed }
  }

  function changeStatus(site: Site, status: string) {
    updateSite(project.id, site.id, { status: status as SiteStatus }, {
      field: 'status', oldValue: site.status, newValue: status,
    })
    toast(`${site.name} → ${status.replace('_', ' ')}`)
    onUpdate()
    // refresh selected site if it's the one being updated
    if (selectedSite?.id === site.id) {
      setSelectedSite({ ...selectedSite, status: status as SiteStatus })
    }
  }

  function clearFilters() {
    setSearch('')
    setFilterStatus('all')
    setFilterWave('all')
    setFilterCountry('all')
    setFilterRegion('all')
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">

        {/* Search + filter bar */}
        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search by name, city, address, country…"
              className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(v => !v)}
            className={`border-gray-700 h-10 gap-1.5 ${showFilters || activeFilters > 0 ? 'border-blue-600 text-blue-400' : 'text-gray-400'}`}
          >
            <SlidersHorizontal className="w-4 h-4" />
            Filters
            {activeFilters > 0 && (
              <span className="bg-blue-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                {activeFilters}
              </span>
            )}
          </Button>
        </div>

        {/* Expanded filters */}
        {showFilters && (
          <div className="flex gap-2 mb-3 flex-wrap">
            <Select value={filterStatus} onValueChange={v => v && setFilterStatus(v)}>
              <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white text-xs h-8">
                <Filter className="w-3 h-3 mr-1.5 text-gray-400" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="all" className="text-white text-xs">All statuses</SelectItem>
                {['pending','in_progress','completed','blocked'].map(s => (
                  <SelectItem key={s} value={s} className="text-white text-xs">{s.replace('_', ' ')}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterWave} onValueChange={v => v && setFilterWave(v)}>
              <SelectTrigger className="w-32 bg-gray-900 border-gray-700 text-white text-xs h-8">
                <SelectValue placeholder="Wave" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="all" className="text-white text-xs">All waves</SelectItem>
                {waves.map(w => (
                  <SelectItem key={w} value={String(w)} className="text-white text-xs">Wave {w}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filterRegion} onValueChange={v => v && setFilterRegion(v)}>
              <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-white text-xs h-8">
                <Globe className="w-3 h-3 mr-1.5 text-gray-400" />
                <SelectValue placeholder="Zone" />
              </SelectTrigger>
              <SelectContent className="bg-gray-900 border-gray-700">
                <SelectItem value="all" className="text-white text-xs">All zones</SelectItem>
                {REGIONS.map(r => (
                  <SelectItem key={r} value={r} className="text-white text-xs">{r} — {REGION_LABELS[r].split(',')[0]}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {countries.length > 0 && (
              <Select value={filterCountry} onValueChange={v => v && setFilterCountry(v)}>
                <SelectTrigger className="w-44 bg-gray-900 border-gray-700 text-white text-xs h-8">
                  <SelectValue placeholder="Country" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 max-h-60">
                  <SelectItem value="all" className="text-white text-xs">All countries</SelectItem>
                  {countries.map(c => (
                    <SelectItem key={c} value={c} className="text-white text-xs">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {activeFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters}
                className="h-8 text-xs text-gray-400 hover:text-white px-2">
                <X className="w-3 h-3 mr-1" /> Clear
              </Button>
            )}
          </div>
        )}

        {/* Count row */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-gray-500">
            {filtered.length} of {project.sites.length} sites
            {activeFilters > 0 && <span className="text-blue-400 ml-1">(filtered)</span>}
          </span>
          {filtered.length !== project.sites.length && (
            <button onClick={clearFilters} className="text-xs text-gray-500 hover:text-gray-300 underline underline-offset-2">
              show all
            </button>
          )}
        </div>

        {/* Site list */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            {project.sites.length === 0 ? (
              <>
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <MapPin className="w-7 h-7 text-blue-400" />
                </div>
                <p className="text-white font-semibold mb-1">No sites yet</p>
                <p className="text-gray-500 text-sm max-w-xs">
                  Add your first site using the <span className="text-blue-400 font-medium">+ Add Site</span> button above,
                  or create a new project and import a CSV file.
                </p>
              </>
            ) : (
              <>
                <Search className="w-8 h-8 text-gray-600 mb-3" />
                <p className="text-gray-400 font-medium mb-1">No sites match your filters</p>
                <p className="text-gray-500 text-sm mb-4">Try adjusting the search or filter criteria</p>
                <Button variant="outline" size="sm" onClick={clearFilters}
                  className="border-gray-700 text-gray-300 text-xs">
                  <X className="w-3 h-3 mr-1" /> Clear all filters
                </Button>
              </>
            )}
          </div>
        ) : (
          <div className="space-y-1">
            {filtered.map(site => {
              const { total, confirmed } = diaCount(site)
              const isSelected = selectedSite?.id === site.id
              return (
                <div
                  key={site.id}
                  className={`group flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors border ${
                    isSelected
                      ? 'bg-gray-800 border-blue-500/50'
                      : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                  }`}
                  onClick={() => setSelectedSite(isSelected ? null : site)}
                >
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${STATUS_DOT[site.status]}`} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-white truncate">{site.name}</span>
                      {site.wave && (
                        <span className="text-xs px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 flex-shrink-0">
                          W{site.wave}
                        </span>
                      )}
                      {(() => {
                        const region = getRegionForCountry(site.country)
                        const cls = REGION_COLORS[region]
                        return (
                          <span className={`text-xs px-1.5 py-0.5 rounded border flex-shrink-0 font-medium ${cls}`}>
                            {region}
                          </span>
                        )
                      })()}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">
                      {[site.city, site.country].filter(Boolean).join(', ')}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {total > 0 && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        confirmed === total ? 'bg-green-900/60 text-green-300' : 'bg-gray-800 text-gray-400'
                      }`}>
                        DIA {confirmed}/{total}
                      </span>
                    )}

                    {/* Inline status change */}
                    {!readonly && (
                      <div onClick={e => e.stopPropagation()}>
                        <Select value={site.status} onValueChange={v => v && changeStatus(site, v)}>
                          <SelectTrigger className={`h-6 text-xs border-0 px-2 py-0 rounded-full ${STATUS_COLORS[site.status]} focus:ring-0 w-auto`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-700">
                            {(['pending','in_progress','completed','blocked'] as SiteStatus[]).map(s => (
                              <SelectItem key={s} value={s} className="text-white text-xs">
                                {s.replace('_', ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {readonly && (
                      <Badge className={`text-xs ${STATUS_COLORS[site.status]}`}>
                        {site.status.replace('_', ' ')}
                      </Badge>
                    )}

                    <ChevronRight className={`w-4 h-4 text-gray-600 transition-transform ${isSelected ? 'rotate-90' : ''}`} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {selectedSite && (
        <SiteDetailPanel
          site={project.sites.find(s => s.id === selectedSite.id) ?? selectedSite}
          projectId={project.id}
          onClose={() => setSelectedSite(null)}
          onUpdate={onUpdate}
          readonly={readonly}
        />
      )}
    </div>
  )
}
