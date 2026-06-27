'use client'
import { useMemo } from 'react'
import { Project, Provider, DIA } from '@/lib/types'
import { AlertTriangle, Clock, CheckCircle, AlertCircle, Zap } from 'lucide-react'

interface AlertRow {
  siteId: string
  siteName: string
  siteCountry: string
  provider: Provider
  dia: DIA
  daysLeft: number
  slaDate: Date
}

type Bucket = 'overdue' | 'critical' | 'at_risk' | 'watch'

function getBucket(daysLeft: number): Bucket {
  if (daysLeft < 0)  return 'overdue'
  if (daysLeft <= 7) return 'critical'
  if (daysLeft <= 14) return 'at_risk'
  return 'watch'
}

const BUCKET_STYLE: Record<Bucket, { label: string; bg: string; border: string; text: string; icon: React.ElementType; badge: string }> = {
  overdue:  { label: 'Overdue',         bg: 'bg-red-950/40',    border: 'border-red-800/40',    text: 'text-red-400',    icon: AlertCircle,   badge: 'bg-red-600' },
  critical: { label: 'Critical — ≤7d',  bg: 'bg-orange-950/40', border: 'border-orange-800/40', text: 'text-orange-400', icon: AlertTriangle, badge: 'bg-orange-600' },
  at_risk:  { label: 'At Risk — ≤14d',  bg: 'bg-yellow-950/40', border: 'border-yellow-800/40', text: 'text-yellow-400', icon: Clock,         badge: 'bg-yellow-600' },
  watch:    { label: 'Watch — ≤30d',    bg: 'bg-blue-950/30',   border: 'border-blue-800/30',   text: 'text-blue-400',   icon: Zap,           badge: 'bg-blue-600' },
}

const STATUS_LABEL: Record<string, string> = {
  not_requested:    'Not Requested',
  requested:        'Requested',
  received:         'Received',
  confirmed:        'Confirmed',
  diverse_confirmed: 'Diversity ✓',
}

interface Props { project: Project }

export function SLAAlerts({ project }: Props) {
  const today = useMemo(() => new Date(), [])

  const alerts = useMemo<AlertRow[]>(() => {
    const rows: AlertRow[] = []
    for (const site of project.sites) {
      for (const [prov, dia] of Object.entries(site.dias) as [Provider, DIA][]) {
        if (!dia?.slaDate) continue
        if (dia.status === 'confirmed' || dia.status === 'diverse_confirmed') continue
        const slaDate = new Date(dia.slaDate)
        const daysLeft = Math.ceil((slaDate.getTime() - today.getTime()) / 86400000)
        if (daysLeft > 30) continue  // only show ≤30 days
        rows.push({ siteId: site.id, siteName: site.name, siteCountry: site.country, provider: prov, dia, daysLeft, slaDate })
      }
    }
    return rows.sort((a, b) => a.daysLeft - b.daysLeft)
  }, [project, today])

  const buckets: Record<Bucket, AlertRow[]> = {
    overdue:  alerts.filter(a => getBucket(a.daysLeft) === 'overdue'),
    critical: alerts.filter(a => getBucket(a.daysLeft) === 'critical'),
    at_risk:  alerts.filter(a => getBucket(a.daysLeft) === 'at_risk'),
    watch:    alerts.filter(a => getBucket(a.daysLeft) === 'watch'),
  }

  const urgent = buckets.overdue.length + buckets.critical.length

  // All circuits with SLA dates (for coverage summary)
  const allSLACircuits = useMemo(() => {
    let total = 0, withDate = 0
    for (const site of project.sites)
      for (const dia of Object.values(site.dias) as DIA[]) {
        if (dia && dia.status !== 'not_requested') {
          total++
          if (dia.slaDate) withDate++
        }
      }
    return { total, withDate }
  }, [project])

  return (
    <div className="space-y-6">
      {/* Summary bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {(['overdue', 'critical', 'at_risk', 'watch'] as Bucket[]).map(b => {
          const { label, bg, border, text, icon: Icon, badge } = BUCKET_STYLE[b]
          const count = buckets[b].length
          return (
            <div key={b} className={`rounded-xl border px-4 py-3 ${bg} ${border}`}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className={`w-4 h-4 ${text}`} />
                <span className={`text-xs font-semibold ${text}`}>{label}</span>
              </div>
              <div className={`text-2xl font-bold ${count > 0 ? text : 'text-gray-600'}`}>{count}</div>
              <div className="text-xs text-gray-500 mt-0.5">circuits</div>
            </div>
          )
        })}
      </div>

      {/* SLA coverage note */}
      <div className="flex items-center gap-3 bg-gray-900/50 border border-gray-800 rounded-xl px-4 py-3">
        <CheckCircle className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <p className="text-xs text-gray-400">
          <span className="text-white font-semibold">{allSLACircuits.withDate}</span> of{' '}
          <span className="text-white font-semibold">{allSLACircuits.total}</span> ordered circuits have an SLA date set.
          {allSLACircuits.total - allSLACircuits.withDate > 0 && (
            <span className="text-yellow-400 ml-1">
              → {allSLACircuits.total - allSLACircuits.withDate} circuits missing SLA date — update in the DIA panel.
            </span>
          )}
        </p>
      </div>

      {/* No alerts */}
      {alerts.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <CheckCircle className="w-10 h-10 text-green-500 mb-3" />
          <p className="text-white font-semibold mb-1">No SLA breaches in the next 30 days</p>
          <p className="text-gray-500 text-sm">All tracked circuits are within their SLA windows.</p>
        </div>
      )}

      {/* Buckets */}
      {(['overdue', 'critical', 'at_risk', 'watch'] as Bucket[]).map(b => {
        const rows = buckets[b]
        if (rows.length === 0) return null
        const { label, bg, border, text, icon: Icon } = BUCKET_STYLE[b]
        return (
          <div key={b}>
            <div className="flex items-center gap-2 mb-2">
              <Icon className={`w-4 h-4 ${text}`} />
              <span className={`text-xs font-bold uppercase tracking-wider ${text}`}>{label}</span>
              <span className={`text-xs ${text} opacity-60`}>({rows.length})</span>
            </div>
            <div className="space-y-2">
              {rows.map((row, i) => {
                const absDay = Math.abs(row.daysLeft)
                const dayLabel = row.daysLeft < 0
                  ? `${absDay}d overdue`
                  : row.daysLeft === 0 ? 'Due TODAY'
                  : `${row.daysLeft}d left`

                return (
                  <div key={`${row.siteId}-${row.provider}-${i}`}
                    className={`flex items-center gap-4 px-4 py-3 rounded-xl border ${bg} ${border}`}>
                    <div className={`text-xs font-bold w-20 text-right flex-shrink-0 ${text}`}>
                      {dayLabel}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-white truncate">{row.siteName}</div>
                      <div className="text-xs text-gray-400">{row.siteCountry}</div>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                      <span className="font-semibold text-white">{row.provider}</span>
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-400">{STATUS_LABEL[row.dia.status]}</span>
                      {row.dia.circuitNumber && (
                        <>
                          <span className="text-gray-500">|</span>
                          <span className="text-gray-400 font-mono">{row.dia.circuitNumber}</span>
                        </>
                      )}
                      <span className="text-gray-500">|</span>
                      <span className="text-gray-400">
                        SLA {row.slaDate.toLocaleDateString('en-GB', { day:'2-digit', month:'short', year:'numeric' })}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function getSLAAlertCount(project: Project): number {
  const today = new Date()
  let count = 0
  for (const site of project.sites)
    for (const dia of Object.values(site.dias) as DIA[]) {
      if (!dia?.slaDate) continue
      if (dia.status === 'confirmed' || dia.status === 'diverse_confirmed') continue
      const daysLeft = Math.ceil((new Date(dia.slaDate).getTime() - today.getTime()) / 86400000)
      if (daysLeft <= 7) count++
    }
  return count
}
