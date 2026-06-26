'use client'
import { useState } from 'react'
import { Project, Site, PROVIDERS, Provider, DIAStatus } from '@/lib/types'
import { updateSiteDIA } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Search, Radio, CheckCircle, Clock, AlertCircle } from 'lucide-react'

interface Props { project: Project; onUpdate: () => void }

export function SDWANEngineerView({ project, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Site | null>(null)

  const filtered = project.sites.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase())
  )

  function getDIASummary(site: Site) {
    let confirmed = 0, total = 0
    for (const p of PROVIDERS) {
      const d = site.dias[p]
      if (d && d.status !== 'not_requested') { total++ }
      if (d && (d.status === 'confirmed' || d.status === 'diverse_confirmed')) confirmed++
    }
    return { confirmed, total }
  }

  const readySites = project.sites.filter(s => {
    const { confirmed } = getDIASummary(s)
    return confirmed >= 2
  })

  return (
    <div className="flex gap-4">
      {/* List */}
      <div className="w-72 flex-shrink-0 space-y-3">
        <div className="grid grid-cols-2 gap-2 mb-1">
          <div className="bg-purple-950/40 border border-purple-800/50 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-purple-300">{readySites.length}</div>
            <div className="text-xs text-gray-400">Ready for SD-WAN</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-3 text-center">
            <div className="text-xl font-bold text-gray-300">{project.sites.length - readySites.length}</div>
            <div className="text-xs text-gray-400">Waiting circuits</div>
          </div>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..."
            className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 h-9" />
        </div>
        <div className="space-y-1 overflow-auto max-h-[calc(100vh-320px)]">
          {filtered.map(site => {
            const { confirmed, total } = getDIASummary(site)
            const ready = confirmed >= 2
            return (
              <button key={site.id} onClick={() => setSelected(site)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selected?.id === site.id ? 'border-purple-500/50 bg-purple-950/20' : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                }`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium text-white truncate">{site.name}</span>
                  {ready
                    ? <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />
                    : <Clock className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                  }
                </div>
                <div className="text-xs text-gray-500 mt-0.5">{site.city} · {confirmed}/{PROVIDERS.length} circuits</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5 overflow-auto">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-semibold text-white">{selected.name}</h3>
              <p className="text-sm text-gray-400">{selected.address}, {selected.city} - {selected.state}</p>
            </div>
            {(() => {
              const { confirmed } = getDIASummary(selected)
              return confirmed >= 2
                ? <Badge className="bg-green-900 text-green-300">Ready for SD-WAN</Badge>
                : <Badge className="bg-yellow-900 text-yellow-300">Awaiting circuits</Badge>
            })()}
          </div>

          <div>
            <p className="text-xs text-gray-400 font-medium mb-3">Circuit Configuration</p>
            <div className="space-y-4">
              {PROVIDERS.map(provider => {
                const dia = selected.dias[provider]
                return (
                  <div key={provider} className="bg-gray-800 rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Radio className="w-4 h-4 text-purple-400" />
                        <span className="text-sm font-medium text-white">{provider}</span>
                      </div>
                      <Select
                        value={dia?.status || 'not_requested'}
                        onValueChange={v => { if (v) { updateSiteDIA(project.id, selected.id, provider, { status: v as DIAStatus }); onUpdate() } }}>
                        <SelectTrigger className="h-6 text-xs bg-gray-700 border-gray-600 text-white w-44">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-gray-900 border-gray-700">
                          {(['not_requested','requested','received','confirmed','diverse_confirmed'] as DIAStatus[]).map(s => (
                            <SelectItem key={s} value={s} className="text-xs text-white">{s.replace(/_/g,' ')}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Circuit #</p>
                        <Input defaultValue={dia?.circuitNumber || ''} placeholder="—"
                          onBlur={e => { updateSiteDIA(project.id, selected.id, provider, { circuitNumber: e.target.value }); onUpdate() }}
                          className="h-7 text-xs bg-gray-700 border-gray-600 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Path A</p>
                        <Input defaultValue={dia?.pathA || ''} placeholder="Primary path"
                          onBlur={e => { updateSiteDIA(project.id, selected.id, provider, { pathA: e.target.value }); onUpdate() }}
                          className="h-7 text-xs bg-gray-700 border-gray-600 text-white" />
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">Path B</p>
                        <Input defaultValue={dia?.pathB || ''} placeholder="Diverse path"
                          onBlur={e => { updateSiteDIA(project.id, selected.id, provider, { pathB: e.target.value }); onUpdate() }}
                          className="h-7 text-xs bg-gray-700 border-gray-600 text-white" />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <div className="text-center">
            <Radio className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a site to configure circuits</p>
          </div>
        </div>
      )}
    </div>
  )
}
