'use client'
import { useState, useRef } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Project, Site, PROVIDERS, Wave, RefreshType, REFRESH_TYPES } from '@/lib/types'
import { DEMO_SITES } from '@/lib/demoSites'
import { Upload, Loader2, Globe } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  onCreate: (project: Project) => void
}

function parseSitesCSV(text: string): Site[] {
  const lines = text.split('\n').filter(l => l.trim())
  const header = lines[0].toLowerCase().split(/[,;]/).map(h => h.trim())

  const nameIdx    = header.findIndex(h => h.includes('name') || h.includes('nome'))
  const addressIdx = header.findIndex(h => h.includes('address') || h.includes('endereco') || h.includes('endereço'))
  const cityIdx    = header.findIndex(h => h.includes('city') || h.includes('cidade'))
  const stateIdx   = header.findIndex(h => h.includes('state') || h.includes('estado') || h === 'uf')
  const countryIdx = header.findIndex(h => h.includes('country') || h.includes('pais') || h.includes('país'))
  const waveIdx    = header.findIndex(h => h.includes('wave'))
  const typeIdx    = header.findIndex(h => h.includes('type') || h.includes('refresh'))

  return lines.slice(1).map((line, i) => {
    // Handle quoted fields (e.g. "123 Main St, Suite 4")
    const cols = line.match(/(".*?"|[^,]+)(?=,|$)/g)?.map(c => c.trim().replace(/^"|"$/g, '')) ?? line.split(',').map(c => c.trim())
    const rawWave = waveIdx >= 0 ? parseInt(cols[waveIdx] ?? '') : NaN
    const wave = (rawWave === 1 || rawWave === 2 || rawWave === 3) ? rawWave as Wave : undefined
    const rawType = typeIdx >= 0 ? (cols[typeIdx] ?? '').toUpperCase() : ''
    const refreshType = (REFRESH_TYPES as readonly string[]).includes(rawType) ? rawType as RefreshType : undefined
    return {
      id: `site_${Date.now()}_${i}`,
      name: cols[nameIdx] || `Site ${i + 1}`,
      address: cols[addressIdx] || cols[1] || '',
      city: cols[cityIdx] || cols[2] || '',
      state: cols[stateIdx] || cols[3] || '',
      country: cols[countryIdx] || 'Brazil',
      status: 'pending',
      dias: {},
      wave,
      refreshType,
      createdAt: new Date().toISOString(),
    }
  })
}

export function NewProjectDialog({ open, onClose, onCreate }: Props) {
  const [name, setName] = useState('')
  const [customer, setCustomer] = useState('')
  const [sites, setSites] = useState<Site[]>([])
  const [loading, setLoading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const parsed = parseSitesCSV(text)
      setSites(parsed)
    }
    reader.readAsText(file)
  }

  function handleCreate() {
    if (!name || !customer) return
    const project: Project = {
      id: `proj_${Date.now()}`,
      name,
      customer,
      sites,
      createdAt: new Date().toISOString(),
    }
    onCreate(project)
    setName('')
    setCustomer('')
    setSites([])
  }

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-gray-900 border-gray-700 text-white max-w-lg">
        <DialogHeader>
          <DialogTitle>New Rollout Project</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 mt-2">
          <div>
            <Label className="text-gray-300">Project Name</Label>
            <Input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Rollout LATAM 2026 Q1"
              className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div>
            <Label className="text-gray-300">Customer</Label>
            <Input
              value={customer}
              onChange={e => setCustomer(e.target.value)}
              placeholder="e.g. Banco Itaú"
              className="mt-1 bg-gray-800 border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>
          <div>
            <Label className="text-gray-300">Sites</Label>

            {/* Demo data shortcut */}
            <button
              type="button"
              onClick={() => setSites(DEMO_SITES.map((s, i) => ({ ...s, id: `demo_${Date.now()}_${i}` })))}
              className="mt-1 w-full flex items-center gap-3 bg-blue-950/40 border border-blue-700/50 rounded-lg px-4 py-3 text-left hover:bg-blue-950/60 transition-colors"
            >
              <Globe className="w-5 h-5 text-blue-400 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-300">Load Global Demo Data</p>
                <p className="text-xs text-blue-400/70">52 sites across 6 continents — Americas, Europe, MEA, Asia-Pacific</p>
              </div>
            </button>

            <div className="flex items-center gap-2 my-2">
              <div className="flex-1 h-px bg-gray-700" />
              <span className="text-xs text-gray-500">or</span>
              <div className="flex-1 h-px bg-gray-700" />
            </div>

            <div
              className="border-2 border-dashed border-gray-700 rounded-lg p-5 text-center cursor-pointer hover:border-blue-500/50 transition-colors"
              onClick={() => fileRef.current?.click()}
            >
              <Upload className="w-5 h-5 text-gray-400 mx-auto mb-1.5" />
              <p className="text-sm text-gray-400">
                {sites.length > 0
                  ? `${sites.length} sites loaded`
                  : 'Upload CSV  ·  columns: name, address, city, state, country, wave, type'}
              </p>
              {sites.length > 0 && (
                <p className="text-xs text-blue-400 mt-1">{sites.slice(0, 3).map(s => s.name).join(', ')}{sites.length > 3 ? ` +${sites.length - 3} more` : ''}</p>
              )}
            </div>
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1 border-gray-700 text-gray-300">
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={!name || !customer}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              Create Project
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
