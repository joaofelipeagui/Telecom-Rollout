'use client'
import { Project, PROVIDERS } from '@/lib/types'
import { getSiteStats } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { generateKMZ, downloadBlob } from '@/lib/kmz'
import { Download, TrendingUp, AlertTriangle, CheckCircle, Shield } from 'lucide-react'

interface Props { project: Project }

export function DirectorView({ project }: Props) {
  const stats = getSiteStats(project.sites)
  const progress = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0
  const diaProgress = stats.totalDIA ? Math.round((stats.confirmedDIA / stats.totalDIA) * 100) : 0

  const providerStats = PROVIDERS.map(p => {
    const total = project.sites.length
    const confirmed = project.sites.filter(s => {
      const d = s.dias[p]
      return d && (d.status === 'confirmed' || d.status === 'diverse_confirmed')
    }).length
    const diverse = project.sites.filter(s => s.dias[p]?.status === 'diverse_confirmed').length
    return { provider: p, confirmed, diverse, total }
  })

  const diversityTotal = project.sites.filter(s =>
    Object.values(s.dias).some(d => d.status === 'diverse_confirmed')
  ).length

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
          { label: 'DIA Confirmed', value: `${diaProgress}%`, icon: CheckCircle, color: 'text-green-400', sub: `${stats.confirmedDIA} circuits` },
          { label: 'Diversity Assured', value: diversityTotal, icon: Shield, color: 'text-emerald-400', sub: 'sites with dual path' },
          { label: 'Blocked Sites', value: stats.blocked, icon: AlertTriangle, color: 'text-red-400', sub: 'need attention' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4">
            <Icon className={`w-5 h-5 ${color} mb-2`} />
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-1">{label}</div>
            <div className="text-xs text-gray-600">{sub}</div>
          </div>
        ))}
      </div>

      {/* Progress bars */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Provider DIA Status</h3>
        <div className="space-y-3">
          {providerStats.map(({ provider, confirmed, diverse, total }) => {
            const pct = total ? Math.round((confirmed / total) * 100) : 0
            return (
              <div key={provider}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-300 font-medium">{provider}</span>
                  <span className="text-gray-400">{confirmed}/{total} confirmed · {diverse} diverse</span>
                </div>
                <div className="bg-gray-800 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Site status breakdown */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Site Status Breakdown</h3>
        <div className="grid grid-cols-4 gap-4 text-center">
          {[
            { label: 'Pending', count: stats.pending, color: 'text-gray-400' },
            { label: 'In Progress', count: stats.inProgress, color: 'text-blue-400' },
            { label: 'Completed', count: stats.completed, color: 'text-green-400' },
            { label: 'Blocked', count: stats.blocked, color: 'text-red-400' },
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
          <Download className="w-4 h-4 mr-2" />
          Export All KMZ
        </Button>
      </div>
    </div>
  )
}
