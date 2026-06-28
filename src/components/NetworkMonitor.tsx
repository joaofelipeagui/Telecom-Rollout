'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Project, Provider, PROVIDERS } from '@/lib/types'
import {
  Activity, Wifi, WifiOff, AlertTriangle, CheckCircle,
  Pause, Play, Trash2, Filter, Radio, TrendingUp, TrendingDown, Minus
} from 'lucide-react'
import { Button } from '@/components/ui/button'

// ── Types ─────────────────────────────────────────────────────────────────────
type Severity = 'critical' | 'warning' | 'info' | 'resolved'
type EventType =
  | 'link_down' | 'link_up'
  | 'high_latency' | 'latency_ok'
  | 'jitter_alert' | 'packet_loss'
  | 'bgp_down' | 'bgp_up'
  | 'interface_error' | 'recovered'

interface NetEvent {
  id: string
  ts: Date
  siteId: string
  siteName: string
  country: string
  provider: string
  type: EventType
  severity: Severity
  message: string
  metric?: string
}

interface SiteHealth {
  siteId: string
  siteName: string
  country: string
  provider: string
  state: 'up' | 'degraded' | 'down'
  latency: number    // ms
  jitter: number     // ms
  loss: number       // %
  uptime: number     // %
  stability: number  // 0-1 internal bias
}

// ── Simulation config ─────────────────────────────────────────────────────────
const EVENT_INTERVAL_MS = 2800

const EVENT_TEMPLATES: Record<EventType, { severity: Severity; msgFn: (h: SiteHealth) => string; metricFn?: (h: SiteHealth) => string }> = {
  link_down:      { severity: 'critical',  msgFn: h => `Link DOWN on ${h.provider} circuit — no carrier signal`,          metricFn: _ => 'Loss: 100%' },
  link_up:        { severity: 'resolved',  msgFn: h => `Link UP restored on ${h.provider}`,                                metricFn: _ => 'Loss: 0%' },
  high_latency:   { severity: 'warning',   msgFn: h => `High latency detected on ${h.provider} path`,                     metricFn: h => `RTT: ${h.latency}ms (threshold 80ms)` },
  latency_ok:     { severity: 'info',      msgFn: h => `Latency normalised on ${h.provider}`,                             metricFn: h => `RTT: ${h.latency}ms` },
  jitter_alert:   { severity: 'warning',   msgFn: h => `Jitter exceeds threshold on ${h.provider} — VoIP impact possible`, metricFn: h => `Jitter: ${h.jitter}ms (threshold 20ms)` },
  packet_loss:    { severity: 'warning',   msgFn: h => `Packet loss detected — ${h.provider} circuit unstable`,            metricFn: h => `Loss: ${h.loss.toFixed(1)}%` },
  bgp_down:       { severity: 'critical',  msgFn: h => `BGP session dropped with ${h.provider} peer`,                     metricFn: _ => 'AS path lost' },
  bgp_up:         { severity: 'resolved',  msgFn: h => `BGP session re-established with ${h.provider}`,                   metricFn: _ => 'Routes received' },
  interface_error:{ severity: 'warning',   msgFn: h => `Interface CRC errors on ${h.provider} WAN port`,                  metricFn: _ => 'CRC errors: ↑' },
  recovered:      { severity: 'resolved',  msgFn: h => `Circuit fully recovered — ${h.provider} performing normally`,     metricFn: h => `RTT: ${h.latency}ms · Loss: 0%` },
}

const SEVERITY_STYLE: Record<Severity, { row: string; badge: string; text: string; dot: string }> = {
  critical: { row: 'bg-red-950/30 border-red-800/30',    badge: 'bg-red-900 text-red-300',    text: 'text-red-400',    dot: 'bg-red-500' },
  warning:  { row: 'bg-orange-950/20 border-orange-800/20', badge: 'bg-orange-900 text-orange-300', text: 'text-orange-400', dot: 'bg-orange-400' },
  info:     { row: 'bg-gray-900/40 border-gray-800/20',  badge: 'bg-gray-800 text-gray-300',  text: 'text-gray-400',   dot: 'bg-gray-500' },
  resolved: { row: 'bg-green-950/20 border-green-800/20',badge: 'bg-green-900 text-green-300',text: 'text-green-400',  dot: 'bg-green-500' },
}

const STATE_STYLE: Record<SiteHealth['state'], { label: string; text: string; bg: string; dot: string }> = {
  up:       { label: 'UP',       text: 'text-green-400',  bg: 'bg-green-950/40 border-green-800/30', dot: 'bg-green-400 dot-green' },
  degraded: { label: 'DEGRADED', text: 'text-yellow-400', bg: 'bg-yellow-950/30 border-yellow-800/30', dot: 'bg-yellow-400' },
  down:     { label: 'DOWN',     text: 'text-red-400',    bg: 'bg-red-950/40 border-red-800/30', dot: 'bg-red-500 dot-red' },
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function rand(min: number, max: number) { return Math.random() * (max - min) + min }
function randInt(min: number, max: number) { return Math.floor(rand(min, max + 1)) }
function pickRand<T>(arr: T[]): T { return arr[Math.floor(Math.random() * arr.length)] }

function buildSiteHealths(project: Project): SiteHealth[] {
  return project.sites.slice(0, 30).map(site => {
    const providers = Object.keys(site.dias) as Provider[]
    const provider  = providers.length > 0 ? providers[0] : (PROVIDERS[0] as Provider)
    const stability = Math.random()
    const state: SiteHealth['state'] = stability > 0.85 ? 'down' : stability > 0.65 ? 'degraded' : 'up'
    return {
      siteId:   site.id,
      siteName: site.name,
      country:  site.country,
      provider,
      state,
      stability,
      latency: state === 'down' ? 999 : state === 'degraded' ? randInt(90, 280) : randInt(8, 55),
      jitter:  state === 'down' ? 999 : state === 'degraded' ? randInt(25, 80)  : randInt(1, 12),
      loss:    state === 'down' ? 100  : state === 'degraded' ? rand(1, 8)      : rand(0, 0.3),
      uptime:  state === 'down' ? rand(70, 88) : state === 'degraded' ? rand(92, 98) : rand(99, 99.99),
    }
  })
}

function generateEvent(healths: SiteHealth[]): NetEvent {
  // Weighted: pick degraded/down sites more often
  const weighted = [
    ...healths.filter(h => h.state === 'down').flatMap(h => [h, h, h, h]),
    ...healths.filter(h => h.state === 'degraded').flatMap(h => [h, h]),
    ...healths.filter(h => h.state === 'up'),
  ]
  const site = pickRand(weighted.length > 0 ? weighted : healths)

  // Event pool weighted by site state
  let typePool: EventType[]
  if (site.state === 'down') {
    typePool = ['link_down', 'bgp_down', 'link_down', 'packet_loss', 'bgp_up', 'link_up']
  } else if (site.state === 'degraded') {
    typePool = ['high_latency', 'jitter_alert', 'packet_loss', 'interface_error', 'high_latency', 'latency_ok']
  } else {
    typePool = ['latency_ok', 'recovered', 'latency_ok', 'latency_ok', 'high_latency', 'jitter_alert']
  }
  const type = pickRand(typePool)
  const tmpl = EVENT_TEMPLATES[type]

  // Jitter metric values a bit
  const jitteredHealth = {
    ...site,
    latency: site.latency + randInt(-8, 15),
    jitter:  Math.max(0, site.jitter + randInt(-3, 8)),
    loss:    Math.max(0, site.loss + rand(-0.2, 0.5)),
  }

  return {
    id:       `${Date.now()}_${Math.random()}`,
    ts:       new Date(),
    siteId:   site.siteId,
    siteName: site.siteName,
    country:  site.country,
    provider: site.provider,
    type,
    severity: tmpl.severity,
    message:  tmpl.msgFn(jitteredHealth),
    metric:   tmpl.metricFn?.(jitteredHealth),
  }
}

function fmt(d: Date) {
  return d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

// ── Component ─────────────────────────────────────────────────────────────────
const MAX_EVENTS = 120
type FilterType = 'all' | Severity

interface Props { project: Project }

export function NetworkMonitor({ project }: Props) {
  const [healths]  = useState<SiteHealth[]>(() => buildSiteHealths(project))
  const [events,  setEvents]  = useState<NetEvent[]>([])
  const [paused,  setPaused]  = useState(false)
  const [filter,  setFilter]  = useState<FilterType>('all')
  const feedRef   = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  pausedRef.current = paused

  // Auto-scroll to top (newest events)
  const scrollTop = useCallback(() => {
    if (feedRef.current) feedRef.current.scrollTop = 0
  }, [])

  useEffect(() => {
    // Seed with 8 initial events
    const seed: NetEvent[] = []
    for (let i = 0; i < 8; i++) seed.push(generateEvent(healths))
    setEvents(seed)

    const timer = setInterval(() => {
      if (pausedRef.current) return
      setEvents(prev => {
        const next = [generateEvent(healths), ...prev].slice(0, MAX_EVENTS)
        return next
      })
      scrollTop()
    }, EVENT_INTERVAL_MS)

    return () => clearInterval(timer)
  }, [healths, scrollTop])

  const filtered = filter === 'all' ? events : events.filter(e => e.severity === filter)

  const counts = {
    critical: events.filter(e => e.severity === 'critical').length,
    warning:  events.filter(e => e.severity === 'warning').length,
    resolved: events.filter(e => e.severity === 'resolved').length,
    info:     events.filter(e => e.severity === 'info').length,
  }

  const sitesDown     = healths.filter(h => h.state === 'down').length
  const sitesDegraded = healths.filter(h => h.state === 'degraded').length
  const sitesUp       = healths.filter(h => h.state === 'up').length

  return (
    <div className="space-y-5">

      {/* Demo notice */}
      <div className="flex items-center gap-3 bg-blue-950/40 border border-blue-800/40 rounded-xl px-4 py-2.5">
        <Radio className="w-4 h-4 text-blue-400 flex-shrink-0 animate-pulse" />
        <p className="text-xs text-blue-200">
          <span className="font-semibold">Simulated live feed</span> — events are generated to demonstrate integration with monitoring platforms (ThousandEyes, Meraki, Zabbix, PRTG). In production, connect via the <span className="font-mono text-blue-300">/api/events</span> webhook.
        </p>
      </div>

      {/* Site health summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Sites Up',       value: sitesUp,       icon: CheckCircle, color: 'text-green-400',  bg: 'bg-green-950/30 border-green-800/30' },
          { label: 'Degraded',       value: sitesDegraded, icon: AlertTriangle, color: 'text-yellow-400', bg: 'bg-yellow-950/30 border-yellow-800/30' },
          { label: 'Down / No Signal', value: sitesDown,   icon: WifiOff,     color: 'text-red-400',    bg: 'bg-red-950/30 border-red-800/30' },
        ].map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className={`rounded-xl border px-4 py-3 ${bg}`}>
            <div className="flex items-center gap-2 mb-1">
              <Icon className={`w-4 h-4 ${color}`} />
              <span className={`text-xs font-semibold ${color}`}>{label}</span>
            </div>
            <div className={`text-3xl font-bold ${color}`}>{value}</div>
            <div className="text-xs text-gray-500 mt-0.5">of {healths.length} monitored</div>
          </div>
        ))}
      </div>

      {/* Site health grid */}
      <div>
        <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mb-2">Circuit Health — Per Site</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {healths.map(h => {
            const ss = STATE_STYLE[h.state]
            return (
              <div key={h.siteId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${ss.bg}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 ${ss.dot}`} />
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-white truncate">{h.siteName}</div>
                  <div className="text-xs text-gray-500">{h.country} · {h.provider}</div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0 text-xs">
                  <span className={`font-semibold ${ss.text}`}>{ss.label}</span>
                  {h.state !== 'down' && (
                    <>
                      <span className="text-gray-500">{h.latency}ms</span>
                      <span className="text-gray-600">{h.jitter}ms j</span>
                      {h.loss > 0.1 && <span className="text-orange-400">{h.loss.toFixed(1)}% loss</span>}
                    </>
                  )}
                  <span className="text-gray-600">{h.uptime.toFixed(2)}%</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Event feed controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs text-gray-500 font-semibold uppercase tracking-wider mr-1">Filter:</span>
          {(['all', 'critical', 'warning', 'resolved', 'info'] as FilterType[]).map(f => (
            <button key={f}
              onClick={() => setFilter(f)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                filter === f
                  ? f === 'critical' ? 'bg-red-900 border-red-700 text-red-200'
                  : f === 'warning'  ? 'bg-orange-900 border-orange-700 text-orange-200'
                  : f === 'resolved' ? 'bg-green-900 border-green-700 text-green-200'
                  : f === 'info'     ? 'bg-gray-700 border-gray-600 text-gray-200'
                  : 'bg-blue-900 border-blue-700 text-blue-200'
                  : 'bg-gray-900 border-gray-700 text-gray-400 hover:border-gray-500'
              }`}>
              {f === 'all' ? `All (${events.length})` : `${f} (${counts[f as Severity] ?? 0})`}
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

      {/* Live event feed */}
      <div className="card-glow bg-[#070d16] rounded-xl overflow-hidden">
        {/* Feed header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-gray-800 bg-[#0a0f1a]">
          <Activity className="w-4 h-4 text-blue-400" />
          <span className="text-xs font-semibold text-gray-300">Live Event Feed</span>
          {!paused && (
            <span className="flex items-center gap-1 ml-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-green-400">LIVE</span>
            </span>
          )}
          {paused && <span className="text-xs text-yellow-400 ml-1">PAUSED</span>}
          <span className="ml-auto text-xs text-gray-600">{filtered.length} events</span>
        </div>

        {/* Event rows */}
        <div ref={feedRef} className="overflow-y-auto max-h-[420px]">
          {filtered.length === 0 && (
            <div className="flex items-center justify-center py-12 text-gray-600 text-sm">
              No events yet…
            </div>
          )}
          {filtered.map((ev, i) => {
            const ss = SEVERITY_STYLE[ev.severity]
            return (
              <div key={ev.id}
                className={`flex items-start gap-3 px-4 py-2.5 border-b border-gray-800/40 last:border-0 transition-all ${ss.row}
                  ${i === 0 && !paused ? 'animate-in fade-in slide-in-from-top-1 duration-300' : ''}`}>
                <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1.5 ${ss.dot}`} />
                <div className="w-20 flex-shrink-0 text-xs text-gray-500 mt-0.5 font-mono">{fmt(ev.ts)}</div>
                <div className={`w-16 flex-shrink-0`}>
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
                    {ev.metric && (
                      <>
                        <span className="text-gray-700">·</span>
                        <span className={`text-xs font-mono ${ss.text}`}>{ev.metric}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
