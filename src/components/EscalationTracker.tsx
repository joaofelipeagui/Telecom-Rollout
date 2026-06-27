'use client'
import { useState } from 'react'
import { Project, Escalation } from '@/lib/types'
import { addEscalation, updateEscalation, saveProject, getProject } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertTriangle, Plus, CheckCircle, Clock, ChevronDown, ChevronRight, X } from 'lucide-react'

const PRIORITY_COLOR: Record<Escalation['priority'], string> = {
  low:      'bg-gray-700 text-gray-300',
  medium:   'bg-yellow-900/60 text-yellow-300',
  high:     'bg-orange-900/60 text-orange-300',
  critical: 'bg-red-900/60 text-red-300',
}
const STATUS_ICON: Record<Escalation['status'], React.ReactNode> = {
  open:        <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
  in_progress: <Clock className="w-3.5 h-3.5 text-yellow-400" />,
  resolved:    <CheckCircle className="w-3.5 h-3.5 text-green-400" />,
}

interface Props {
  project: Project
  onUpdate: () => void
  readonly?: boolean
}

type EscForm = { siteId: string; siteName: string; title: string; description: string; priority: Escalation['priority']; status: Escalation['status']; assignedTo: string; dueDate: string }
const EMPTY: EscForm = { siteId: '', siteName: '', title: '', description: '', priority: 'high', status: 'open', assignedTo: '', dueDate: '' }

export function EscalationTracker({ project, onUpdate, readonly }: Props) {
  const [form, setForm] = useState<EscForm>(EMPTY)
  const [adding, setAdding] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [resolution, setResolution] = useState('')

  const escalations = project.escalations ?? []
  const open = escalations.filter(e => e.status !== 'resolved')
  const resolved = escalations.filter(e => e.status === 'resolved')

  function submit() {
    if (!form.title) return
    addEscalation(project.id, {
      ...form,
      siteName: form.siteId
        ? project.sites.find(s => s.id === form.siteId)?.name ?? form.siteId
        : 'Project-level',
    })
    setForm(EMPTY)
    setAdding(false)
    onUpdate()
  }

  function resolve(id: string) {
    updateEscalation(project.id, id, {
      status: 'resolved',
      resolution,
      resolvedAt: new Date().toISOString(),
    })
    setResolution('')
    setExpanded(null)
    onUpdate()
  }

  function changeStatus(id: string, status: Escalation['status']) {
    updateEscalation(project.id, id, { status })
    onUpdate()
  }

  function EscCard({ esc }: { esc: Escalation }) {
    const isOpen = expanded === esc.id
    const overdue = esc.dueDate && new Date(esc.dueDate) < new Date() && esc.status !== 'resolved'
    return (
      <div className={`card-glow rounded-xl overflow-hidden ${esc.status === 'resolved' ? 'opacity-60' : ''}`}>
        <button
          className="w-full flex items-start gap-3 p-4 text-left hover:bg-gray-800/30 transition-colors"
          onClick={() => setExpanded(isOpen ? null : esc.id)}
        >
          <div className="mt-0.5">{STATUS_ICON[esc.status]}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-white">{esc.title}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PRIORITY_COLOR[esc.priority]}`}>
                {esc.priority}
              </span>
              {overdue && <span className="text-xs text-red-400 font-semibold">OVERDUE</span>}
            </div>
            <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
              <span>{esc.siteName}</span>
              {esc.assignedTo && <span>→ {esc.assignedTo}</span>}
              {esc.dueDate && <span>Due {new Date(esc.dueDate).toLocaleDateString()}</span>}
              <span>{new Date(esc.raisedAt).toLocaleDateString()} · {esc.raisedBy}</span>
            </div>
          </div>
          {isOpen ? <ChevronDown className="w-4 h-4 text-gray-500 flex-shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-500 flex-shrink-0" />}
        </button>

        {isOpen && (
          <div className="px-4 pb-4 border-t border-gray-800 pt-3 space-y-3">
            <p className="text-sm text-gray-300 leading-relaxed">{esc.description}</p>

            {esc.status === 'resolved' && esc.resolution && (
              <div className="bg-green-950/30 border border-green-800/30 rounded-lg p-3">
                <p className="text-xs font-semibold text-green-400 mb-1">Resolution</p>
                <p className="text-xs text-gray-300">{esc.resolution}</p>
                {esc.resolvedAt && <p className="text-xs text-gray-600 mt-1">{new Date(esc.resolvedAt).toLocaleDateString()}</p>}
              </div>
            )}

            {!readonly && esc.status !== 'resolved' && (
              <div className="flex gap-2 flex-wrap">
                {esc.status === 'open' && (
                  <Button size="sm" variant="outline" onClick={() => changeStatus(esc.id, 'in_progress')}
                    className="border-yellow-700 text-yellow-300 h-7 text-xs">
                    Mark In Progress
                  </Button>
                )}
                <div className="flex gap-2 flex-1">
                  <Input
                    placeholder="Resolution notes…"
                    value={resolution}
                    onChange={e => setResolution(e.target.value)}
                    className="h-7 text-xs bg-gray-800 border-gray-700 text-white flex-1"
                  />
                  <Button size="sm" onClick={() => resolve(esc.id)} disabled={!resolution}
                    className="bg-green-700 hover:bg-green-600 h-7 text-xs">
                    Resolve
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex gap-2 text-xs">
            <span className="bg-red-900/50 text-red-300 px-2 py-1 rounded-full">{open.length} open</span>
            <span className="bg-gray-800 text-gray-400 px-2 py-1 rounded-full">{resolved.length} resolved</span>
          </div>
        </div>
        {!readonly && (
          <Button size="sm" onClick={() => setAdding(a => !a)} className="bg-red-700 hover:bg-red-600 h-8 text-xs gap-1">
            <Plus className="w-3.5 h-3.5" /> Raise Escalation
          </Button>
        )}
      </div>

      {/* New escalation form */}
      {adding && (
        <div className="card-glow bg-[#070d16] rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between mb-1">
            <p className="text-sm font-semibold text-white">New Escalation</p>
            <button onClick={() => setAdding(false)}><X className="w-4 h-4 text-gray-500" /></button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label block mb-1">Site (optional)</label>
              <Select value={form.siteId || 'none'} onValueChange={v => v && setForm({ ...form, siteId: v === 'none' ? '' : v })}>
                <SelectTrigger className="h-8 text-xs bg-gray-800 border-gray-700 text-white">
                  <SelectValue placeholder="Project-level" />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700 max-h-48">
                  <SelectItem value="none" className="text-gray-400 text-xs">Project-level</SelectItem>
                  {project.sites.filter(s => s.status === 'blocked' || s.status === 'in_progress').map(s => (
                    <SelectItem key={s.id} value={s.id} className="text-white text-xs">{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-label block mb-1">Priority</label>
              <Select value={form.priority} onValueChange={v => v && setForm({ ...form, priority: v as Escalation['priority'] })}>
                <SelectTrigger className="h-8 text-xs bg-gray-800 border-gray-700 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-gray-900 border-gray-700">
                  {(['low','medium','high','critical'] as const).map(p => (
                    <SelectItem key={p} value={p} className="text-white text-xs capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <label className="text-label block mb-1">Title</label>
            <Input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Claro missing circuit number for 3 sites"
              className="h-8 text-xs bg-gray-800 border-gray-700 text-white" />
          </div>
          <div>
            <label className="text-label block mb-1">Description</label>
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}
              placeholder="Context, impact, what's needed…"
              rows={3}
              className="w-full text-xs bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-2 resize-none focus:outline-none focus:border-blue-500" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-label block mb-1">Assigned To</label>
              <Input value={form.assignedTo} onChange={e => setForm({ ...form, assignedTo: e.target.value })}
                placeholder="Name or team"
                className="h-8 text-xs bg-gray-800 border-gray-700 text-white" />
            </div>
            <div>
              <label className="text-label block mb-1">Due Date</label>
              <Input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                className="h-8 text-xs bg-gray-800 border-gray-700 text-white" />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button size="sm" variant="outline" onClick={() => setAdding(false)} className="border-gray-700 text-gray-300 h-8 text-xs">Cancel</Button>
            <Button size="sm" onClick={submit} disabled={!form.title} className="bg-red-700 hover:bg-red-600 h-8 text-xs">Raise</Button>
          </div>
        </div>
      )}

      {/* Open escalations */}
      {open.length > 0 && (
        <div className="space-y-2">
          {open.map(e => <EscCard key={e.id} esc={e} />)}
        </div>
      )}

      {/* Resolved */}
      {resolved.length > 0 && (
        <div>
          <p className="text-label mb-2 mt-4">Resolved ({resolved.length})</p>
          <div className="space-y-2">
            {resolved.map(e => <EscCard key={e.id} esc={e} />)}
          </div>
        </div>
      )}

      {escalations.length === 0 && !adding && (
        <div className="text-center py-12 text-gray-600">
          <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">No escalations raised.</p>
          <p className="text-xs mt-1">Use escalations to formally track blockers with ownership and due dates.</p>
        </div>
      )}
    </div>
  )
}
