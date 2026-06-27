'use client'
import { useEffect, useState } from 'react'
import { getProjects, saveProject } from '@/lib/store'
import { Project, UserProfile, ROLE_LABELS, ROLE_COLORS, Site } from '@/lib/types'
import { getCurrentUser, clearCurrentUser } from '@/lib/user'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Plus, Globe, Network, Zap, CheckCircle, AlertTriangle, Clock, Plane } from 'lucide-react'
import Link from 'next/link'
import { NewProjectDialog } from '@/components/NewProjectDialog'
import { RolePicker } from '@/components/RolePicker'
import { Sidebar } from '@/components/Sidebar'
import { LATAMMap } from '@/components/LATAMMap'
import { AnimatedCounter } from '@/components/AnimatedCounter'

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [selectedProject, setSelectedProject] = useState<Project | null>(null)

  useEffect(() => {
    setUser(getCurrentUser())
    const p = getProjects()
    setProjects(p)
    if (p.length > 0) setSelectedProject(p[0])
    setLoaded(true)
  }, [])

  if (!loaded) return null
  if (!user) return <RolePicker onEnter={u => setUser(u)} />

  function handleCreate(project: Project) {
    saveProject(project)
    const p = getProjects()
    setProjects(p)
    setSelectedProject(project)
    setOpen(false)
  }

  const allSites = selectedProject?.sites ?? []
  const totalSites = allSites.length
  const completed = allSites.filter(s => s.status === 'completed').length
  const blocked = allSites.filter(s => s.status === 'blocked').length
  const inProgress = allSites.filter(s => s.status === 'in_progress').length
  const inFlight = allSites.filter(s => s.routers?.some(r => r.status === 'in_flight')).length
  const progress = totalSites ? Math.round((completed / totalSites) * 100) : 0

  return (
    <div className="flex h-screen bg-gray-950 overflow-hidden">
      <Sidebar user={user} onLogout={() => { clearCurrentUser(); setUser(null) }} />

      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-gray-800 bg-gray-900/50 backdrop-blur flex-shrink-0">
          <div className="flex items-center gap-3">
            <h1 className="text-base font-bold text-white">
              {selectedProject ? selectedProject.name : 'LATAM Rollout PM'}
            </h1>
            {selectedProject && (
              <Badge className="text-xs bg-blue-900/50 text-blue-300 border-blue-700/50">
                {selectedProject.customer}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-3">
            {projects.length > 1 && (
              <select
                value={selectedProject?.id || ''}
                onChange={e => setSelectedProject(projects.find(p => p.id === e.target.value) || null)}
                className="text-xs bg-gray-800 border border-gray-700 text-white rounded-lg px-3 py-1.5"
              >
                {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            )}
            <Button onClick={() => setOpen(true)} size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
              <Plus className="w-3.5 h-3.5 mr-1" /> New Project
            </Button>
          </div>
        </div>

        {selectedProject ? (
          <div className="flex-1 flex overflow-hidden">
            {/* Map - main area */}
            <div className="flex-1 relative">
              <LATAMMap sites={allSites} />

              {/* KPI overlay */}
              <div className="absolute top-4 left-4 grid grid-cols-2 gap-2">
                {[
                  { label: 'Total Sites', value: totalSites, icon: Globe, color: 'text-white', dot: '' },
                  { label: 'Completed', value: completed, icon: CheckCircle, color: 'text-green-400', dot: 'dot-green' },
                  { label: 'In Progress', value: inProgress, icon: Clock, color: 'text-blue-400', dot: 'dot-blue' },
                  { label: 'Blocked', value: blocked, icon: AlertTriangle, color: 'text-red-400', dot: 'dot-red' },
                ].map(({ label, value, icon: Icon, color, dot }) => (
                  <div key={label} className="card-glow bg-[#070d16]/95 backdrop-blur rounded-xl px-4 py-3">
                    <div className={`text-2xl font-bold ${color} tracking-tight`}>
                      <AnimatedCounter value={value} />
                    </div>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${color.replace('text-', 'bg-')} ${dot}`} />
                      <span className="text-label">{label}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Progress bar overlay */}
              <div className="absolute top-4 right-4 card-glow bg-[#070d16]/95 backdrop-blur rounded-xl px-4 py-3 w-52">
                <div className="flex justify-between text-xs mb-2">
                  <span className="text-gray-400">Overall Progress</span>
                  <span className="text-white font-bold"><AnimatedCounter value={progress} suffix="%" /></span>
                </div>
                <div className="bg-gray-700 rounded-full h-2">
                  <div className="bg-blue-500 h-2 rounded-full transition-all duration-1000" style={{ width: `${progress}%` }} />
                </div>
                {inFlight > 0 && (
                  <div className="flex items-center gap-1 mt-2 text-xs text-cyan-400">
                    <Plane className="w-3 h-3" />
                    <span><AnimatedCounter value={inFlight} /> devices in flight</span>
                  </div>
                )}
              </div>

              {/* Open project button */}
              <div className="absolute bottom-4 right-4">
                <Link href={`/projects/${selectedProject.id}`}>
                  <Button className="bg-blue-600 hover:bg-blue-700 shadow-lg shadow-blue-500/20">
                    Open Project Dashboard →
                  </Button>
                </Link>
              </div>
            </div>

            {/* Right panel - project list */}
            <div className="w-64 flex-shrink-0 border-l border-gray-800 bg-gray-900/50 flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-800">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Projects</p>
              </div>
              <div className="flex-1 overflow-auto py-2">
                {projects.map(project => {
                  const s = project.sites
                  const pct = s.length ? Math.round((s.filter(x => x.status === 'completed').length / s.length) * 100) : 0
                  const isSelected = selectedProject?.id === project.id
                  return (
                    <button
                      key={project.id}
                      onClick={() => setSelectedProject(project)}
                      className={`w-full text-left px-4 py-3 border-b border-gray-800/50 transition-all ${
                        isSelected ? 'bg-blue-950/30 border-l-2 border-l-blue-500' : 'hover:bg-gray-800/30'
                      }`}
                    >
                      <div className="text-sm font-medium text-white truncate">{project.name}</div>
                      <div className="text-xs text-gray-400 mt-0.5">{project.customer}</div>
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 bg-gray-700 rounded-full h-1">
                          <div className="bg-blue-500 h-1 rounded-full" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400">{pct}%</span>
                      </div>
                      <div className="text-xs text-gray-500 mt-1">{s.length} sites</div>
                    </button>
                  )
                })}
              </div>
              <div className="p-3 border-t border-gray-800">
                <Button onClick={() => setOpen(true)} size="sm" className="w-full bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs">
                  <Plus className="w-3.5 h-3.5 mr-1" /> New Project
                </Button>
              </div>
            </div>
          </div>
        ) : (
          /* Empty state */
          <div className="flex-1 flex flex-col items-center justify-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
              <Globe className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No projects yet</h2>
            <p className="text-gray-400 mb-8 max-w-md text-center">
              Create your first LATAM rollout project to see sites on the map, track DIA circuits, and manage device logistics.
            </p>
            <Button onClick={() => setOpen(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" /> Create First Project
            </Button>
          </div>
        )}
      </div>

      <NewProjectDialog open={open} onClose={() => setOpen(false)} onCreate={handleCreate} />
    </div>
  )
}
