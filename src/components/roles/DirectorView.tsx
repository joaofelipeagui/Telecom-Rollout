'use client'
import { Project, REGIONS, REGION_LABELS, REGION_COLORS, REGION_BAR_COLORS, getRegionForCountry, REFRESH_TYPES, REFRESH_TYPE_LABELS, REFRESH_TYPE_COLORS } from '@/lib/types'
import { getSiteStats } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { generateKMZ, downloadBlob } from '@/lib/kmz'
import { Download, TrendingUp, AlertTriangle, CheckCircle, Shield, Globe } from 'lucide-react'

interface Props { project: Project }

export function DirectorView({ project }: Props) {
  const stats = getSiteStats(project.sites)
  const progress = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0
  const diaProgress = stats.totalDIA ? Math.round((stats.confirmedDIA / stats.totalDIA) * 100) : 0

  const diversityTotal = project.sites.filter(s =>
    Object.values(s.dias).some(d => d.status === 'diverse_confirmed')
  ).length

  const zoneStats = REGIONS.map(region => {
    const sites = project.sites.filter(s => getRegionForCountry(s.country) === region)
    const completed  = sites.filter(s => s.status === 'completed').length
    const inProgress = sites.filter(s => s.status === 'in_progress').length
    const blocked    = sites.filter(s => s.status === 'blocked').length
    const pending    = sites.filter(s => s.status === 'pending').length
    const pct = sites.length ? Math.round((completed / sites.length) * 100) : 0
    const countries = Array.from(new Set(sites.map(s => s.country))).length
    return { region, total: sites.length, completed, inProgress, blocked, pending, pct, countries }
  }).filter(z => z.total > 0)

  const typeStats = REFRESH_TYPES.map(t => {
    const sites = project.sites.filter(s => s.refreshType === t)
    const completed = sites.filter(s => s.status === 'completed').length
    const blocked   = sites.filter(s => s.status === 'blocked').length
    return { t, total: sites.length, completed, blocked }
  }).filter(x => x.total > 0).sort((a, b) => b.total - a.total)

  async function handleKMZ() {
    const blob = await generateKMZ(project.sites, project.name)
    downloadBlob(blob, `${project.name.replace(/\s+/g, '_')}_all_sites.kmz`)
  }

  return (
    <div className="space-y-6">
      {/* Executive KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Overall Progress', value: `${progress}%`, icon: TrendingUp, color: 'text-blue-400', sub: `${stats.completed}/${stats.total} sites` },
          { label: 'DIA Confirmed',    value: `${diaProgress}%`, icon: CheckCircle, color: 'text-green-400', sub: `${stats.confirmedDIA} circuits` },
          { label: 'Diversity Assured',value: diversityTotal, icon: Shield, color: 'text-emerald-400', sub: 'sites with dual path' },
          { label: 'Blocked Sites',    value: stats.blocked, icon: AlertTriangle, color: 'text-red-400', sub: 'need attention' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-1">{label}</div>
            <div className="text-xs text-gray-600">{sub}</div>
          </div>
        ))}
      </div>

      {/* Zone breakdown — the main new section */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 bg-gray-900/80 border-b border-gray-800 flex items-center gap-2">
          <Globe className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-white">Rollout by Zone</h3>
          <span className="ml-auto text-xs text-gray-500">{zoneStats.length} active zones</span>
        </div>
        <div className="divide-y divide-gray-800/60">
          {zoneStats.map(({ region, total, completed, inProgress, blocked, pct, countries }) => {
            const badgeCls  = REGION_COLORS[region]
            const barColor  = REGION_BAR_COLORS[region]
            return (
              <div key={region} className="px-5 py-4">
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded border ${badgeCls}`}>{region}</span>
                  <span className="text-sm font-medium text-white">{REGION_LABELS[region]}</span>
                  <span className="ml-auto text-xs text-gray-500">{total} sites · {countries} {countries === 1 ? 'country' : 'countries'}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div className={`${barColor} h-2 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-white w-8 text-right">{pct}%</span>
                </div>
                <div className="flex gap-4 mt-2 text-xs">
                  <span className="text-green-400">{completed} completed</span>
                  <span className="text-blue-400">{inProgress} in progress</span>
                  {blocked > 0 && <span className="text-red-400 font-semibold">⚠ {blocked} blocked</span>}
                </div>
              </div>
            )
          })}
          {zoneStats.length === 0 && (
            <div className="px-5 py-8 text-center text-gray-500 text-sm">
              Add sites with country data to see zone breakdown.
            </div>
          )}
        </div>
      </div>

      {/* Refresh type breakdown */}
      {typeStats.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-5 py-3.5 bg-gray-900/80 border-b border-gray-800">
            <h3 className="text-sm font-semibold text-white">Rollout by Refresh Type</h3>
          </div>
          <div className="px-5 py-4 flex flex-wrap gap-3">
            {typeStats.map(({ t, total, completed, blocked }) => (
              <div key={t} className={`flex flex-col gap-1 px-3 py-2 rounded-lg border ${REFRESH_TYPE_COLORS[t]}`}>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold">{t}</span>
                  <span className="text-xs opacity-70 font-normal">{total} site{total !== 1 ? 's' : ''}</span>
                </div>
                <div className="text-xs opacity-60">{REFRESH_TYPE_LABELS[t]}</div>
                <div className="flex gap-2 text-xs mt-0.5">
                  {completed > 0 && <span className="text-green-400">{completed} done</span>}
                  {blocked   > 0 && <span className="text-red-400">⚠ {blocked}</span>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Site status breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Global Status Breakdown</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { label: 'Pending',     count: stats.pending,    color: 'text-gray-400' },
            { label: 'In Progress', count: stats.inProgress, color: 'text-blue-400' },
            { label: 'Completed',   count: stats.completed,  color: 'text-green-400' },
            { label: 'Blocked',     count: stats.blocked,    color: 'text-red-400' },
          ].map(({ label, count, color }) => (
            <div key={label}>
              <div className={`text-3xl font-bold ${color}`}>{count}</div>
              <div className="text-xs text-gray-400 mt-1">{label}</div>
              <div className="text-xs text-gray-600">{stats.total ? Math.round((count / stats.total) * 100) : 0}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <Button onClick={handleKMZ} variant="outline" className="border-gray-700 text-gray-300">
          <Download className="w-4 h-4 mr-2" />Export All KMZ
        </Button>
      </div>
    </div>
  )
}
