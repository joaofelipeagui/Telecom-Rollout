'use client'
import { Project } from '@/lib/types'
import { Clock } from 'lucide-react'

interface Props { project: Project }

export function ChangeLog({ project }: Props) {
  const entries = project.changelog ?? []

  if (!entries.length) {
    return (
      <div className="text-center py-12 text-gray-600">
        <Clock className="w-8 h-8 mx-auto mb-2 opacity-30" />
        <p className="text-sm">No changes recorded yet.</p>
        <p className="text-xs mt-1">Status updates and DIA changes will appear here automatically.</p>
      </div>
    )
  }

  // Group by date
  const grouped: Record<string, typeof entries> = {}
  for (const e of entries) {
    const day = new Date(e.changedAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })
    grouped[day] = [...(grouped[day] ?? []), e]
  }

  return (
    <div className="space-y-6">
      {Object.entries(grouped).map(([day, dayEntries]) => (
        <div key={day}>
          <p className="text-label mb-3">{day}</p>
          <div className="space-y-1">
            {dayEntries.map(e => (
              <div key={e.id} className="flex items-start gap-3 py-2.5 px-4 rounded-lg hover:bg-gray-900/40 transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-blue-500 mt-1.5 flex-shrink-0 dot-blue" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    {e.siteName && (
                      <span className="text-xs font-semibold text-white">{e.siteName}</span>
                    )}
                    <span className="text-xs text-gray-400">
                      {e.field}
                      {e.oldValue ? <span className="text-gray-600"> · <span className="line-through">{e.oldValue}</span> → </span> : ' → '}
                      <span className="text-gray-200">{e.newValue}</span>
                    </span>
                  </div>
                  <div className="text-xs text-gray-600 mt-0.5">
                    {e.changedBy} · {new Date(e.changedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
