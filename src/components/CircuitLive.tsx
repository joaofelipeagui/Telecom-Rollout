'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { Project, Provider, Site, getCarrierForCountry, DIAStatus } from '@/lib/types'
import { addEscalation, saveProject, getProject } from '@/lib/store'
import {
  Activity, AlertTriangle, CheckCircle, WifiOff, Wifi,
  Pause, Play, Trash2, Radio, Zap, Clock, TrendingDown,
  TrendingUp, Signal, AlertCircle, ChevronDown, ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────
type CircuitState = 'up' | 'degraded' | 'down'
type Severity     = 'critical' | 'warning' | 'info' | 'resolved'

interface CircuitHealth {
  key:          string   // siteId + provider
  siteId:       string
  siteName:     string
  city:         string
  country:      string
  provider:     string
  circuitNumber?: string
  diaStatus:    DIAStatus
  state:        CircuitState
  latency:      number
  jitter:       number
  loss:         number
  uptime:       number  // %
  bandwidth:    number  // % of CIR
  bgpState:     'established' | 'idle' | 'active'
  lastFlap?:    string
}

type EventKind =
  | 'circuit_down'  | 'circuit_up'
  | 'bgp_down'      | 'bgp_up'
  | 'latency_spike' | 'latency_ok'
  | 'packet_loss'   | 'loss_ok'
  | 'sla_breach'    | 'sla_restored'
  | 'cir_burst'     | 'cir_normal'
  | 'fiber_cut'     | 'fiber_restored'
  | 'maintenance'   | 'maintenance_end'
  | 'vrrp_failover' | 'vrrp_restored'
  | 'diversity_lost'| 'diversity_ok'
  | 'provisioning'  | 'config_change'

interface CircuitEvent {
  id:            string
  ts:            Date
  siteId:        string
  siteName:      string
  country:       string
  provider:      string
  circuitNumber?: string
  kind:          EventKind
  severity:      Severity
  message:       string
  metric?:       string
}

// ── Event templates ────────────────────────────────────────────────────────────
const EVT: Record<EventKind, {
  severity: Severity
  msg: (c: CircuitHealth) => string
  metric?: (c: CircuitHealth) => string
}> = {
  circuit_down:   { severity: 'critical', msg: c => `DIA circuit DOWN — ${c.provider} — no carrier signal`,                       metric: _ => 'Loss: 100%' },
  circuit_up:     { severity: 'resolved', msg: c => `DIA circuit RESTORED — ${c.provider} — full connectivity`,                   metric: c => `RTT: ${c.latency}ms · Loss: 0%` },
  bgp_down:       { severity: 'critical', msg: c => `BGP session DROPPED with ${c.provider} peer`,                               metric: _ => 'AS path withdrawn' },
  bgp_up:         { severity: 'resolved', msg: c => `BGP session RE-ESTABLISHED with ${c.provider}`,                             metric: _ => 'Routes received' },
  latency_spike:  { severity: 'warning',  msg: c => `High latency on ${c.provider} DIA — SLA threshold exceeded`,                metric: c => `RTT: ${c.latency}ms (SLA ≤80ms)` },
  latency_ok:     { severity: 'info',     msg: c => `Latency normalised on ${c.provider} DIA circuit`,                           metric: c => `RTT: ${c.latency}ms` },
  packet_loss:    { severity: 'warning',  msg: c => `Packet loss detected — ${c.provider} circuit unstable`,                    metric: c => `Loss: ${c.loss.toFixed(1)}%` },
  loss_ok:        { severity: 'resolved', msg: c => `Packet loss cleared — ${c.provider} circuit stable`,                        metric: _ => 'Loss: 0%' },
  sla_breach:     { severity: 'critical', msg: c => `SLA BREACH — ${c.provider} uptime below contracted threshold`,              metric: c => `Uptime: ${c.uptime.toFixed(2)}% (SLA 99.5%)` },
  sla_restored:   { severity: 'resolved', msg: c => `SLA restored — ${c.provider} circuit back within contracted uptime`,        metric: c => `Uptime: ${c.uptime.toFixed(2)}%` },
  cir_burst:      { severity: 'warning',  msg: c => `CIR burst allowance exceeded on ${c.provider} DIA`,                        metric: _ => 'Utilisation: 112% of CIR' },
  cir_normal:     { severity: 'info',     msg: c => `Bandwidth within CIR — ${c.provider} circuit healthy`,                      metric: c => `Utilisation: ${c.bandwidth}%` },
  fiber_cut:      { severity: 'critical', msg: c => `Physical fiber cut detected — ${c.provider} last-mile path`,               metric: _ => 'Signal loss: −40dBm' },
  fiber_restored: { severity: 'resolved', msg: c => `Fiber path restored — ${c.provider} splice complete`,                       metric: _ => 'Signal: −8dBm (nominal)' },
  maintenance:    { severity: 'info',     msg: c => `Carrier maintenance window started — ${c.provider}`,                        metric: _ => 'Expected duration: 2h' },
  maintenance_end:{ severity: 'resolved', msg: c => `Carrier maintenance completed — ${c.provider} circuit restored`,            metric: _ => 'All paths up' },
  vrrp_failover:  { severity: 'critical', msg: c => `VRRP failover — backup router ACTIVE at ${c.siteName}`,                    metric: _ => 'Primary router unreachable' },
  vrrp_restored:  { severity: 'resolved', msg: c => `VRRP restored — primary router ACTIVE at ${c.siteName}`,                   metric: _ => 'Failback complete' },
  diversity_lost: { severity: 'critical', msg: c => `Diversity path LOST — ${c.provider} single-path exposure at ${c.siteName}`,metric: _ => 'Secondary circuit down' },
  diversity_ok:   { severity: 'resolved', msg: c => `Diversity path RESTORED — both circuits UP at ${c.siteName}`,               metric: _ => 'Full redundancy' },
  provisioning:   { severity: 'info',     msg: c => `Circuit provisioning update — ${c.provider} at ${c.siteName}`,             metric: _ => 'SLA milestone logged' },
  config_change:  { severity: 'info',     msg: c => `Circuit config change applied — ${c.provider} at ${c.siteName}`,           metric: _ => 'BGP policy updated' },
}

const DOWN_POOL:     EventKind[] = ['circuit_down', 'bgp_down', 'fiber_cut', 'vrrp_failover', 'diversity_lost', 'sla_breach', 'circuit_up', 'bgp_up']
const DEGRADED_POOL: EventKind[] = ['latency_spike', 'packet_loss', 'cir_burst', 'sla_breach', 'vrrp_failover', 'latency_ok', 'loss_ok']
const UP_POOL:       EventKind[] = ['latency_ok', 'cir_normal', 'maintenance', 'maintenance_end', 'config_change', 'provisioning', 'latency_spike', 'cir_burst']

// ── Styles ─────────────────────────────────────────────────────────────────────
const SEV: Record<Severity, { row: string; badge: string; text: string; dot: string }> = {
  critical: { row: 'bg-red-950/30 border-red-800/30',       badge: 'bg-red-900 text-red-300',       text: 'text-red-400',    dot: 'bg-red-500' },
  warning:  { row: 'bg-orange-950/20 border-orange-800/20', badge: 'bg-orange-900 text-orange-300', text: 'text-orange-400', dot: 'bg-orange-400' },
  info:     { row: 'bg-gray-900/40 border-gray-800/20',     badge: 'bg-gray-800 text-gray-300',     text: 'text-gray-400',   dot: 'bg-gray-500' },
  resolved: { row: 'bg-green-950/20 border-green-800/20',   badge: 'bg-green-900 text-green-300',   text: 'text-green-400',  dot: 'bg-green-500' },
}
const STATE_STYLE: Record<CircuitState, { label: string; text: string; bg: string; dot: string; Icon: React.ElementType }> = {
  up:       { label: 'UP',       text: 'text-green-400',  bg: 'bg-green-950/30 border-green-800/30',   dot: 'bg-green-400',  Icon: CheckCircle },
  degraded: { label: 'DEGRADED', text: 'text-yellow-400', bg: 'bg-yellow-950/20 border-yellow-800/20', dot: 'bg-yellow-400', Icon: AlertTriangle },
  down:     { label: 'DOWN',     text: 'text-red-400',    bg: 'bg-red-950/30 border-red-800/30',       dot: 'bg-red-500',    Icon: WifiOff },
}
const DIA_STATUS_LABEL: Record<DIAStatus, string> = {
  not_requested:    'Not Requested',
  requested:        'Requested',
  received:         'LOA Received',
  confirmed:        'Confirmed ✓',
  diverse_confirmed:'Diverse ✓',
}

// ── Helpers ────────────────────────────────────────────────────────────────────
function rand(min: number, max: number)       { return Math.random() * (max - min) + min }
function randInt(min: number, max: number)    { return Math.floor(rand(min, max + 1)) }
function pick<T>(arr: T[]): T                 { return arr[Math.floor(Math.random() * arr.length)] }
function fmt(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function buildCircuits(project: Project): CircuitHealth[] {
  const circuits: CircuitHealth[] = []
  for (const site of project.sites.slice(0, 40)) {
    const providerEntries = Object.entries(site.dias) as [Provider, (typeof site.dias)[Provider]][]
    if (providerEntries.length === 0) {
      // Site has no DIA config — still show it with primary carrier
      const provider = getCarrierForCountry(site.country)
      const stability = Math.random()
      const state: CircuitState = stability > 0.88 ? 'down' : stability > 0.7 ? 'degraded' : 'up'
      circuits.push({
        key: `${site.id}_default`,
        siteId:   site.id,
        siteName: site.name,
        city:     site.city,
        country:  site.country,
        provider,
        diaStatus: 'not_requested',
        state,
        latency:   state === 'down' ? 999 : state === 'degraded' ? randInt(90, 300) : randInt(5, 55),
        jitter:    state === 'down' ? 999 : state === 'degraded' ? randInt(22, 80)  : randInt(1, 12),
        loss:      state === 'down' ? 100  : state === 'degraded' ? rand(1, 8)      : rand(0, 0.3),
        uptime:    state === 'down' ? rand(70, 88) : state === 'degraded' ? rand(92, 98.5) : rand(99.1, 99.99),
        bandwidth: state === 'down' ? 0 : state === 'degraded' ? randInt(60, 90) : randInt(20, 75),
        bgpState:  state === 'down' ? 'idle' : state === 'degraded' ? pick(['active', 'established']) : 'established',
      })
    } else {
      for (const [provider, dia] of providerEntries) {
        if (!dia) continue
        // Confirmed circuits are more likely to be healthy
        const confirmed = dia.status === 'confirmed' || dia.status === 'diverse_confirmed'
        const stability = confirmed ? Math.random() * 0.6 : Math.random()
        const state: CircuitState = stability > 0.88 ? 'down' : stability > 0.7 ? 'degraded' : 'up'
        circuits.push({
          key: `${site.id}_${provider}`,
          siteId:    site.id,
          siteName:  site.name,
          city:      site.city,
          country:   site.country,
          provider,
          circuitNumber: dia.circuitNumber,
          diaStatus: dia.status,
          state,
          latency:   state === 'down' ? 999 : state === 'degraded' ? randInt(85, 280) : randInt(4, 50),
          jitter:    state === 'down' ? 999 : state === 'degraded' ? randInt(20, 70)  : randInt(1, 10),
          loss:      state === 'down' ? 100  : state === 'degraded' ? rand(1.5, 9)    : rand(0, 0.2),
          uptime:    state === 'down' ? rand(72, 88) : state === 'degraded' ? rand(93, 99) : rand(99.2, 99.99),
          bandwidth: state === 'down' ? 0 : state === 'degraded' ? randInt(55, 95) : randInt(15, 70),
          bgpState:  state === 'down' ? 'idle' : state === 'degraded' ? pick(['active', 'established']) : 'established',
        })
      }
    }
  }
  return circuits
}

function genEvent(circuits: CircuitHealth[]): CircuitEvent {
  const weighted = [
    ...circuits.filter(c => c.state === 'down').flatMap(c => [c, c, c, c]),
    ...circuits.filter(c => c.state === 'degraded').flatMap(c => [c, c]),
    ...circuits.filter(c => c.state === 'up'),
  ]
  const c = pick(weighted.length > 0 ? weighted : circuits)
  const pool = c.state === 'down' ? DOWN_POOL : c.state === 'degraded' ? DEGRADED_POOL : UP_POOL
  const kind = pick(pool)
  const tmpl = EVT[kind]
  const jc = {
    ...c,
    latency: Math.max(1, c.latency + randInt(-10, 20)),
    jitter:  Math.max(0, c.jitter  + randInt(-3, 8)),
    loss:    Math.max(0, c.loss    + rand(-0.3, 0.6)),
  }
  return {
    id:            `${Date.now()}_${Math.random()}`,
    ts:            new Date(),
    siteId:        c.siteId,
    siteName:      c.siteName,
    country:       c.country,
    provider:      c.provider,
    circuitNumber: c.circuitNumber,
    kind,
    severity:      tmpl.severity,
    message:       tmpl.msg(jc),
    metric:        tmpl.metric?.(jc),
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
const MAX_EVENTS = 150
type FilterSev = 'all' | Severity

interface Props { project: Project; onUpdate: () => void }

export function CircuitLive({ project, onUpdate }: Props) {
  const [circuits]    = useState<CircuitHealth[]>(() => buildCircuits(project))
  const [events, setEvents]   = useState<CircuitEvent[]>([])
  const [paused, setPaused]   = useState(false)
  const [sevFilter, setSev]   = useState<FilterSev>('all')
  const [stateFilter, setState] = useState<CircuitState | 'all'>('all')
  const [search, setSearch]   = useState('')
  const [showAllCircuits, setShowAllCircuits] = useState(false)
  const [escalating, setEscalating] = useState<string | null>(null) // event id
  const feedRef    = useRef<HTMLDivElement>(null)
  const pausedRef  = useRef(false)
  pausedRef.current = paused

  const scrollTop = useCallback(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [])

  useEffect(() => {
    const seed: CircuitEvent[] = []
    for (let i = 0; i < 10; i++) seed.push(genEvent(circuits))
    setEvents(seed)
    const timer = setInterval(() => {
      if (pausedRef.current) return
      setEvents(prev => [genEvent(circuits), ...prev].slice(0, MAX_EVENTS))
      scrollTop()
    }, 3200)
    return () => clearInterval(timer)
  }, [circuits, scrollTop])

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const circuitsDown     = circuits.filter(c => c.state === 'down').length
  const circuitsDegraded = circuits.filter(c => c.state === 'degraded').length
  const circuitsUp       = circuits.filter(c => c.state === 'up').length
  const slaBreached      = circuits.filter(c => c.uptime < 99.5).length
  const criticalCount    = events.filter(e => e.severity === 'critical').length
  const warningCount     = events.filter(e => e.severity === 'warning').length

  // ── Filtered circuits ──────────────────────────────────────────────────────
  const filteredCircuits = useMemo(() => {
    const q = search.toLowerCase()
    return circuits
      .filter(c => stateFilter === 'all' || c.state === stateFilter)
      .filter(c => !search || c.siteName.toLowerCase().includes(q) || c.provider.toLowerCase().includes(q) || c.country.toLowerCase().includes(q))
  }, [circuits, stateFilter, search])

  const displayCircuits = showAllCircuits ? filteredCircuits : filteredCircuits.slice(0, 12)

  // ── Filtered events ────────────────────────────────────────────────────────
  const filteredEvents = useMemo(() => {
    const q = search.toLowerCase()
    return events.filter(e => {
      const matchSev = sevFilter === 'all' || e.severity === sevFilter
      const matchSearch = !search || e.siteName.toLowerCase().includes(q) || e.provider.toLowerCase().includes(q)
      return matchSev && matchSearch
    })
  }, [events, sevFilter, search])

  // ── Escalate from event ────────────────────────────────────────────────────
  function escalateEvent(ev: CircuitEvent) {
    addEscalation(project.id, {
      siteId:      ev.siteId,
      siteName:    ev.siteName,
      title:       `Circuit Alert: ${ev.message.slice(0, 60)}`,
      description: `Auto-escalated from circuit live event.\nProvider: ${ev.provider}${ev.circuitNumber ? ` · Circuit: ${ev.circuitNumber}` : ''}\nMetric: ${ev.metric ?? 'N/A'}\nTime: ${fmt(ev.ts)}`,
      priority:    ev.severity === 'critical' ? 'critical' : 'high',
      status:      'open',
      assignedTo:  '',
      dueDate:     '',
    })
    onUpdate()
    setEscalating(ev.id)
    setTimeout(() => setEscalating(null), 2000)
  }

  return (
    <div className="space-y-5">

      {/* Live indicator */}
      <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800/40 rounded-xl px-4 py-2.5">
        <Radio className="w-4 h-4 text-blue-400 flex-shrink-0 animate-pulse" />
        <p className="text-xs text-blue-200">
          <span className="font-semibold">DIA Circuit Monitor</span> — live health, BGP state, SLA tracking and escalation for all {circuits.length} circuits. Simulated feed; connect <span className="font-mono text-blue-300">/api/circuit-events</span> for production telemetry.
        </p>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { label: 'Circuits Up',       value: circuitsUp,       color: 'text-green-400',  bg: 'bg-green-950/20 border-green-800/20' },
          { label: 'Degraded',          value: circuitsDegraded, color: 'text-yellow-400', bg: 'bg-yellow-950/20 border-yellow-800/20' },
          { label: 'Down',              value: circuitsDown,     color: 'text-red-400',    bg: 'bg-red-950/30 border-red-800/30' },
          { label: 'SLA Breached',      value: slaBreached,      color: slaBreached > 0 ? 'text-orange-400' : 'text-gray-600', bg: slaBreached > 0 ? 'bg-orange-950/20 border-orange-800/20' : 'bg-gray-900 border-gray-800' },
          { label: 'Critical Events',   value: criticalCount,    color: criticalCount > 0 ? 'text-red-400' : 'text-gray-600',    bg: criticalCount > 0 ? 'bg-red-950/20 border-red-800/20' : 'bg-gray-900 border-gray-800' },
          { label: 'Warning Events',    value: warningCount,     color: warningCount > 0 ? 'text-orange-400' : 'text-gray-600',  bg: warningCount > 0 ? 'bg-orange-950/20 border-orange-800/20' : 'bg-gray-900 border-gray-800' },
        ].map(k => (
          <div key={k.label} className={`rounded-xl border px-4 py-3 ${k.bg}`}>
            <div className={`text-2xl font-bold ${k.color}`}>{k.value}</div>
            <div className="text-[10px] text-gray-500 mt-0.5">{k.label}</div>
          </div>
        ))}
      </div>

      {/* ── Circuit Inventory ─────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Circuit Health — {filteredCircuits.length} circuits</p>
          <div className="flex items-center gap-2 flex-wrap">
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search site / provider / country…"
              className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-blue-600 w-52"
            />
            {(['all', 'up', 'degraded', 'down'] as (CircuitState | 'all')[]).map(s => (
              <button key={s} onClick={() => setState(s)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  stateFilter === s
                    ? s === 'down'     ? 'bg-red-900 border-red-700 text-red-200'
                    : s === 'degraded' ? 'bg-yellow-900 border-yellow-700 text-yellow-200'
                    : s === 'up'       ? 'bg-green-900 border-green-700 text-green-200'
                    : 'bg-blue-900 border-blue-700 text-blue-200'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>
                {s.toUpperCase()}{s !== 'all' && ` (${circuits.filter(c => c.state === s).length})`}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {displayCircuits.map(c => {
            const ss = STATE_STYLE[c.state]
            const StateIcon = ss.Icon
            return (
              <div key={c.key} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${ss.bg}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ss.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold text-white truncate">{c.siteName}</span>
                    <span className={`text-[10px] px-1.5 py-0 rounded border font-semibold ${
                      c.diaStatus === 'diverse_confirmed' ? 'bg-emerald-950/60 text-emerald-300 border-emerald-700/50'
                      : c.diaStatus === 'confirmed' ? 'bg-green-950/60 text-green-300 border-green-700/50'
                      : 'bg-gray-800/60 text-gray-400 border-gray-700/50'
                    }`}>{DIA_STATUS_LABEL[c.diaStatus]}</span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {c.city}, {c.country} · <span className="text-gray-400 font-medium">{c.provider}</span>
                    {c.circuitNumber && <span className="text-gray-600 font-mono ml-1">#{c.circuitNumber}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs text-right">
                  <div>
                    <div className={`font-bold ${ss.text} flex items-center gap-1`}>
                      <StateIcon className="w-3 h-3" />
                      {ss.label}
                    </div>
                    <div className="text-[10px] text-gray-600">BGP: {c.bgpState}</div>
                  </div>
                  {c.state !== 'down' && (
                    <div>
                      <div className="text-gray-300">{c.latency}ms</div>
                      <div className="text-[10px] text-gray-500">RTT</div>
                    </div>
                  )}
                  {c.state !== 'down' && c.loss > 0.1 && (
                    <div>
                      <div className="text-orange-400">{c.loss.toFixed(1)}%</div>
                      <div className="text-[10px] text-gray-500">Loss</div>
                    </div>
                  )}
                  <div>
                    <div className={c.uptime < 99.5 ? 'text-orange-400 font-bold' : 'text-gray-400'}>
                      {c.uptime.toFixed(2)}%
                    </div>
                    <div className="text-[10px] text-gray-500">Uptime</div>
                  </div>
                  <div>
                    <div className="text-gray-400">{c.bandwidth}%</div>
                    <div className="text-[10px] text-gray-500">CIR</div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {filteredCircuits.length > 12 && (
          <button
            onClick={() => setShowAllCircuits(v => !v)}
            className="mt-2 w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-gray-300 py-1.5 border border-gray-800 rounded-xl transition-colors"
          >
            {showAllCircuits
              ? <><ChevronUp className="w-3.5 h-3.5" />Show less</>
              : <><ChevronDown className="w-3.5 h-3.5" />Show all {filteredCircuits.length} circuits</>}
          </button>
        )}
      </div>

      {/* ── Live Event Feed ─────────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider">Filter:</span>
            {(['all', 'critical', 'warning', 'resolved', 'info'] as FilterSev[]).map(f => (
              <button key={f} onClick={() => setSev(f)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  sevFilter === f
                    ? f === 'critical' ? 'bg-red-900 border-red-700 text-red-200'
                    : f === 'warning'  ? 'bg-orange-900 border-orange-700 text-orange-200'
                    : f === 'resolved' ? 'bg-green-900 border-green-700 text-green-200'
                    : f === 'info'     ? 'bg-gray-700 border-gray-600 text-gray-200'
                    : 'bg-blue-900 border-blue-700 text-blue-200'
                    : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
                }`}>
                {f === 'all' ? `All (${events.length})` : `${f} (${events.filter(e => e.severity === f).length})`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline"
              onClick={() => setPaused(p => !p)}
              className={`h-7 text-xs border-gray-700 gap-1.5 ${paused ? 'text-green-400 border-green-700' : 'text-gray-300'}`}>
              {paused ? <><Play className="w-3 h-3" />Resume</> : <><Pause className="w-3 h-3" />Pause</>}
            </Button>
            <Button size="sm" variant="outline"
              onClick={() => setEvents([])}
              className="h-7 text-xs border-gray-700 text-gray-400 gap-1.5">
              <Trash2 className="w-3 h-3" />Clear
            </Button>
          </div>
        </div>

        <div className="card-glow bg-[#070d16] rounded-xl overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-[#0a0f1a]">
            <Activity className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-semibold text-gray-300">Circuit Live Events</span>
            {!paused ? (
              <span className="flex items-center gap-1 ml-1">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs text-green-400">LIVE</span>
              </span>
            ) : (
              <span className="text-xs text-yellow-400 ml-1">PAUSED</span>
            )}
            <span className="ml-auto text-xs text-gray-600">{filteredEvents.length} events</span>
          </div>

          <div ref={feedRef} className="overflow-y-auto max-h-[480px]">
            {filteredEvents.length === 0 && (
              <div className="flex items-center justify-center py-12 text-gray-600 text-sm">No events…</div>
            )}
            {filteredEvents.map((ev, i) => {
              const ss = SEV[ev.severity]
              const isEscalated = escalating === ev.id
              return (
                <div key={ev.id}
                  className={`group flex items-start gap-3 px-4 py-2.5 border-b border-gray-800/40 last:border-0 ${ss.row}
                    ${i === 0 && !paused ? 'animate-in fade-in slide-in-from-top-1 duration-300' : ''}`}>
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${ss.dot}`} />
                  <div className="w-20 flex-shrink-0 text-xs text-gray-500 mt-0.5 font-mono">{fmt(ev.ts)}</div>
                  <div className="w-20 flex-shrink-0">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${ss.badge}`}>
                      {ev.severity.toUpperCase()}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-white font-medium">{ev.message}</div>
                    <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                      <span className="text-xs text-gray-500">{ev.siteName}</span>
                      <span className="text-gray-700">·</span>
                      <span className="text-xs text-gray-500">{ev.country}</span>
                      {ev.circuitNumber && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className="text-xs text-gray-500 font-mono">#{ev.circuitNumber}</span>
                        </>
                      )}
                      {ev.metric && (
                        <>
                          <span className="text-gray-700">·</span>
                          <span className={`text-xs font-mono ${ss.text}`}>{ev.metric}</span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Escalate button — only for critical/warning */}
                  {(ev.severity === 'critical' || ev.severity === 'warning') && (
                    <button
                      onClick={() => escalateEvent(ev)}
                      title="Create escalation from this event"
                      className={`flex-shrink-0 opacity-0 group-hover:opacity-100 transition-all text-xs px-2 py-1 rounded-lg border font-semibold ${
                        isEscalated
                          ? 'bg-green-900/60 border-green-700 text-green-300'
                          : 'bg-red-950/60 border-red-800/60 text-red-300 hover:bg-red-900/60'
                      }`}>
                      {isEscalated ? '✓ Escalated' : '⬆ Escalate'}
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── SLA Summary ─────────────────────────────────────────────────────── */}
      {slaBreached > 0 && (
        <div className="bg-orange-950/30 border border-orange-800/40 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <AlertCircle className="w-4 h-4 text-orange-400" />
            <span className="text-xs font-bold text-orange-400 uppercase tracking-wider">SLA Breach Alert</span>
          </div>
          <div className="space-y-1.5">
            {circuits.filter(c => c.uptime < 99.5).map(c => (
              <div key={c.key} className="flex items-center gap-3 text-xs">
                <span className="text-white font-medium">{c.siteName}</span>
                <span className="text-gray-500">·</span>
                <span className="text-gray-400">{c.provider}</span>
                {c.circuitNumber && <span className="text-gray-600 font-mono">#{c.circuitNumber}</span>}
                <span className="text-gray-500">·</span>
                <span className="text-orange-400 font-bold">{c.uptime.toFixed(2)}% uptime (SLA 99.5%)</span>
                <span className="text-red-400 font-mono">
                  −{((99.5 - c.uptime) * 525.6).toFixed(0)}min MTD
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
