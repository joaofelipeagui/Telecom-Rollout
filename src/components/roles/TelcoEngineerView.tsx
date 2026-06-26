'use client'
import { useState } from 'react'
import { Project, Site, PROVIDERS, Provider, DIAStatus } from '@/lib/types'
import { updateSiteDIA } from '@/lib/store'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { Search, Shield, AlertTriangle, CheckCircle } from 'lucide-react'

const DIA_STATUS_LABELS: Record<DIAStatus, string> = {
  not_requested: 'Not Requested',
  requested: 'Requested',
  received: 'Received',
  confirmed: 'Confirmed',
  diverse_confirmed: 'Diversity Confirmed',
}

interface Props { project: Project; onUpdate: () => void }

export function TelcoEngineerView({ project, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [filterProvider, setFilterProvider] = useState<string>('all')
  const [filterStatus, setFilterStatus] = useState<string>('all')

  const filtered = project.sites.filter(site => {
    const matchSearch = !search || site.name.toLowerCase().includes(search.toLowerCase()) || site.city.toLowerCase().includes(search.toLowerCase())
    return matchSearch
  })

  // For each site+provider combo where work is needed
  type Row = { site: Site; provider: Provider; status: DIAStatus; circuitNumber?: string }
  const rows: Row[] = []
  for (const site of filtered) {
    for (const provider of PROVIDERS) {
      if (filterProvider !== 'all' && filterProvider !== provider) continue
      const dia = site.dias[provider]
      const status: DIAStatus = dia?.status || 'not_requested'
      if (filterStatus !== 'all' && filterStatus !== status) continue
      rows.push({ site, provider, status, circuitNumber: dia?.circuitNumber })
    }
  }

  const diversityConfirmed = project.sites.filter(s =>
    Object.values(s.dias).some(d => d.status === 'diverse_confirmed')
  ).length

  const pendingDiversity = project.sites.filter(s =>
    Object.values(s.dias).some(d => d.status === 'confirmed') &&
    !Object.values(s.dias).some(d => d.status === 'diverse_confirmed')
  ).length

  return (
    <div className="space-y-5">
      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Diversity Confirmed', value: diversityConfirmed, icon: Shield, color: 'text-emerald-400' },
          { label: 'Pending Diversity', value: pendingDiversity, icon: AlertTriangle, color: 'text-yellow-400' },
          { label: 'Total Sites', value: project.sites.length, icon: CheckCircle, color: 'text-blue-400' },
        ].map(({ label, value, icon: Icon, color }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Icon className="w-3.5 h-3.5" />{label}
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..."
            className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500" />
        </div>
        <Select value={filterProvider} onValueChange={v => v && setFilterProvider(v)}>
          <SelectTrigger className="w-36 bg-gray-900 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            <SelectItem value="all" className="text-white">All providers</SelectItem>
            {PROVIDERS.map(p => <SelectItem key={p} value={p} className="text-white">{p}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={v => v && setFilterStatus(v)}>
          <SelectTrigger className="w-44 bg-gray-900 border-gray-700 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent className="bg-gray-900 border-gray-700">
            <SelectItem value="all" className="text-white">All statuses</SelectItem>
            {Object.entries(DIA_STATUS_LABELS).map(([k, v]) =>
              <SelectItem key={k} value={k} className="text-white">{v}</SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="overflow-auto">
        <div className="text-xs text-gray-500 mb-2">{rows.length} records</div>
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              {['Site', 'City', 'Provider', 'Status', 'Circuit #', 'Path A', 'Path B', 'Diversity'].map(h => (
                <th key={h} className="text-left py-2 px-3 text-gray-400 font-medium text-xs">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ site, provider, status, circuitNumber }, i) => {
              const dia = site.dias[provider]
              return (
                <tr key={`${site.id}-${provider}`} className="border-b border-gray-800/50 hover:bg-gray-900/50">
                  <td className="py-2 px-3 text-white text-xs font-medium">{site.name}</td>
                  <td className="py-2 px-3 text-gray-400 text-xs">{site.city}</td>
                  <td className="py-2 px-3">
                    <span className="text-xs font-medium text-cyan-400">{provider}</span>
                  </td>
                  <td className="py-2 px-3">
                    <Select value={status}
                      onValueChange={v => { if (v) { updateSiteDIA(project.id, site.id, provider, { status: v as DIAStatus }); onUpdate() } }}>
                      <SelectTrigger className="h-6 text-xs bg-gray-800 border-gray-700 text-white w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-gray-900 border-gray-700">
                        {Object.entries(DIA_STATUS_LABELS).map(([k, v]) =>
                          <SelectItem key={k} value={k} className="text-xs text-white">{v}</SelectItem>
                        )}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="py-1 px-3">
                    <Input defaultValue={circuitNumber || ''} placeholder="—"
                      onBlur={e => { updateSiteDIA(project.id, site.id, provider, { circuitNumber: e.target.value }); onUpdate() }}
                      className="h-6 text-xs bg-gray-800 border-gray-700 text-white w-28" />
                  </td>
                  <td className="py-1 px-3">
                    <Input defaultValue={dia?.pathA || ''} placeholder="Path A"
                      onBlur={e => { updateSiteDIA(project.id, site.id, provider, { pathA: e.target.value }); onUpdate() }}
                      className="h-6 text-xs bg-gray-800 border-gray-700 text-white w-28" />
                  </td>
                  <td className="py-1 px-3">
                    <Input defaultValue={dia?.pathB || ''} placeholder="Path B"
                      onBlur={e => { updateSiteDIA(project.id, site.id, provider, { pathB: e.target.value }); onUpdate() }}
                      className="h-6 text-xs bg-gray-800 border-gray-700 text-white w-28" />
                  </td>
                  <td className="py-2 px-3 text-center">
                    {status === 'diverse_confirmed'
                      ? <Shield className="w-4 h-4 text-emerald-400 mx-auto" />
                      : <span className="text-gray-600 text-xs">—</span>}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
