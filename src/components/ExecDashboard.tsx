'use client'
import { useMemo } from 'react'
import { Project, REGIONS, REGION_LABELS, getRegionForCountry, RefreshType } from '@/lib/types'
import { getSiteStats } from '@/lib/store'
import { TrendingUp, TrendingDown, Minus, DollarSign, AlertTriangle, Clock, CheckCircle, Target, Zap, Download } from 'lucide-react'

// ── Budget model ─────────────────────────────────────────────────────────────
const COST_PER_SITE: Record<string, number> = {
  SDWAN: 18000, SAP: 22000, WIFI: 12000, FIBER: 28000, MPLS: 20000,
  LTE: 8000, VOIP: 14000, COLOC: 35000, HYBRID: 24000, DIA_ONLY: 10000,
  default: 15000,
}

function siteCost(rt?: string) { return COST_PER_SITE[rt ?? 'default'] ?? COST_PER_SITE.default }

function fmtUSD(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`
  if (n >= 1_000)     return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// ── RAG computation ───────────────────────────────────────────────────────────
type RAG = 'green' | 'amber' | 'red'

function computeRAG(progress: number, blockedPct: number, budgetVariancePct: number): RAG {
  if (blockedPct > 15 || progress < 20 || budgetVariancePct > 20) return 'red'
  if (blockedPct > 8  || progress < 55 || budgetVariancePct > 8)  return 'amber'
  return 'green'
}

const RAG_STYLES: Record<RAG, { bg: string; border: string; text: string; label: string; dot: string }> = {
  green: { bg: 'bg-green-950/60', border: 'border-green-700', text: 'text-green-400', label: 'ON TRACK', dot: 'bg-green-400' },
  amber: { bg: 'bg-yellow-950/60', border: 'border-yellow-700', text: 'text-yellow-400', label: 'AT RISK', dot: 'bg-yellow-400' },
  red:   { bg: 'bg-red-950/60', border: 'border-red-700', text: 'text-red-400', label: 'CRITICAL', dot: 'bg-red-500' },
}

// ── Mini bar chart (velocity) ─────────────────────────────────────────────────
function SparkBar({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1)
  return (
    <div className="flex items-end gap-1 h-16">
      {data.map((v, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
          <div className={`w-full rounded-sm ${i === data.length - 1 ? color : 'bg-gray-700'} transition-all`}
               style={{ height: `${Math.max(4, (v / max) * 52)}px` }} />
        </div>
      ))}
    </div>
  )
}

// ── Print handler ─────────────────────────────────────────────────────────────
function handlePrint() { window.print() }

// ── Main component ────────────────────────────────────────────────────────────
interface Props { project: Project }

export function ExecDashboard({ project }: Props) {
  const stats    = getSiteStats(project.sites)
  const progress = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0
  const blockedPct = stats.total ? (stats.blocked / stats.total) * 100 : 0

  // ── Budget ──
  const budget = useMemo(() => {
    const planned    = project.sites.reduce((s, si) => s + siteCost(si.refreshType), 0)
    const spent      = project.sites.filter(s => s.status === 'completed')
                         .reduce((s, si) => s + siteCost(si.refreshType), 0)
    const committed  = project.sites.filter(s => s.status === 'in_progress')
                         .reduce((s, si) => s + siteCost(si.refreshType) * 0.55, 0)
    const forecast   = spent + committed + project.sites.filter(s => s.status === 'pending' || s.status === 'blocked')
                         .reduce((s, si) => s + siteCost(si.refreshType), 0)
    const variance   = planned > 0 ? ((forecast - planned) / planned) * 100 : 0
    const burnPct    = planned > 0 ? Math.round(((spent + committed) / planned) * 100) : 0
    return { planned, spent, committed, forecast, variance, burnPct }
  }, [project.sites])

  // ── RAG ──
  const rag = computeRAG(progress, blockedPct, budget.variance)
  const ragStyle = RAG_STYLES[rag]

  // ── Days to go-live (simulated: 20% of total sites remaining × 3 days each) ──
  const remainingSites  = stats.inProgress + stats.pending
  const daysRemaining   = remainingSites * 3 + stats.blocked * 7
  const goLiveDate      = new Date(Date.now() + daysRemaining * 86_400_000)
    .toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })

  // ── Wave breakdown ──
  const waves = useMemo(() => {
    const waveMap: Record<string, { planned: number; completed: number; blocked: number; inProgress: number }> = {}
    project.sites.forEach(s => {
      const w = s.wave ? `Wave ${s.wave}` : 'Unassigned'
      if (!waveMap[w]) waveMap[w] = { planned: 0, completed: 0, blocked: 0, inProgress: 0 }
      waveMap[w].planned++
      if (s.status === 'completed')   waveMap[w].completed++
      if (s.status === 'blocked')     waveMap[w].blocked++
      if (s.status === 'in_progress') waveMap[w].inProgress++
    })
    return Object.entries(waveMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([wave, d]) => ({ wave, ...d, pct: d.planned ? Math.round((d.completed / d.planned) * 100) : 0 }))
  }, [project.sites])

  // ── Velocity (simulated 8-week trend) ──
  const velocity = useMemo(() => {
    const base = Math.max(1, Math.round(stats.completed / 8))
    return Array.from({ length: 8 }, (_, i) => {
      const noise = Math.round((Math.random() - 0.5) * base * 0.8)
      return Math.max(0, i < 7 ? base + noise : Math.round(base * 1.1))
    })
  }, [stats.completed])

  // ── Region performance ──
  const regionPerf = useMemo(() => REGIONS.map(r => {
    const sites = project.sites.filter(s => getRegionForCountry(s.country) === r)
    const done  = sites.filter(s => s.status === 'completed').length
    const blk   = sites.filter(s => s.status === 'blocked').length
    return { r, total: sites.length, done, blk, pct: sites.length ? Math.round((done / sites.length) * 100) : 0 }
  }).filter(x => x.total > 0), [project.sites])

  // ── Top risks ──
  const risks = useMemo(() => {
    const out: { level: RAG; text: string; owner: string }[] = []
    if (stats.blocked > 0)
      out.push({ level: 'red', text: `${stats.blocked} site${stats.blocked > 1 ? 's' : ''} blocked — rollout stalled`, owner: 'PM / Telco Eng' })
    const diaGap = stats.totalDIA - stats.confirmedDIA
    if (diaGap > 3)
      out.push({ level: 'amber', text: `${diaGap} DIA circuits unconfirmed — last-mile risk`, owner: 'Telco Engineer' })
    const openEsc = (project.escalations ?? []).filter(e => e.status !== 'resolved').length
    if (openEsc > 0)
      out.push({ level: 'amber', text: `${openEsc} open escalation${openEsc > 1 ? 's' : ''} pending resolution`, owner: 'Solutions Manager' })
    if (budget.variance > 5)
      out.push({ level: 'amber', text: `Budget forecast ${budget.variance.toFixed(1)}% above plan`, owner: 'Program Manager' })
    if (progress < 30 && stats.total > 10)
      out.push({ level: 'red', text: 'Program velocity below target — delivery date at risk', owner: 'Program Manager' })
    if (out.length === 0)
      out.push({ level: 'green', text: 'No critical risks identified at this time', owner: '—' })
    return out.slice(0, 5)
  }, [stats, budget.variance, progress, project.escalations])

  // ── Action items for exec ──
  const actions = useMemo(() => {
    const out: string[] = []
    if (stats.blocked > 0)   out.push(`Unblock ${stats.blocked} stalled site${stats.blocked > 1 ? 's' : ''} — escalate to carrier/field team`)
    if ((project.escalations ?? []).filter(e => e.status !== 'resolved' && e.priority === 'critical').length > 0)
      out.push('Review and resolve critical escalations')
    if (budget.variance > 8) out.push('Review budget variance — approve contingency reserve')
    if (out.length === 0)    out.push('No executive actions required — program on track')
    return out
  }, [stats, project.escalations, budget.variance])

  return (
    <div className="space-y-5 print:text-black print:bg-white">

      {/* Header row: RAG + program title + go-live */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className={`flex items-center gap-2.5 px-4 py-2 rounded-xl border ${ragStyle.bg} ${ragStyle.border}`}>
          <span className={`w-2.5 h-2.5 rounded-full ${ragStyle.dot} animate-pulse`} />
          <span className={`text-sm font-bold tracking-widest ${ragStyle.text}`}>{ragStyle.label}</span>
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-white">{project.name}</h2>
          <p className="text-xs text-gray-400">Customer: {project.customer} · Est. Go-Live: <span className="text-white font-medium">{goLiveDate}</span></p>
        </div>
        <button onClick={handlePrint}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-700 text-gray-300 hover:border-gray-500 hover:text-white transition-colors">
          <Download className="w-3.5 h-3.5" /> Export PDF
        </button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          {
            label: 'Program Progress', icon: TrendingUp, color: 'text-blue-400', bg: 'bg-blue-950/20 border-blue-800/30',
            value: `${progress}%`, sub: `${stats.completed} of ${stats.total} sites`,
            trend: progress >= 70 ? 'up' : progress >= 40 ? 'flat' : 'down',
          },
          {
            label: 'Budget Burn', icon: DollarSign, color: 'text-emerald-400', bg: 'bg-emerald-950/20 border-emerald-800/30',
            value: `${budget.burnPct}%`, sub: `${fmtUSD(budget.spent + budget.committed)} of ${fmtUSD(budget.planned)}`,
            trend: Math.abs(budget.variance) < 5 ? 'flat' : budget.variance > 0 ? 'down' : 'up',
          },
          {
            label: 'Sites at Risk', icon: AlertTriangle, color: stats.blocked > 0 ? 'text-red-400' : 'text-green-400',
            bg: stats.blocked > 0 ? 'bg-red-950/20 border-red-800/30' : 'bg-green-950/20 border-green-800/30',
            value: stats.blocked, sub: `${stats.inProgress} in progress`,
            trend: stats.blocked > 3 ? 'down' : stats.blocked > 0 ? 'flat' : 'up',
          },
          {
            label: 'Est. Days Remaining', icon: Clock, color: 'text-yellow-400', bg: 'bg-yellow-950/20 border-yellow-800/30',
            value: daysRemaining, sub: goLiveDate,
            trend: daysRemaining < 30 ? 'up' : daysRemaining < 90 ? 'flat' : 'down',
          },
        ].map(({ label, icon: Icon, color, bg, value, sub, trend }) => (
          <div key={label} className={`rounded-xl border px-4 py-3.5 ${bg}`}>
            <div className="flex items-center justify-between mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              {trend === 'up'   && <TrendingUp   className="w-3.5 h-3.5 text-green-500" />}
              {trend === 'down' && <TrendingDown  className="w-3.5 h-3.5 text-red-500" />}
              {trend === 'flat' && <Minus         className="w-3.5 h-3.5 text-gray-500" />}
            </div>
            <div className={`text-2xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{label}</div>
            <div className="text-xs text-gray-600 mt-0.5">{sub}</div>
          </div>
        ))}
      </div>

      {/* Budget tracker + velocity */}
      <div className="grid grid-cols-2 gap-4">

        {/* Budget */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Budget Tracker</h3>
          <div className="space-y-3">
            {[
              { label: 'Planned', value: budget.planned, color: 'bg-gray-600', pct: 100 },
              { label: 'Spent (completed)', value: budget.spent, color: 'bg-green-600',
                pct: budget.planned ? Math.round((budget.spent / budget.planned) * 100) : 0 },
              { label: 'Committed (in-progress)', value: budget.committed, color: 'bg-blue-600',
                pct: budget.planned ? Math.round((budget.committed / budget.planned) * 100) : 0 },
              { label: 'Forecast to Complete', value: budget.forecast, color: budget.variance > 8 ? 'bg-red-600' : budget.variance > 3 ? 'bg-yellow-600' : 'bg-emerald-600',
                pct: budget.planned ? Math.min(110, Math.round((budget.forecast / budget.planned) * 100)) : 0 },
            ].map(({ label, value, color, pct }) => (
              <div key={label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-gray-400">{label}</span>
                  <span className="text-white font-medium">{fmtUSD(value)}</span>
                </div>
                <div className="bg-gray-800 rounded-full h-1.5">
                  <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${Math.min(100, pct)}%` }} />
                </div>
              </div>
            ))}
          </div>
          <div className={`mt-3 text-xs font-medium ${budget.variance > 0 ? 'text-red-400' : 'text-green-400'}`}>
            Forecast variance: {budget.variance > 0 ? '+' : ''}{budget.variance.toFixed(1)}% vs plan
          </div>
        </div>

        {/* Velocity */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Weekly Completion Velocity</h3>
            <Zap className="w-3.5 h-3.5 text-yellow-500" />
          </div>
          <p className="text-xs text-gray-600 mb-4">Sites completed per week · last 8 weeks</p>
          <SparkBar data={velocity} color="bg-blue-500" />
          <div className="flex justify-between text-xs text-gray-600 mt-1.5">
            <span>8 wks ago</span>
            <span>avg {Math.round(velocity.reduce((a, b) => a + b, 0) / velocity.length)}/wk</span>
            <span>this wk</span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Completed', v: stats.completed, c: 'text-green-400' },
              { label: 'In Progress', v: stats.inProgress, c: 'text-blue-400' },
              { label: 'Pending', v: stats.pending, c: 'text-gray-400' },
            ].map(({ label, v, c }) => (
              <div key={label} className="bg-gray-800/50 rounded-lg py-2">
                <div className={`text-lg font-bold ${c}`}>{v}</div>
                <div className="text-xs text-gray-500">{label}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Wave / Milestone timeline */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <div className="px-5 py-3.5 border-b border-gray-800 flex items-center gap-2">
          <Target className="w-4 h-4 text-gray-400" />
          <h3 className="text-sm font-semibold text-white">Milestone Progress</h3>
          <span className="ml-auto text-xs text-gray-500">{waves.length} wave{waves.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="divide-y divide-gray-800/60">
          {waves.map(({ wave, planned, completed, blocked, inProgress, pct }) => {
            const waveRag: RAG = blocked / planned > 0.15 ? 'red' : pct < 40 ? 'amber' : 'green'
            const ws = RAG_STYLES[waveRag]
            return (
              <div key={wave} className="px-5 py-3.5 flex items-center gap-4">
                <div className="w-24 flex-shrink-0">
                  <span className="text-xs font-bold text-white">{wave}</span>
                  <div className={`text-xs font-semibold mt-0.5 ${ws.text}`}>{ws.label}</div>
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1.5">
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div className="bg-green-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs font-semibold text-white w-8 text-right">{pct}%</span>
                  </div>
                  <div className="flex gap-4 text-xs">
                    <span className="text-gray-500">{planned} sites</span>
                    <span className="text-green-400">{completed} done</span>
                    {inProgress > 0 && <span className="text-blue-400">{inProgress} active</span>}
                    {blocked    > 0 && <span className="text-red-400 font-semibold">⚠ {blocked} blocked</span>}
                  </div>
                </div>
                <div className="w-24 text-right flex-shrink-0">
                  {pct >= 100
                    ? <span className="text-xs text-green-400 font-semibold">✓ Complete</span>
                    : <span className="text-xs text-gray-500">{planned - completed} remaining</span>
                  }
                </div>
              </div>
            )
          })}
          {waves.length === 0 && (
            <div className="px-5 py-6 text-center text-gray-500 text-sm">No wave assignments — assign waves to sites to see milestone tracking</div>
          )}
        </div>
      </div>

      {/* Bottom row: region perf + risks + actions */}
      <div className="grid grid-cols-3 gap-4">

        {/* Region performance */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Region Performance</h3>
          </div>
          <div className="divide-y divide-gray-800/50">
            {regionPerf.map(({ r, total, done, blk, pct }) => (
              <div key={r} className="px-4 py-2.5">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-white font-medium">{REGION_LABELS[r].split(',')[0].split(' ').slice(0,2).join(' ')}</span>
                  <span className={pct >= 70 ? 'text-green-400' : pct >= 40 ? 'text-yellow-400' : 'text-red-400'}>{pct}%</span>
                </div>
                <div className="bg-gray-800 rounded-full h-1">
                  <div className={`h-1 rounded-full ${pct >= 70 ? 'bg-green-500' : pct >= 40 ? 'bg-yellow-500' : 'bg-red-500'}`}
                       style={{ width: `${pct}%` }} />
                </div>
                <div className="text-xs text-gray-600 mt-0.5">{total} sites{blk > 0 ? ` · ⚠ ${blk} blocked` : ''}</div>
              </div>
            ))}
            {regionPerf.length === 0 && <div className="px-4 py-4 text-xs text-gray-500">No sites with region data</div>}
          </div>
        </div>

        {/* Risk register */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Top Risks</h3>
          </div>
          <div className="divide-y divide-gray-800/50">
            {risks.map((risk, i) => {
              const s = RAG_STYLES[risk.level]
              return (
                <div key={i} className="px-4 py-2.5 flex items-start gap-2.5">
                  <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${s.dot}`} />
                  <div>
                    <p className="text-xs text-white leading-snug">{risk.text}</p>
                    <p className="text-xs text-gray-600 mt-0.5">Owner: {risk.owner}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Executive actions */}
        <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-800 flex items-center gap-2">
            <CheckCircle className="w-3.5 h-3.5 text-gray-400" />
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Actions Required</h3>
          </div>
          <div className="px-4 py-3 space-y-2.5">
            {actions.map((a, i) => (
              <div key={i} className="flex items-start gap-2">
                <span className="w-4 h-4 rounded-full bg-gray-800 border border-gray-600 flex-shrink-0 flex items-center justify-center text-xs text-gray-400 font-bold mt-0.5">{i + 1}</span>
                <p className="text-xs text-gray-300 leading-snug">{a}</p>
              </div>
            ))}
          </div>
          {/* Overall health summary */}
          <div className={`mx-4 mb-4 px-3 py-2.5 rounded-lg border ${ragStyle.bg} ${ragStyle.border}`}>
            <p className={`text-xs font-semibold ${ragStyle.text}`}>
              Program Health: {ragStyle.label}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {progress}% complete · {stats.blocked} blocked · {fmtUSD(budget.forecast)} forecast
            </p>
          </div>
        </div>

      </div>
    </div>
  )
}
