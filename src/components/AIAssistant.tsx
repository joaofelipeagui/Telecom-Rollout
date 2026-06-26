'use client'
import { useState } from 'react'
import { Project, PROVIDERS } from '@/lib/types'
import { getSiteStats } from '@/lib/store'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Bot, Send, Loader2, FileText, Zap } from 'lucide-react'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface Props {
  project: Project
}

function buildProjectSummary(project: Project) {
  const stats = getSiteStats(project.sites)
  const diaByProvider: Record<string, { total: number; confirmed: number; missing: string[] }> = {}

  for (const p of PROVIDERS) {
    const sites = project.sites
    const total = sites.length
    const confirmed = sites.filter(s => {
      const d = s.dias[p]
      return d && (d.status === 'confirmed' || d.status === 'diverse_confirmed')
    }).length
    const missing = sites
      .filter(s => !s.dias[p] || s.dias[p]!.status === 'not_requested')
      .slice(0, 5)
      .map(s => s.name)
    diaByProvider[p] = { total, confirmed, missing }
  }

  return {
    project: project.name,
    customer: project.customer,
    stats,
    diaByProvider,
    blockedSites: project.sites.filter(s => s.status === 'blocked').map(s => s.name).slice(0, 10),
    recentSites: project.sites.slice(-5).map(s => ({ name: s.name, city: s.city, status: s.status })),
  }
}

const QUICK_PROMPTS = [
  'Which sites are blocked and why?',
  'Which providers have the most missing DIA circuits?',
  'Generate a weekly status report',
  'What are the top 5 next actions for this project?',
]

export function AIAssistant({ project }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  async function send(question: string) {
    if (!question.trim() || loading) return
    const q = question.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: q }])
    setLoading(true)

    try {
      const isReport = q.toLowerCase().includes('report')
      const res = await fetch('/api/ai', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: isReport ? 'status_report' : 'query',
          payload: {
            question: q,
            projectData: buildProjectSummary(project),
          }
        })
      })
      const { result } = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: result }])
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-[600px] bg-gray-900 rounded-xl border border-gray-800">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-800">
        <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center">
          <Bot className="w-4 h-4 text-blue-400" />
        </div>
        <div>
          <div className="text-sm font-semibold text-white">AI Project Assistant</div>
          <div className="text-xs text-gray-400">Ask anything about {project.name}</div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Zap className="w-10 h-10 text-blue-500/30 mx-auto mb-3" />
            <p className="text-gray-400 text-sm mb-6">Ask me about sites, DIA circuits, blockers, or generate a status report.</p>
            <div className="grid grid-cols-2 gap-2 max-w-lg mx-auto">
              {QUICK_PROMPTS.map(prompt => (
                <button
                  key={prompt}
                  onClick={() => send(prompt)}
                  className="text-left text-xs bg-gray-800 hover:bg-gray-750 border border-gray-700 hover:border-blue-500/50 rounded-lg p-3 text-gray-300 transition-all"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] rounded-xl px-4 py-3 text-sm ${
              msg.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-200'
            }`}>
              <pre className="whitespace-pre-wrap font-sans">{msg.content}</pre>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-gray-800 rounded-xl px-4 py-3 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
              <span className="text-xs text-gray-400">Analyzing project data...</span>
            </div>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-800 flex gap-3">
        <Textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input) }
          }}
          placeholder="Ask about sites, DIA circuits, blockers..."
          className="flex-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500 resize-none min-h-[44px] max-h-[120px]"
          rows={1}
        />
        <Button onClick={() => send(input)} disabled={loading || !input.trim()} className="bg-blue-600 hover:bg-blue-700 self-end">
          <Send className="w-4 h-4" />
        </Button>
      </div>
    </div>
  )
}
