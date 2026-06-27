'use client'
import { useState } from 'react'
import { Site, ChecklistItem, DEFAULT_CHECKLIST } from '@/lib/types'
import { updateSiteChecklist } from '@/lib/store'
import { getCurrentUser } from '@/lib/user'
import { CheckCircle, Circle } from 'lucide-react'

const CATEGORY_LABELS: Record<ChecklistItem['category'], string> = {
  pre_survey:   'Pre-Survey',
  installation: 'Installation',
  connectivity: 'Connectivity',
  handover:     'Hand-Over',
}
const CATEGORY_COLORS: Record<ChecklistItem['category'], string> = {
  pre_survey:   'text-yellow-400',
  installation: 'text-orange-400',
  connectivity: 'text-blue-400',
  handover:     'text-green-400',
}

interface Props {
  site: Site
  projectId: string
  onUpdate: () => void
  readonly?: boolean
}

export function SiteChecklist({ site, projectId, onUpdate, readonly }: Props) {
  const items: ChecklistItem[] = site.checklist?.length ? site.checklist
    : DEFAULT_CHECKLIST.map(d => ({ ...d }))

  const done  = items.filter(i => i.done).length
  const total = items.length
  const pct   = Math.round((done / total) * 100)

  function toggle(id: string) {
    if (readonly) return
    const user = getCurrentUser()?.name ?? 'Unknown'
    const updated = items.map(i => i.id === id
      ? { ...i, done: !i.done, doneBy: !i.done ? user : undefined, doneAt: !i.done ? new Date().toISOString() : undefined }
      : i
    )
    updateSiteChecklist(projectId, site.id, updated)
    onUpdate()
  }

  const categories: ChecklistItem['category'][] = ['pre_survey', 'installation', 'connectivity', 'handover']

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div>
        <div className="flex justify-between text-xs mb-1">
          <span className="text-gray-400">Readiness</span>
          <span className="text-white font-semibold">{done}/{total} ({pct}%)</span>
        </div>
        <div className="bg-gray-800 rounded-full h-2">
          <div className={`h-2 rounded-full transition-all duration-500 ${pct === 100 ? 'bg-green-500' : pct > 60 ? 'bg-blue-500' : 'bg-yellow-500'}`}
            style={{ width: `${pct}%` }} />
        </div>
      </div>

      {categories.map(cat => {
        const catItems = items.filter(i => i.category === cat)
        const catDone  = catItems.filter(i => i.done).length
        return (
          <div key={cat}>
            <div className={`text-xs font-semibold uppercase tracking-wider mb-2 flex items-center justify-between ${CATEGORY_COLORS[cat]}`}>
              <span>{CATEGORY_LABELS[cat]}</span>
              <span className="text-gray-600 normal-case font-normal">{catDone}/{catItems.length}</span>
            </div>
            <div className="space-y-1">
              {catItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => toggle(item.id)}
                  disabled={readonly}
                  className={`w-full flex items-start gap-2.5 px-3 py-2 rounded-lg text-left transition-colors
                    ${item.done ? 'bg-green-950/30' : 'bg-gray-900/60 hover:bg-gray-800/60'}
                    ${readonly ? 'cursor-default' : 'cursor-pointer'}`}
                >
                  {item.done
                    ? <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
                    : <Circle className="w-4 h-4 text-gray-600 flex-shrink-0 mt-0.5" />
                  }
                  <div className="flex-1 min-w-0">
                    <span className={`text-xs ${item.done ? 'text-green-400 line-through opacity-70' : 'text-gray-200'}`}>
                      {item.label}
                    </span>
                    {item.done && item.doneBy && (
                      <p className="text-xs text-gray-600 mt-0.5">
                        {item.doneBy} · {item.doneAt ? new Date(item.doneAt).toLocaleDateString() : ''}
                      </p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
