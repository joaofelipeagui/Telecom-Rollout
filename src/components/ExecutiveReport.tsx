'use client'
import { useState, useMemo } from 'react'
import { Project, Site, Wave, WaveConfig } from '@/lib/types'
import { saveProject } from '@/lib/store'
import { isSiteDIAReady, isSiteLogisticsReady } from '@/lib/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Globe, AlertTriangle, CheckCircle, Clock, Zap, Wifi,
  Package, TrendingDown, Calendar, ChevronDown, ChevronRight,
  Flag, Activity, FileText, Download
} from 'lucide-react'
import { generateExecutivePDF } from '@/lib/pdf'

interface Props {
  project: Project
  onUpdate: () => void
}

// ── helpers ──────────────────────────────────────────────────────────────────

function daysUntil(dateStr: string): number {
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

function completionPct(sites: Site[]) {
  if (!sites.length) return 0
  return Math.round((sites.filter(s => s.status === 'completed').length / sites.length) * 100)
}

type RiskLevel = 'low' | 'medium' | 'high' | 'critical'
interface Risk {
  id: string
  title: string
  description: string
  probability: RiskLevel
  impact: RiskLevel
  category: 'schedule' | 'dia' | 'logistics' | 'country' | 'provider'
}

const RISK_SCORE: Record<RiskLevel, number> = { low: 1, medium: 2, high: 3, critical: 4 }
const RISK_LABEL: Record<RiskLevel, string> = { low: 'Low', medium: 'Medium', high: 'High', critical: 'Critical' }
const RISK_COLOR: Record<RiskLevel, string> = {
  low: 'bg-green-500/20 text-green-300 border-green-500/30',
  medium: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  high: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
  critical: 'bg-red-500/20 text-red-300 border-red-500/30',
}
const RISK_CELL_COLOR: Record<number, string> = {
  1: 'bg-green-900/40 border-green-700/30',
  2: 'bg-yellow-900/40 border-yellow-700/30',
  3: 'bg-orange-900/40 border-orange-700/30',
  4: 'bg-red-900/40 border-red-700/30',
}

function deriveRisks(project: Project, waves: WaveConfig[]): Risk[] {
  const sites = project.sites
  const risks: Risk[] = []

  const total = sites.length
  const blocked = sites.filter(s => s.status === 'blocked').length
  const pending = sites.filter(s => s.status === 'pending').length
  const diaReady = sites.filter(isSiteDIAReady).length
  const logisticsReady = sites.filter(isSiteLogisticsReady).length

  // Schedule risk
  const closestWave = waves.filter(w => w.goLiveDate).sort((a, b) =>
    new Date(a.goLiveDate!).getTime() - new Date(b.goLiveDate!).getTime()
  )[0]
  if (closestWave?.goLiveDate) {
    const days = daysUntil(closestWave.goLiveDate)
    const pct = completionPct(sites)
    if (days < 14 && pct < 80) {
      risks.push({ id: 'r1', title: 'Go-Live Schedule Slip', description: `Wave ${closestWave.wave} go-live in ${days}d with only ${pct}% completion.`, probability: 'high', impact: 'critical', category: 'schedule' })
    } else if (days < 30 && pct < 60) {
      risks.push({ id: 'r1', title: 'Go-Live Schedule Slip', description: `Wave ${closestWave.wave} go-live in ${days}d with ${pct}% completion.`, probability: 'medium', impact: 'high', category: 'schedule' })
    } else {
      risks.push({ id: 'r1', title: 'Go-Live Schedule Slip', description: `Wave ${closestWave.wave} go-live in ${days}d with ${pct}% completion.`, probability: 'low', impact: 'high', category: 'schedule' })
    }
  }

  // DIA risk
  const diaPct = total ? Math.round((diaReady / total) * 100) : 0
  if (diaPct < 30) {
    risks.push({ id: 'r2', title: 'DIA Circuit Delays', description: `Only ${diaReady}/${total} sites have confirmed DIA circuits (${diaPct}%).`, probability: 'high', impact: 'high', category: 'dia' })
  } else if (diaPct < 60) {
    risks.push({ id: 'r2', title: 'DIA Circuit Delays', description: `${diaReady}/${total} sites DIA-ready (${diaPct}%). Mid-rollout risk.`, probability: 'medium', impact: 'high', category: 'dia' })
  } else {
    risks.push({ id: 'r2', title: 'DIA Circuit Delays', description: `${diaReady}/${total} sites DIA-ready (${diaPct}%). On track.`, probability: 'low', impact: 'medium', category: 'dia' })
  }

  // Logistics risk
  const logPct = total ? Math.round((logisticsReady / total) * 100) : 0
  if (logPct < 30) {
    risks.push({ id: 'r3', title: 'Device Logistics Gap', description: `Only ${logisticsReady}/${total} sites have routers installed.`, probability: 'high', impact: 'high', category: 'logistics' })
  } else if (logPct < 70) {
    risks.push({ id: 'r3', title: 'Device Logistics Gap', description: `${logisticsReady}/${total} routers installed. Tracking remaining deliveries.`, probability: 'medium', impact: 'medium', category: 'logistics' })
  } else {
    risks.push({ id: 'r3', title: 'Device Logistics Gap', description: `${logisticsReady}/${total} routers installed. Good coverage.`, probability: 'low', impact: 'low', category: 'logistics' })
  }

  // Country concentration risk
  const byCountry = sites.reduce((acc, s) => {
    acc[s.country] = (acc[s.country] || 0) + 1
    return acc
  }, {} as Record<string, number>)
  const topCountry = Object.entries(byCountry).sort((a, b) => b[1] - a[1])[0]
  if (topCountry && total > 5 && topCountry[1] / total > 0.5) {
    risks.push({ id: 'r4', title: 'Country Concentration', description: `${Math.round(topCountry[1] / total * 100)}% of sites in ${topCountry[0]}. Single-country regulatory risk.`, probability: 'medium', impact: 'medium', category: 'country' })
  } else {
    risks.push({ id: 'r4', title: 'Country Concentration', description: `Sites distributed across ${Object.keys(byCountry).length} countries. Manageable exposure.`, probability: 'low', impact: 'medium', category: 'country' })
  }

  // Blocked sites risk
  if (total > 0 && blocked / total > 0.2) {
    risks.push({ id: 'r5', title: 'High Blockage Rate', description: `${blocked} sites (${Math.round(blocked / total * 100)}%) are blocked. Requires escalation.`, probability: 'high', impact: 'high', category: 'schedule' })
  } else if (blocked > 0) {
    risks.push({ id: 'r5', title: 'Site Blockage', description: `${blocked} site(s) blocked. Monitoring for escalation.`, probability: 'low', impact: 'medium', category: 'schedule' })
  }

  return risks
}

// ── T-Minus milestones ────────────────────────────────────────────────────────

function getTMinus(sites: Site[], goLiveDate?: string) {
  const total = sites.length || 1
  const milestones = [
    {
      id: 'dia',
      label: 'DIA Circuits Confirmed',
      icon: Wifi,
      done: sites.filter(isSiteDIAReady).length,
      total: sites.length,
      daysBeforeGoLive: 30,
      color: 'text-cyan-400',
    },
    {
      id: 'devices',
      label: 'Devices Delivered',
      icon: Package,
      done: sites.filter(s => s.routers?.every(r => ['delivered', 'installed'].includes(r.status))).length,
      total: sites.length,
      daysBeforeGoLive: 14,
      color: 'text-orange-400',
    },
    {
      id: 'installed',
      label: 'Routers Installed',
      icon: Zap,
      done: sites.filter(isSiteLogisticsReady).length,
      total: sites.length,
      daysBeforeGoLive: 7,
      color: 'text-yellow-400',
    },
    {
      id: 'kmz',
      label: 'KMZ Documents Ready',
      icon: Globe,
      done: sites.filter(s => s.kmzGenerated).length,
      total: sites.length,
      daysBeforeGoLive: 21,
      color: 'text-purple-400',
    },
    {
      id: 'sites',
      label: 'Sites Completed',
      icon: CheckCircle,
      done: sites.filter(s => s.status === 'completed').length,
      total: sites.length,
      daysBeforeGoLive: 0,
      color: 'text-green-400',
    },
  ]

  return milestones.map(m => {
    const pct = m.total ? Math.round((m.done / m.total) * 100) : 0
    let deadline: Date | null = null
    let daysLeft: number | null = null
    if (goLiveDate) {
      deadline = new Date(new Date(goLiveDate).getTime() - m.daysBeforeGoLive * 86400000)
      daysLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000)
    }
    const status = pct === 100 ? 'done' : daysLeft !== null && daysLeft < 0 ? 'overdue' : daysLeft !== null && daysLeft < 7 ? 'urgent' : 'on_track'
    return { ...m, pct, deadline, daysLeft, status }
  })
}

// ── Country delays ────────────────────────────────────────────────────────────

function getCountryStats(sites: Site[]) {
  const map: Record<string, { total: number; completed: number; blocked: number; pending: number; inProgress: number }> = {}
  for (const s of sites) {
    if (!map[s.country]) map[s.country] = { total: 0, completed: 0, blocked: 0, pending: 0, inProgress: 0 }
    map[s.country].total++
    if (s.status === 'completed') map[s.country].completed++
    else if (s.status === 'blocked') map[s.country].blocked++
    else if (s.status === 'pending') map[s.country].pending++
    else map[s.country].inProgress++
  }
  return Object.entries(map)
    .map(([country, d]) => ({
      country,
      ...d,
      pct: Math.round((d.completed / d.total) * 100),
      delayStatus: d.blocked > 0 && d.blocked / d.total > 0.2 ? 'Delayed' as const
        : d.blocked > 0 ? 'At Risk' as const
        : d.completed / d.total > 0.8 ? 'On Track' as const
        : 'In Progress' as const,
    }))
    .sort((a, b) => b.total - a.total)
}

const DELAY_BADGE: Record<string, string> = {
  'On Track': 'bg-green-500/20 text-green-300 border-green-500/30',
  'In Progress': 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  'At Risk': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  'Delayed': 'bg-red-500/20 text-red-300 border-red-500/30',
}

// ── Component ─────────────────────────────────────────────────────────────────

export function ExecutiveReport({ project, onUpdate }: Props) {
  const defaultWaves: WaveConfig[] = [
    { wave: 1, label: 'Wave 1', goLiveDate: '' },
    { wave: 2, label: 'Wave 2', goLiveDate: '' },
    { wave: 3, label: 'Wave 3', goLiveDate: '' },
  ]
  const [waves, setWaves] = useState<WaveConfig[]>(project.waves?.length ? project.waves : defaultWaves)
  const [editingWaves, setEditingWaves] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [exportingPDF, setExportingPDF] = useState(false)
  const [reportText, setReportText] = useState('')

  const sites = project.sites
  const countryStats = useMemo(() => getCountryStats(sites), [sites])
  const risks = useMemo(() => deriveRisks(project, waves), [project, waves])

  function saveWaves(updated: WaveConfig[]) {
    setWaves(updated)
    saveProject({ ...project, waves: updated })
    onUpdate()
  }

  // Group sites by wave
  const waveSites = (w: Wave) => sites.filter(s => s.wave === w)
  const unassigned = sites.filter(s => !s.wave)

  // T-minus uses first wave with a go-live date
  const firstGoLive = waves.find(w => w.goLiveDate)?.goLiveDate
  const tminus = getTMinus(sites, firstGoLive)

  async function exportPDF() {
    setExportingPDF(true)
    try {
      await generateExecutivePDF(project, waves, reportText || undefined)
    } finally {
      setExportingPDF(false)
    }
  }

  async function generateReport() {
    setGenerating(true)
    try {
      const ctx = {
        project: project.name,
        customer: project.customer,
        total: sites.length,
        completed: sites.filter(s => s.status === 'completed').length,
        blocked: sites.filter(s => s.status === 'blocked').length,
        diaReady: sites.filter(isSiteDIAReady).length,
        logisticsReady: sites.filter(isSiteLogisticsReady).length,
        countryBreakdown: countryStats.map(c => `${c.country}: ${c.completed}/${c.total} (${c.pct}%, ${c.delayStatus})`).join('; '),
        waves: waves.filter(w => w.goLiveDate).map(w => {
          const ws = waveSites(w.wave)
          return `Wave ${w.wave} (${w.goLiveDate}): ${ws.length} sites, ${completionPct(ws)}% done`
        }).join('; '),
        topRisks: risks.slice(0, 3).map(r => `${r.title} (${r.probability} probability, ${r.impact} impact)`).join('; '),
      }
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'query',
          payload: {
            question: `Generate a concise 3-paragraph executive report for a telecom rollout program.
            Format: Executive Summary | Key Milestones & Delays | Risk & Recommendations.
            Professional tone, data-driven, LATAM telecom context. No bullet lists — flowing paragraphs.`,
            projectData: ctx,
          },
        })
      })
      const data = await res.json()
      setReportText(data.result || data.error || '')
    } finally {
      setGenerating(false)
    }
  }

  // Build 3×3 heatmap grid
  const levels: RiskLevel[] = ['low', 'medium', 'high']
  const heatmapCells = levels.map(prob =>
    levels.map(imp => risks.filter(r => r.probability === prob && r.impact === imp))
  )
  // For the visual we flip probability axis (high at top)
  const probRows = [...levels].reverse()

  return (
    <div className="space-y-6">

      {/* ── Top action bar ─────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-base font-semibold text-white">Executive Report</h1>
          <p className="text-xs text-gray-500 mt-0.5">Auto-generated from live project data · {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>
        <Button onClick={exportPDF} disabled={exportingPDF}
          className="bg-blue-600 hover:bg-blue-700 gap-2">
          <Download className="w-4 h-4" />
          {exportingPDF ? 'Generating PDF…' : 'Export PDF'}
        </Button>
      </div>

      {/* ── Wave Configuration ─────────────────────────── */}
      <div className="card-glow bg-[#070d16] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Flag className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">Rollout Waves & Go-Live Dates</h2>
          </div>
          <Button size="sm" variant="outline" onClick={() => setEditingWaves(e => !e)}
            className="border-gray-700 text-gray-300 h-7 text-xs">
            {editingWaves ? 'Save' : 'Configure'}
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {waves.map((w, i) => {
            const ws = waveSites(w.wave)
            const pct = completionPct(ws)
            const days = w.goLiveDate ? daysUntil(w.goLiveDate) : null
            return (
              <div key={w.wave} className="bg-gray-900/60 border border-gray-800 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-white
                    ${w.wave === 1 ? 'bg-blue-600' : w.wave === 2 ? 'bg-purple-600' : 'bg-cyan-600'}`}>
                    {w.wave}
                  </span>
                  <span className="text-sm font-medium text-white">{w.label}</span>
                </div>

                {editingWaves ? (
                  <div className="space-y-2">
                    <Input
                      value={w.label}
                      onChange={e => {
                        const updated = waves.map((x, j) => j === i ? { ...x, label: e.target.value } : x)
                        setWaves(updated)
                      }}
                      className="h-7 text-xs bg-gray-800 border-gray-700 text-white"
                      placeholder="Wave name"
                    />
                    <Input
                      type="date"
                      value={w.goLiveDate || ''}
                      onChange={e => {
                        const updated = waves.map((x, j) => j === i ? { ...x, goLiveDate: e.target.value } : x)
                        saveWaves(updated)
                      }}
                      className="h-7 text-xs bg-gray-800 border-gray-700 text-white"
                    />
                  </div>
                ) : (
                  <>
                    <div className="text-xs text-gray-400 mb-2">
                      {w.goLiveDate ? (
                        <span className={days !== null && days < 0 ? 'text-red-400' : days !== null && days < 14 ? 'text-yellow-400' : 'text-gray-300'}>
                          {days !== null && days < 0 ? `${Math.abs(days)}d overdue` : days !== null ? `T-${days} days` : ''} · {new Date(w.goLiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </span>
                      ) : <span className="text-gray-600 italic">No date set</span>}
                    </div>
                    <div className="text-xs text-gray-400 mb-2">{ws.length} sites · {pct}% done</div>
                    <div className="w-full bg-gray-800 rounded-full h-1.5">
                      <div className={`h-1.5 rounded-full transition-all ${w.wave === 1 ? 'bg-blue-500' : w.wave === 2 ? 'bg-purple-500' : 'bg-cyan-500'}`}
                        style={{ width: `${pct}%` }} />
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>

        {unassigned.length > 0 && (
          <p className="text-xs text-yellow-400 mt-3 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" />
            {unassigned.length} site(s) not assigned to a wave. Assign waves in the Sites tab.
          </p>
        )}
      </div>

      {/* ── T-Minus Timeline ───────────────────────────── */}
      <div className="card-glow bg-[#070d16] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Clock className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">T-Minus Activities to Go-Live</h2>
          {!firstGoLive && (
            <span className="text-xs text-gray-500 ml-2">— Set Wave 1 go-live date to activate countdown</span>
          )}
        </div>

        <div className="space-y-3">
          {tminus.map((m, idx) => {
            const Icon = m.icon
            const isLast = idx === tminus.length - 1
            return (
              <div key={m.id} className="flex items-start gap-3">
                {/* Timeline spine */}
                <div className="flex flex-col items-center mt-1">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center border-2 flex-shrink-0
                    ${m.status === 'done' ? 'bg-green-500/20 border-green-500 text-green-400'
                    : m.status === 'overdue' ? 'bg-red-500/20 border-red-500 text-red-400'
                    : m.status === 'urgent' ? 'bg-yellow-500/20 border-yellow-500 text-yellow-400'
                    : 'bg-gray-800 border-gray-700 text-gray-500'}`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  {!isLast && <div className="w-px h-6 bg-gray-800 mt-1" />}
                </div>

                <div className="flex-1 min-w-0 pb-2">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${
                      m.status === 'done' ? 'text-green-400' :
                      m.status === 'overdue' ? 'text-red-400 line-through' :
                      m.status === 'urgent' ? 'text-yellow-300' : 'text-gray-200'
                    }`}>{m.label}</span>

                    <div className="flex items-center gap-2">
                      {firstGoLive && m.deadline && (
                        <span className="text-xs text-gray-500">
                          T-{m.daysBeforeGoLive}d ·{' '}
                          {m.deadline.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                      <span className={`text-xs font-medium px-2 py-0.5 rounded border
                        ${m.status === 'done' ? 'bg-green-500/20 text-green-300 border-green-500/30'
                        : m.status === 'overdue' ? 'bg-red-500/20 text-red-300 border-red-500/30'
                        : m.status === 'urgent' ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                        : 'bg-gray-800 text-gray-400 border-gray-700'}`}>
                        {m.status === 'done' ? '✓ Done'
                          : m.status === 'overdue' ? `${Math.abs(m.daysLeft!)}d overdue`
                          : m.status === 'urgent' ? `${m.daysLeft}d left`
                          : firstGoLive && m.daysLeft !== null ? `${m.daysLeft}d left` : 'Pending'}
                      </span>
                    </div>
                  </div>

                  {/* Mini progress bar */}
                  <div className="flex items-center gap-2 mt-1.5">
                    <div className="flex-1 bg-gray-800 rounded-full h-1">
                      <div className={`h-1 rounded-full transition-all ${m.color.replace('text-', 'bg-')}`}
                        style={{ width: `${m.pct}%` }} />
                    </div>
                    <span className="text-xs text-gray-500 w-14 text-right">{m.done}/{m.total} ({m.pct}%)</span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Country Delays ─────────────────────────────── */}
      <div className="card-glow bg-[#070d16] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <Globe className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Country Delay Analysis</h2>
        </div>

        {countryStats.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-4">No sites added yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800">
                <th className="text-left text-label pb-2">Country</th>
                <th className="text-right text-label pb-2">Sites</th>
                <th className="text-right text-label pb-2">Done</th>
                <th className="text-right text-label pb-2">Blocked</th>
                <th className="text-right text-label pb-2">Pending</th>
                <th className="text-right text-label pb-2">Progress</th>
                <th className="text-right text-label pb-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {countryStats.map(c => (
                <tr key={c.country} className="border-b border-gray-900 hover:bg-gray-900/40 transition-colors">
                  <td className="py-2.5 font-medium text-gray-200">{c.country}</td>
                  <td className="py-2.5 text-right text-gray-400">{c.total}</td>
                  <td className="py-2.5 text-right text-green-400">{c.completed}</td>
                  <td className="py-2.5 text-right">
                    <span className={c.blocked > 0 ? 'text-red-400 font-semibold' : 'text-gray-600'}>{c.blocked}</span>
                  </td>
                  <td className="py-2.5 text-right text-gray-500">{c.pending}</td>
                  <td className="py-2.5 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <div className="w-20 bg-gray-800 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full ${c.pct >= 80 ? 'bg-green-500' : c.pct >= 50 ? 'bg-blue-500' : c.pct >= 20 ? 'bg-yellow-500' : 'bg-red-500'}`}
                          style={{ width: `${c.pct}%` }} />
                      </div>
                      <span className="text-gray-300 w-8 text-right">{c.pct}%</span>
                    </div>
                  </td>
                  <td className="py-2.5 text-right">
                    <span className={`text-xs px-2 py-0.5 rounded border ${DELAY_BADGE[c.delayStatus]}`}>
                      {c.delayStatus}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* ── Risk Heatmap ───────────────────────────────── */}
      <div className="card-glow bg-[#070d16] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-5">
          <Activity className="w-4 h-4 text-blue-400" />
          <h2 className="text-sm font-semibold text-white">Risk Heatmap</h2>
          <span className="text-xs text-gray-500 ml-1">— Auto-derived from live project data</span>
        </div>

        <div className="flex gap-6">
          {/* Heatmap grid */}
          <div className="flex-shrink-0">
            <div className="flex items-end gap-1 mb-1">
              <div className="w-16" />
              {levels.map(l => (
                <div key={l} className="w-32 text-center text-label">{RISK_LABEL[l]}</div>
              ))}
            </div>
            <div className="text-xs text-gray-600 text-center mb-1 ml-16">← IMPACT →</div>

            <div className="flex gap-0">
              {/* Probability label column */}
              <div className="flex flex-col gap-1 mr-1">
                {probRows.map(prob => (
                  <div key={prob} className="w-16 h-24 flex items-center justify-end pr-2">
                    <span className="text-label transform -rotate-0 text-right">{RISK_LABEL[prob]}</span>
                  </div>
                ))}
              </div>

              {/* Grid */}
              <div className="flex flex-col gap-1">
                {probRows.map(prob => (
                  <div key={prob} className="flex gap-1">
                    {levels.map(imp => {
                      const cellRisks = risks.filter(r => r.probability === prob && r.impact === imp)
                      const cellScore = Math.max(RISK_SCORE[prob], RISK_SCORE[imp])
                      return (
                        <div key={imp}
                          className={`w-32 h-24 rounded-lg border p-2 flex flex-col gap-1 transition-all
                            ${cellScore >= 3 ? RISK_CELL_COLOR[4] : cellScore >= 2 ? RISK_CELL_COLOR[3] : cellScore >= 1 ? RISK_CELL_COLOR[2] : RISK_CELL_COLOR[1]}`}>
                          {cellRisks.map(r => (
                            <span key={r.id} title={r.description}
                              className={`text-xs px-1.5 py-0.5 rounded border truncate cursor-default ${RISK_COLOR[r.probability]}`}>
                              {r.title}
                            </span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ))}
              </div>
            </div>
            <div className="ml-16 mt-1 text-label text-center">↑ PROBABILITY ↑</div>
          </div>

          {/* Risk legend */}
          <div className="flex-1 space-y-2">
            <p className="text-label mb-3">Risk Register</p>
            {risks.map(r => {
              const catIcon = {
                schedule: Clock, dia: Wifi, logistics: Package,
                country: Globe, provider: TrendingDown,
              }[r.category]
              const CatIcon = catIcon
              return (
                <div key={r.id} className="bg-gray-900/60 border border-gray-800 rounded-lg p-3">
                  <div className="flex items-start gap-2">
                    <CatIcon className="w-3.5 h-3.5 text-gray-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-gray-200">{r.title}</span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${RISK_COLOR[r.probability]}`}>
                          P: {RISK_LABEL[r.probability]}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border ${RISK_COLOR[r.impact]}`}>
                          I: {RISK_LABEL[r.impact]}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 leading-relaxed">{r.description}</p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── AI Executive Report ────────────────────────── */}
      <div className="card-glow bg-[#070d16] rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-400" />
            <h2 className="text-sm font-semibold text-white">AI Executive Report</h2>
          </div>
          <Button size="sm" onClick={generateReport} disabled={generating}
            className="bg-blue-600 hover:bg-blue-700 h-7 text-xs">
            {generating ? 'Generating…' : reportText ? 'Regenerate' : 'Generate Report'}
          </Button>
        </div>

        {reportText ? (
          <div className="prose prose-sm prose-invert max-w-none">
            {reportText.split('\n\n').map((para, i) => (
              <p key={i} className="text-sm text-gray-300 leading-relaxed mb-3">{para}</p>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-600">
            <FileText className="w-8 h-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">Click "Generate Report" to create an AI-written executive summary<br />based on live project data, waves, and risks.</p>
          </div>
        )}
      </div>

    </div>
  )
}
