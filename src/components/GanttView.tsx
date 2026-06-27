'use client'
import { useMemo } from 'react'
import { Project, WaveConfig, Wave } from '@/lib/types'
import { isSiteDIAReady, isSiteLogisticsReady } from '@/lib/types'

interface Props { project: Project }

const WAVE_COLORS: Record<Wave, { bar: string; text: string; dot: string }> = {
  1: { bar: 'bg-blue-600',   text: 'text-blue-300',   dot: 'bg-blue-500' },
  2: { bar: 'bg-purple-600', text: 'text-purple-300', dot: 'bg-purple-500' },
  3: { bar: 'bg-cyan-600',   text: 'text-cyan-300',   dot: 'bg-cyan-500' },
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 86400000)
}

function daysBetween(a: Date, b: Date) {
  return Math.ceil((b.getTime() - a.getTime()) / 86400000)
}

function pct(n: number, total: number) {
  return total ? Math.round(n / total * 100) : 0
}

export function GanttView({ project }: Props) {
  const waves: WaveConfig[] = project.waves?.length ? project.waves : [
    { wave: 1, label: 'Wave 1' }, { wave: 2, label: 'Wave 2' }, { wave: 3, label: 'Wave 3' },
  ]

  const configuredWaves = waves.filter(w => w.goLiveDate)

  // compute timeline bounds
  const { minDate, maxDate, totalDays } = useMemo(() => {
    const dates = configuredWaves.map(w => new Date(w.goLiveDate!))
    if (!dates.length) return { minDate: new Date(), maxDate: addDays(new Date(), 90), totalDays: 90 }
    const earliest = new Date(Math.min(...dates.map(d => d.getTime())))
    const latest   = new Date(Math.max(...dates.map(d => d.getTime())))
    const min = addDays(earliest, -60)  // 60 days before first go-live
    const max = addDays(latest, 14)     // 14 days after last
    return { minDate: min, maxDate: max, totalDays: daysBetween(min, max) }
  }, [configuredWaves])

  const today = new Date()
  const todayPct = Math.max(0, Math.min(100, daysBetween(minDate, today) / totalDays * 100))

  function xPct(date: Date) {
    return Math.max(0, Math.min(100, daysBetween(minDate, date) / totalDays * 100))
  }

  // Month labels
  const monthLabels = useMemo(() => {
    const labels: { label: string; pct: number }[] = []
    let d = new Date(minDate.getFullYear(), minDate.getMonth(), 1)
    while (d <= maxDate) {
      labels.push({
        label: d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' }),
        pct: xPct(d),
      })
      d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return labels
  }, [minDate, maxDate, totalDays])

  if (!configuredWaves.length) {
    return (
      <div className="card-glow bg-[#070d16] rounded-xl p-8 text-center text-gray-600">
        <p className="text-sm">No go-live dates configured.</p>
        <p className="text-xs mt-1">Set wave dates in the Executive Report tab to see the Gantt chart.</p>
      </div>
    )
  }

  // Milestones per wave (days before go-live)
  const milestones = [
    { label: 'DIA Due',      t: 30, color: 'bg-cyan-500' },
    { label: 'Devices',      t: 14, color: 'bg-orange-500' },
    { label: 'Install',      t: 7,  color: 'bg-yellow-500' },
    { label: 'Go-Live',      t: 0,  color: 'bg-green-500' },
  ]

  return (
    <div className="space-y-6">
      {/* Legend */}
      <div className="flex items-center gap-6 flex-wrap">
        {waves.map(w => (
          <div key={w.wave} className="flex items-center gap-2 text-xs">
            <div className={`w-3 h-3 rounded-sm ${WAVE_COLORS[w.wave].bar}`} />
            <span className="text-gray-300">{w.label}</span>
          </div>
        ))}
        <div className="flex items-center gap-2 text-xs">
          <div className="w-px h-3 bg-white/60" />
          <span className="text-gray-400">Today</span>
        </div>
        {milestones.map(m => (
          <div key={m.label} className="flex items-center gap-1.5 text-xs">
            <div className={`w-2 h-2 rounded-full ${m.color}`} />
            <span className="text-gray-500">T-{m.t}d {m.label}</span>
          </div>
        ))}
      </div>

      {/* Gantt chart area */}
      <div className="card-glow bg-[#070d16] rounded-xl p-5 overflow-x-auto">
        <div className="min-w-[600px]">

          {/* Month axis */}
          <div className="relative h-6 mb-2 ml-32">
            {monthLabels.map((m, i) => (
              <div key={i} className="absolute top-0 text-xs text-gray-600"
                style={{ left: `${m.pct}%` }}>
                {m.label}
              </div>
            ))}
          </div>

          {/* Grid lines + rows */}
          <div className="relative">
            {/* Vertical month lines */}
            {monthLabels.map((m, i) => (
              <div key={i} className="absolute top-0 bottom-0 border-l border-gray-800/40 pointer-events-none"
                style={{ left: `calc(8rem + ${m.pct}% * (100% - 8rem) / 100)` }} />
            ))}

            {/* Today line */}
            <div className="absolute top-0 bottom-0 border-l-2 border-white/30 pointer-events-none z-10"
              style={{ left: `calc(8rem + ${todayPct}% * (100% - 8rem) / 100)` }}>
              <div className="absolute -top-1 -translate-x-1/2 text-xs text-white/60 whitespace-nowrap">Today</div>
            </div>

            {/* Wave rows */}
            {waves.map(w => {
              const goLive = w.goLiveDate ? new Date(w.goLiveDate) : null
              const ws = project.sites.filter(s => s.wave === w.wave)
              const total = ws.length
              const completed  = ws.filter(s => s.status === 'completed').length
              const diaReady   = ws.filter(isSiteDIAReady).length
              const logReady   = ws.filter(isSiteLogisticsReady).length
              const completePct = pct(completed, total)
              const c = WAVE_COLORS[w.wave]

              // Bar starts at today or 60 days before go-live (whichever is earlier), ends at go-live
              const barStart = goLive ? Math.min(xPct(today), xPct(addDays(goLive, -60))) : 0
              const barEnd   = goLive ? xPct(goLive) : 0
              const barWidth = Math.max(0, barEnd - barStart)

              return (
                <div key={w.wave} className="flex items-center gap-0 mb-4">
                  {/* Label */}
                  <div className="w-32 flex-shrink-0 pr-3">
                    <div className={`text-xs font-semibold ${c.text}`}>{w.label}</div>
                    <div className="text-xs text-gray-600">{total} sites · {completePct}%</div>
                  </div>

                  {/* Timeline track */}
                  <div className="flex-1 relative h-10">
                    {/* Track */}
                    <div className="absolute inset-y-2 left-0 right-0 bg-gray-800/60 rounded-full" />

                    {/* Progress fill */}
                    {goLive && barWidth > 0 && (
                      <div className={`absolute inset-y-2 rounded-full ${c.bar} opacity-30`}
                        style={{ left: `${barStart}%`, width: `${barWidth}%` }} />
                    )}

                    {/* Completion fill */}
                    {goLive && barWidth > 0 && completePct > 0 && (
                      <div className={`absolute inset-y-2 rounded-full ${c.bar}`}
                        style={{ left: `${barStart}%`, width: `${barWidth * completePct / 100}%` }} />
                    )}

                    {/* Milestone diamonds */}
                    {goLive && milestones.map(m => {
                      const mDate = addDays(goLive, -m.t)
                      const mx = xPct(mDate)
                      const isPast = mDate < today
                      return (
                        <div key={m.label}
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 group"
                          style={{ left: `${mx}%` }}>
                          <div className={`w-3 h-3 rotate-45 border-2 border-gray-900 ${m.color} ${isPast ? 'opacity-40' : ''}`} />
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 text-xs text-gray-400 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity bg-gray-900 px-1.5 py-0.5 rounded pointer-events-none">
                            {m.label} · {mDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </div>
                        </div>
                      )
                    })}

                    {/* Go-live flag */}
                    {goLive && (
                      <div className="absolute top-0 bottom-0 flex flex-col items-center group"
                        style={{ left: `${xPct(goLive)}%` }}>
                        <div className="w-0.5 h-full bg-green-500/80" />
                        <div className="absolute top-0 -translate-x-0 text-xs text-green-400 whitespace-nowrap font-semibold">
                          🏁 {goLive.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right stats */}
                  <div className="w-24 flex-shrink-0 pl-3 text-right">
                    <div className="text-xs text-gray-400">{completed}/{total} done</div>
                    <div className="text-xs text-gray-600">{diaReady} DIA · {logReady} inst.</div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Per-wave site table */}
      {waves.map(w => {
        const ws = project.sites.filter(s => s.wave === w.wave)
        if (!ws.length) return null
        const c = WAVE_COLORS[w.wave]
        return (
          <div key={w.wave} className="card-glow bg-[#070d16] rounded-xl overflow-hidden">
            <div className={`px-5 py-3 border-b border-gray-800 flex items-center gap-2`}>
              <div className={`w-2 h-2 rounded-full ${c.dot}`} />
              <span className={`text-sm font-semibold ${c.text}`}>{w.label}</span>
              <span className="text-xs text-gray-500">— {ws.length} sites</span>
              {w.goLiveDate && (
                <span className="ml-auto text-xs text-gray-500">
                  Go-Live: {new Date(w.goLiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </span>
              )}
            </div>
            <div className="divide-y divide-gray-800/50">
              {ws.map(s => {
                const statusColor = s.status === 'completed' ? 'text-green-400' : s.status === 'blocked' ? 'text-red-400' : s.status === 'in_progress' ? 'text-blue-400' : 'text-gray-500'
                return (
                  <div key={s.id} className="flex items-center px-5 py-2.5 hover:bg-gray-800/20 transition-colors">
                    <div className="flex-1 min-w-0">
                      <span className="text-sm text-gray-200">{s.name}</span>
                      <span className="text-xs text-gray-600 ml-2">{s.city}, {s.country}</span>
                    </div>
                    <div className="flex items-center gap-4 text-xs">
                      <span className={statusColor}>{s.status.replace('_', ' ')}</span>
                      <span className={isSiteDIAReady(s) ? 'text-green-400' : 'text-gray-600'}>DIA {isSiteDIAReady(s) ? '✓' : '○'}</span>
                      <span className={isSiteLogisticsReady(s) ? 'text-green-400' : 'text-gray-600'}>Inst. {isSiteLogisticsReady(s) ? '✓' : '○'}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {project.sites.filter(s => !s.wave).length > 0 && (
        <div className="text-xs text-yellow-400 flex items-center gap-1 px-1">
          ⚠ {project.sites.filter(s => !s.wave).length} site(s) not assigned to a wave — assign in Sites tab.
        </div>
      )}
    </div>
  )
}
