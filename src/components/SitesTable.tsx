'use client'
import { useState } from 'react'
import { Project, Site, SiteStatus, PROVIDERS } from '@/lib/types'
import { updateSite } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { MapPin, Zap, ChevronRight, Search } from 'lucide-react'
import { SiteDetailPanel } from './SiteDetailPanel'

const STATUS_COLORS: Record<SiteStatus, string> = {
  pending: 'bg-gray-700 text-gray-300',
  in_progress: 'bg-blue-900 text-blue-300',
  completed: 'bg-green-900 text-green-300',
  blocked: 'bg-red-900 text-red-300',
}

interface Props {
  project: Project
  onUpdate: () => void
}

export function SitesTable({ project, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('all')
  const [selectedSite, setSelectedSite] = useState<Site | null>(null)

  const filtered = project.sites.filter(site => {
    const matchSearch = !search ||
      site.name.toLowerCase().includes(search.toLowerCase()) ||
      site.address.toLowerCase().includes(search.toLowerCase()) ||
      site.city.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'all' || site.status === filterStatus
    return matchSearch && matchStatus
  })

  function diaCount(site: Site) {
    const total = Object.keys(site.dias).length
    const confirmed = Object.values(site.dias).filter(d => d.status === 'confirmed' || d.status === 'diverse_confirmed').length
    return { total, confirmed }
  }

  return (
    <div className="flex gap-4">
      <div className="flex-1 min-w-0">
        <div className="flex gap-3 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search sites..."
              className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
            <SelectTrigger className="w-40 bg-gray-900 border-gray-700 text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-gray-900 border-gray-700">
              {['all', 'pending', 'in_progress', 'completed', 'blocked'].map(s => (
                <SelectItem key={s} value={s} className="text-white">{s === 'all' ? 'All statuses' : s.replace('_', ' ')}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="text-xs text-gray-500 mb-2">{filtered.length} of {project.sites.length} sites</div>

        <div className="space-y-1">
          {filtered.map(site => {
            const { total, confirmed } = diaCount(site)
            return (
              <div
                key={site.id}
                onClick={() => setSelectedSite(site)}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg cursor-pointer transition-colors border ${
                  selectedSite?.id === site.id
                    ? 'bg-gray-800 border-blue-500/50'
                    : 'bg-gray-900 border-gray-800 hover:border-gray-600'
                }`}
              >
                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-white truncate">{site.name}</div>
                  <div className="text-xs text-gray-400 truncate">{site.address}, {site.city} - {site.state}</div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {total > 0 && (
                    <span className={`text-xs px-2 py-0.5 rounded-full ${confirmed === total ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-400'}`}>
                      DIA {confirmed}/{total}
                    </span>
                  )}
                  <Badge className={`text-xs ${STATUS_COLORS[site.status]}`}>
                    {site.status.replace('_', ' ')}
                  </Badge>
                  <ChevronRight className="w-4 h-4 text-gray-600" />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {selectedSite && (
        <SiteDetailPanel
          site={selectedSite}
          projectId={project.id}
          onClose={() => setSelectedSite(null)}
          onUpdate={() => {
            onUpdate()
            // refresh selected site from updated project
          }}
        />
      )}
    </div>
  )
}
