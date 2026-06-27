'use client'
import { useMemo } from 'react'
import { Project, Provider, DIA, PROVIDERS } from '@/lib/types'
import { TrendingUp, TrendingDown, Minus, Award, AlertTriangle, Clock, CheckCircle } from 'lucide-react'

interface ProviderStats {
  provider: Provider
  total: number           // all circuits (any status except not_requested)
  confirmed: number       // confirmed + diverse_confirmed
  overdue: number         // past SLA, not confirmed
  atRisk: number          // SLA within 14 days, not confirmed
  avgDaysToConfirm: number | null  // requestedAt → confirmedAt average
  onTimePct: number | null         // confirmed before slaDate / total with both dates
  openCircuits: number    // requested/received but not confirmed
  missingCircuitNum: number // confirmed but no circuit number
  score: number           // 0-100 composite
}

function computeScore(s: ProviderStats): number {
  if (s.total === 0) return 0
  const confirmRate = s.total > 0 ? (s.confirmed / s.total) * 50 : 0
  const onTime      = s.onTimePct != null ? (s.onTimePct / 100) * 30 : 15
  const overdueHit  = Math.max(0, 20 - s.overdue * 5)
  return Math.round(Math.min(100, confirmRate + onTime + overdueHit))
}

function scoreColor(score: number) {
  if (score >= 75) return { text: 'text-green-400', bg: 'bg-green-400', label: 'Good' }
  if (score >= 50) return { text: 'text-yellow-400', bg: 'bg-yellow-400', label: 'Fair' }
  return { text: 'text-red-400', bg: 'bg-red-400', label: 'Poor' }
}

interface Props { project: Project }

export function CarrierScorecard({ project }: Props) {
  const stats = useMemo<ProviderStats[]>(() => {
    const today = new Date()

    return PROVIDERS.map(provider => {
      const circuits: DIA[] = []
      for (const site of project.sites) {
        const dia = site.dias[provider]
        if (dia && dia.status !== 'not_requested') circuits.push(dia)
      }

      const total     = circuits.length
      const confirmed = circuits.filter(d => d.status === 'confirmed' || d.status === 'diverse_confirmed').length
      const open      = circuits.filter(d => d.status === 'requested' || d.status === 'received').length

      const overdue = circuits.filter(d => {
        if (d.status === 'confirmed' || d.status === 'diverse_confirmed') return false
        if (!d.slaDate) return false
        return new Date(d.slaDate) < today
      }).length

      const atRisk = circuits.filter(d => {
        if (d.status === 'confirmed' || d.status === 'diverse_confirmed') return false
        if (!d.slaDate) return false
        const days = Math.ceil((new Date(d.slaDate).getTime() - today.getTime()) / 86400000)
        return days >= 0 && days <= 14
      }).length

      // Avg days to confirm: requestedAt → confirmedAt
      const deliveryTimes = circuits
        .filter(d => d.requestedAt && d.confirmedAt)
        .map(d => Math.ceil((new Date(d.confirmedAt!).getTime() - new Date(d.requestedAt!).getTime()) / 86400000))
      const avgDaysToConfirm = deliveryTimes.length > 0
        ? Math.round(deliveryTimes.reduce((a, b) => a + b, 0) / deliveryTimes.length)
        : null

      // On-time %: of circuits with both slaDate + confirmedAt, how many confirmed before SLA
      const measurable = circuits.filter(d => d.slaDate && d.confirmedAt)
      const onTime = measurable.filter(d => new Date(d.confirmedAt!) <= new Date(d.slaDate!)).length
      const onTimePct = measurable.length > 0 ? Math.round((onTime / measurable.length) * 100) : null

      const missingCircuitNum = circuits.filter(d =>
        (d.status === 'confirmed' || d.status === 'diverse_confirmed') && !d.circuitNumber
      ).length

      const stats: ProviderStats = {
        provider, total, confirmed, overdue, atRisk, avgDaysToConfirm,
        onTimePct, openCircuits: open, missingCircuitNum, score: 0,
      }
      stats.score = computeScore(stats)
      return stats
    })
    .filter(s => s.total > 0)
    .sort((a, b) => b.score - a.score)
  }, [project])

  const best  = stats[0]
  const worst = stats[stats.length - 1]

  if (stats.length === 0) return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <Award className="w-10 h-10 text-gray-600 mb-3" />
      <p className="text-gray-400 font-medium mb-1">No carrier data yet</p>
      <p className="text-gray-500 text-sm">Add DIA circuits to sites to see carrier performance.</p>
    </div>
  )

  return (
    <div className="space-y-6">
      {/* Top summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card-glow bg-[#070d16] rounded-xl px-4 py-3">
          <div className="text-xs text-gray-400 mb-1">Total Circuits Tracked</div>
          <div className="text-2xl font-bold text-white">{stats.reduce((a, s) => a + s.total, 0)}</div>
          <div className="text-xs text-green-400 mt-1">{stats.reduce((a, s) => a + s.confirmed, 0)} confirmed</div>
        </div>
        <div className="card-glow bg-[#070d16] rounded-xl px-4 py-3">
          <div className="text-xs text-gray-400 mb-1">Overdue SLAs</div>
          <div className={`text-2xl font-bold ${stats.reduce((a, s) => a + s.overdue, 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {stats.reduce((a, s) => a + s.overdue, 0)}
          </div>
          <div className="text-xs text-yellow-400 mt-1">{stats.reduce((a, s) => a + s.atRisk, 0)} at risk ≤14d</div>
        </div>
        <div className="card-glow bg-[#070d16] rounded-xl px-4 py-3">
          <div className="text-xs text-gray-400 mb-1">Best Performer</div>
          {best ? (
            <>
              <div className="text-lg font-bold text-white">{best.provider}</div>
              <div className={`text-xs mt-1 ${scoreColor(best.score).text}`}>Score {best.score}/100</div>
            </>
          ) : <div className="text-gray-600">—</div>}
        </div>
      </div>

      {/* Scorecard table */}
      <div className="card-glow bg-[#070d16] rounded-xl overflow-hidden">
        {/* Header */}
        <div className="grid grid-cols-10 gap-2 px-4 py-2.5 bg-[#0a0f1a] border-b border-gray-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          <div className="col-span-2">Carrier</div>
          <div className="text-center">Score</div>
          <div className="text-center">Total</div>
          <div className="text-center">Confirmed</div>
          <div className="text-center">Open</div>
          <div className="text-center">Overdue</div>
          <div className="text-center">At Risk</div>
          <div className="text-center">Avg Delivery</div>
          <div className="text-center">On-Time %</div>
        </div>

        {stats.map((s, i) => {
          const sc = scoreColor(s.score)
          const isFirst = i === 0
          const isLast  = i === stats.length - 1 && stats.length > 1
          return (
            <div key={s.provider}
              className={`grid grid-cols-10 gap-2 px-4 py-3.5 border-b border-gray-800/50 last:border-0 transition-colors hover:bg-gray-800/20
                ${isFirst ? 'bg-green-950/10' : isLast ? 'bg-red-950/10' : ''}`}>

              {/* Carrier + rank badge */}
              <div className="col-span-2 flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${isFirst ? 'bg-green-900 text-green-300' : isLast ? 'bg-red-900/60 text-red-400' : 'bg-gray-800 text-gray-400'}`}>
                  {i + 1}
                </div>
                <div>
                  <div className="text-sm font-semibold text-white">{s.provider}</div>
                  {isFirst && <div className="text-xs text-green-400 flex items-center gap-1"><TrendingUp className="w-3 h-3" />Top performer</div>}
                  {isLast  && <div className="text-xs text-red-400 flex items-center gap-1"><TrendingDown className="w-3 h-3" />Needs attention</div>}
                </div>
              </div>

              {/* Score bar */}
              <div className="flex flex-col items-center justify-center gap-1">
                <div className="text-sm font-bold text-white">{s.score}</div>
                <div className="w-14 bg-gray-700 rounded-full h-1.5">
                  <div className={`h-1.5 rounded-full ${sc.bg}`} style={{ width: `${s.score}%` }} />
                </div>
                <div className={`text-xs ${sc.text}`}>{sc.label}</div>
              </div>

              <Cell value={s.total}     neutral />
              <Cell value={s.confirmed} color={s.confirmed === s.total ? 'green' : 'neutral'} />
              <Cell value={s.openCircuits} color={s.openCircuits > 0 ? 'yellow' : 'neutral'} />
              <Cell value={s.overdue}   color={s.overdue > 0 ? 'red' : 'neutral'} />
              <Cell value={s.atRisk}    color={s.atRisk > 0 ? 'orange' : 'neutral'} />

              {/* Avg delivery */}
              <div className="flex items-center justify-center">
                <span className="text-sm text-gray-300">
                  {s.avgDaysToConfirm != null ? `${s.avgDaysToConfirm}d` : <span className="text-gray-600">—</span>}
                </span>
              </div>

              {/* On-time % */}
              <div className="flex items-center justify-center">
                {s.onTimePct != null ? (
                  <span className={`text-sm font-semibold ${s.onTimePct >= 80 ? 'text-green-400' : s.onTimePct >= 50 ? 'text-yellow-400' : 'text-red-400'}`}>
                    {s.onTimePct}%
                  </span>
                ) : <span className="text-gray-600 text-sm">—</span>}
              </div>
            </div>
          )
        })}
      </div>

      {/* Missing circuit numbers warning */}
      {stats.some(s => s.missingCircuitNum > 0) && (
        <div className="flex items-start gap-3 bg-yellow-950/30 border border-yellow-800/40 rounded-xl px-4 py-3">
          <AlertTriangle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-xs font-semibold text-yellow-300 mb-1">Missing circuit numbers on confirmed circuits</p>
            {stats.filter(s => s.missingCircuitNum > 0).map(s => (
              <p key={s.provider} className="text-xs text-gray-400">
                <span className="text-white">{s.provider}</span>: {s.missingCircuitNum} circuit{s.missingCircuitNum > 1 ? 's' : ''} confirmed but no circuit number recorded
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Methodology note */}
      <p className="text-xs text-gray-600 text-center">
        Score = 50% confirmation rate + 30% on-time delivery + 20% SLA compliance · Requires requestedAt + confirmedAt dates for full accuracy
      </p>
    </div>
  )
}

function Cell({ value, color = 'neutral', neutral }: { value: number; color?: 'green'|'red'|'orange'|'yellow'|'neutral'; neutral?: boolean }) {
  const cls = neutral || color === 'neutral' ? 'text-gray-300'
    : color === 'green'  ? 'text-green-400'
    : color === 'red'    ? 'text-red-400'
    : color === 'orange' ? 'text-orange-400'
    : 'text-yellow-400'
  return (
    <div className="flex items-center justify-center">
      <span className={`text-sm font-semibold ${value === 0 ? 'text-gray-600' : cls}`}>{value}</span>
    </div>
  )
}
