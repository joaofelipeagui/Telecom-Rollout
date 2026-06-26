'use client'
import { useState } from 'react'
import { Project, PROVIDERS, Provider, DIAStatus } from '@/lib/types'
import { updateSiteDIA } from '@/lib/store'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'

const STATUS_ICONS: Record<DIAStatus, string> = {
  not_requested: '—',
  requested: '📤',
  received: '📥',
  confirmed: '✅',
  diverse_confirmed: '🛡️',
}

const STATUS_BG: Record<DIAStatus, string> = {
  not_requested: 'bg-gray-900',
  requested: 'bg-yellow-950/50',
  received: 'bg-blue-950/50',
  confirmed: 'bg-green-950/50',
  diverse_confirmed: 'bg-emerald-950/50',
}

interface Props {
  project: Project
  onUpdate: () => void
}

export function DIAMatrix({ project, onUpdate }: Props) {
  const [editCell, setEditCell] = useState<{ siteId: string; provider: Provider } | null>(null)

  return (
    <div className="overflow-auto">
      <div className="mb-3 flex gap-4 text-xs text-gray-400">
        {Object.entries(STATUS_ICONS).map(([k, v]) => (
          <span key={k}>{v} {k.replace('_', ' ')}</span>
        ))}
      </div>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-gray-800">
            <th className="text-left py-2 px-3 text-gray-400 font-medium w-64">Site</th>
            {PROVIDERS.map(p => (
              <th key={p} className="py-2 px-3 text-gray-400 font-medium text-center">{p}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {project.sites.map(site => (
            <tr key={site.id} className="border-b border-gray-800/50 hover:bg-gray-900/50">
              <td className="py-2 px-3">
                <div className="font-medium text-white text-xs truncate max-w-[200px]">{site.name}</div>
                <div className="text-gray-500 text-xs truncate">{site.city}</div>
              </td>
              {PROVIDERS.map(provider => {
                const dia = site.dias[provider]
                const status: DIAStatus = dia?.status || 'not_requested'
                const isEditing = editCell?.siteId === site.id && editCell?.provider === provider

                return (
                  <td key={provider} className={`py-1 px-2 text-center ${STATUS_BG[status]}`}>
                    {isEditing ? (
                      <div className="flex flex-col gap-1 min-w-[120px]">
                        <Select
                          value={status}
                          onValueChange={(v) => {
                            updateSiteDIA(project.id, site.id, provider, { status: v as DIAStatus })
                            onUpdate()
                          }}
                        >
                          <SelectTrigger className="h-6 text-xs bg-gray-800 border-gray-700 text-white">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-900 border-gray-700">
                            {(['not_requested', 'requested', 'received', 'confirmed', 'diverse_confirmed'] as DIAStatus[]).map(s => (
                              <SelectItem key={s} value={s} className="text-xs text-white">
                                {STATUS_ICONS[s]} {s.replace(/_/g, ' ')}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Input
                          placeholder="Circuit #"
                          defaultValue={dia?.circuitNumber || ''}
                          onBlur={e => {
                            updateSiteDIA(project.id, site.id, provider, { circuitNumber: e.target.value })
                            onUpdate()
                            setEditCell(null)
                          }}
                          className="h-6 text-xs bg-gray-800 border-gray-700 text-white"
                          autoFocus
                        />
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditCell({ siteId: site.id, provider })}
                        className="w-full text-center hover:opacity-80 transition-opacity"
                        title={dia?.circuitNumber || 'Click to edit'}
                      >
                        <div className="text-base">{STATUS_ICONS[status]}</div>
                        {dia?.circuitNumber && (
                          <div className="text-xs text-gray-400 truncate max-w-[80px] mx-auto">{dia.circuitNumber}</div>
                        )}
                      </button>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
