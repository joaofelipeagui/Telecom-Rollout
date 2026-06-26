'use client'
import { useState } from 'react'
import { Project, Site } from '@/lib/types'
import { updateSite } from '@/lib/store'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { MapPin, CheckCircle, Clock, AlertCircle, Search, Loader2, Zap } from 'lucide-react'

interface Props { project: Project; onUpdate: () => void }

const STATUS_CONFIG = {
  pending:     { icon: Clock,         color: 'text-gray-400',  bg: 'bg-gray-800',     label: 'Pending' },
  in_progress: { icon: Clock,         color: 'text-blue-400',  bg: 'bg-blue-950/50',  label: 'In Progress' },
  completed:   { icon: CheckCircle,   color: 'text-green-400', bg: 'bg-green-950/50', label: 'Completed' },
  blocked:     { icon: AlertCircle,   color: 'text-red-400',   bg: 'bg-red-950/50',   label: 'Blocked' },
}

export function FieldEngineerView({ project, onUpdate }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Site | null>(null)
  const [notes, setNotes] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [aiDesc, setAiDesc] = useState('')

  const filtered = project.sites.filter(s =>
    !search || s.name.toLowerCase().includes(search.toLowerCase()) || s.city.toLowerCase().includes(search.toLowerCase())
  )

  function selectSite(site: Site) {
    setSelected(site)
    setNotes(site.notes || '')
    setAiDesc(site.aiDescription || '')
  }

  function saveNotes() {
    if (!selected) return
    updateSite(project.id, selected.id, { notes })
    onUpdate()
  }

  function markStatus(status: Site['status']) {
    if (!selected) return
    updateSite(project.id, selected.id, { status })
    setSelected({ ...selected, status })
    onUpdate()
  }

  async function analyzeWithAI() {
    if (!selected) return
    setAnalyzing(true)
    try {
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'analyze_site',
          payload: { address: selected.address, city: selected.city, state: selected.state }
        })
      })
      const { result } = await res.json()
      setAiDesc(result)
      updateSite(project.id, selected.id, { aiDescription: result })
      onUpdate()
    } finally { setAnalyzing(false) }
  }

  const myQueue = filtered.filter(s => s.status !== 'completed')
  const done = filtered.filter(s => s.status === 'completed')

  return (
    <div className="flex gap-4 h-full">
      {/* Site list */}
      <div className="w-72 flex-shrink-0 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search sites..."
            className="pl-9 bg-gray-900 border-gray-700 text-white placeholder:text-gray-500 h-9" />
        </div>
        <div className="text-xs text-gray-400 flex gap-3">
          <span className="text-yellow-400">{myQueue.length} to visit</span>
          <span className="text-green-400">{done.length} done</span>
        </div>
        <div className="space-y-1 overflow-auto max-h-[calc(100vh-280px)]">
          {myQueue.map(site => {
            const cfg = STATUS_CONFIG[site.status]
            const Icon = cfg.icon
            return (
              <button key={site.id} onClick={() => selectSite(site)}
                className={`w-full text-left p-3 rounded-lg border transition-all ${
                  selected?.id === site.id ? 'border-orange-500/50 bg-orange-950/20' : 'border-gray-800 bg-gray-900 hover:border-gray-600'
                }`}>
                <div className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${cfg.color} flex-shrink-0`} />
                  <span className="text-xs font-medium text-white truncate">{site.name}</span>
                </div>
                <div className="text-xs text-gray-500 mt-0.5 truncate ml-5">{site.city} — {site.address}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Detail */}
      {selected ? (
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-5 space-y-5 overflow-auto">
          <div>
            <h3 className="text-lg font-semibold text-white">{selected.name}</h3>
            <p className="text-sm text-gray-400 flex items-center gap-1 mt-0.5">
              <MapPin className="w-3.5 h-3.5" />{selected.address}, {selected.city} - {selected.state}
            </p>
          </div>

          {/* Status actions */}
          <div>
            <p className="text-xs text-gray-400 mb-2 font-medium">Site Status</p>
            <div className="flex gap-2">
              {(['in_progress', 'completed', 'blocked'] as Site['status'][]).map(s => {
                const cfg = STATUS_CONFIG[s]
                return (
                  <button key={s} onClick={() => markStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                      selected.status === s
                        ? `${cfg.bg} ${cfg.color} border-current`
                        : 'bg-gray-800 text-gray-400 border-gray-700 hover:border-gray-500'
                    }`}>
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* AI analysis */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-gray-400 font-medium">AI Site Brief</p>
              <Button size="sm" variant="outline" onClick={analyzeWithAI} disabled={analyzing}
                className="h-6 text-xs border-gray-700 text-gray-300 px-2">
                {analyzing ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3 mr-1" />}
                {analyzing ? 'Analyzing...' : 'Get AI Brief'}
              </Button>
            </div>
            {aiDesc
              ? <p className="text-xs text-gray-300 bg-gray-800 rounded-lg p-3 leading-relaxed">{aiDesc}</p>
              : <p className="text-xs text-gray-600 italic">Get an AI analysis of this site before your visit.</p>
            }
          </div>

          {/* Field notes */}
          <div>
            <p className="text-xs text-gray-400 font-medium mb-2">Field Notes</p>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Access instructions, contacts, observations..."
              className="bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 text-sm resize-none"
              rows={4} />
            <Button size="sm" onClick={saveNotes} className="mt-2 bg-orange-600 hover:bg-orange-700 h-7 text-xs">
              Save Notes
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-600">
          <div className="text-center">
            <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Select a site to view details</p>
          </div>
        </div>
      )}
    </div>
  )
}
