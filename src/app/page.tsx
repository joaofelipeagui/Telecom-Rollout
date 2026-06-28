'use client'
import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getProjects, saveProject } from '@/lib/store'
import { Project, UserProfile, ROLE_LABELS, ROLE_COLORS, Site, REGIONS, REGION_LABELS, REGION_COLORS, REGION_BAR_COLORS, getRegionForCountry } from '@/lib/types'
import { getCurrentUser, clearCurrentUser } from '@/lib/user'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Globe, CheckCircle, AlertTriangle, Clock, Plane,
  MapPin, Network, BarChart3, GitBranch, Bot, Package, Wifi, ArrowRight, Bell, Award, Activity
} from 'lucide-react'
import Link from 'next/link'
import { NewProjectDialog } from '@/components/NewProjectDialog'
import { RolePicker } from '@/components/RolePicker'
import { Sidebar } from '@/components/Sidebar'
import { LATAMMap } from '@/components/LATAMMap'
import { AnimatedCounter } from '@/components/AnimatedCounter'

// Quick actions per role: [label, tab, icon, color]
const ROLE_ACTIONS: Record<string, { label: string; tab: string; icon: React.ElementType; color: string }[]> = {
  program_manager: [
    { label: 'Site List',          tab: 'sites',       icon: MapPin,        color: 'text-blue-400 bg-blue-950/50 border-blue-800/40' },
    { label: 'DIA / Connectivity', tab: 'dia',         icon: Wifi,          color: 'text-cyan-400 bg-cyan-950/50 border-cyan-800/40' },
    { label: 'SLA Alerts',         tab: 'sla',         icon: Bell,          color: 'text-orange-400 bg-orange-950/50 border-orange-800/40' },
    { label: 'Escalations',        tab: 'escalations', icon: AlertTriangle, color: 'text-red-400 bg-red-950/50 border-red-800/40' },
    { label: 'Gantt Timeline',     tab: 'gantt',       icon: GitBranch,     color: 'text-purple-400 bg-purple-950/50 border-purple-800/40' },
    { label: 'Executive Report',   tab: 'report',      icon: BarChart3,     color: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40' },
    { label: 'Carrier Score',      tab: 'carriers',    icon: Award,         color: 'text-pink-400 bg-pink-950/50 border-pink-800/40' },
    { label: 'Live Network',       tab: 'network',     icon: Activity,      color: 'text-teal-400 bg-teal-950/50 border-teal-800/40' },
    { label: 'AI Assistant',       tab: 'ai',          icon: Bot,           color: 'text-yellow-400 bg-yellow-950/50 border-yellow-800/40' },
  ],
  solutions_manager: [
    { label: 'Executive Report',   tab: 'report',      icon: BarChart3,     color: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40' },
    { label: 'SLA Alerts',         tab: 'sla',         icon: Bell,          color: 'text-orange-400 bg-orange-950/50 border-orange-800/40' },
    { label: 'Carrier Score',      tab: 'carriers',    icon: Award,         color: 'text-pink-400 bg-pink-950/50 border-pink-800/40' },
    { label: 'Live Network',       tab: 'network',     icon: Activity,      color: 'text-teal-400 bg-teal-950/50 border-teal-800/40' },
    { label: 'Escalations',        tab: 'escalations', icon: AlertTriangle, color: 'text-red-400 bg-red-950/50 border-red-800/40' },
    { label: 'Gantt Timeline',     tab: 'gantt',       icon: GitBranch,     color: 'text-purple-400 bg-purple-950/50 border-purple-800/40' },
    { label: 'Site List',          tab: 'sites',       icon: MapPin,        color: 'text-blue-400 bg-blue-950/50 border-blue-800/40' },
    { label: 'DIA Overview',       tab: 'dia',         icon: Wifi,          color: 'text-cyan-400 bg-cyan-950/50 border-cyan-800/40' },
  ],
  solutions_director: [
    { label: 'KPI Dashboard',      tab: 'director',    icon: Globe,         color: 'text-blue-400 bg-blue-950/50 border-blue-800/40' },
    { label: 'Executive Report',   tab: 'report',      icon: BarChart3,     color: 'text-emerald-400 bg-emerald-950/50 border-emerald-800/40' },
    { label: 'SLA Alerts',         tab: 'sla',         icon: Bell,          color: 'text-orange-400 bg-orange-950/50 border-orange-800/40' },
    { label: 'Carrier Score',      tab: 'carriers',    icon: Award,         color: 'text-pink-400 bg-pink-950/50 border-pink-800/40' },
    { label: 'Live Network',       tab: 'network',     icon: Activity,      color: 'text-teal-400 bg-teal-950/50 border-teal-800/40' },
    { label: 'Escalations',        tab: 'escalations', icon: AlertTriangle, color: 'text-red-400 bg-red-950/50 border-red-800/40' },
    { label: 'Gantt Timeline',     tab: 'gantt',       icon: GitBranch,     color: 'text-purple-400 bg-purple-950/50 border-purple-800/40' },
  ],
  field_engineer: [
    { label: 'My Sites',           tab: 'sites',       icon: MapPin,        color: 'text-blue-400 bg-blue-950/50 border-blue-800/40' },
    { label: 'Logistics',          tab: 'logistics',   icon: Package,       color: 'text-orange-400 bg-orange-950/50 border-orange-800/40' },
  ],
  telco_engineer: [
    { label: 'DIA / Circuits',     tab: 'dia',         icon: Wifi,          color: 'text-cyan-400 bg-cyan-950/50 border-cyan-800/40' },
    { label: 'SLA Alerts',         tab: 'sla',         icon: Bell,          color: 'text-orange-400 bg-orange-950/50 border-orange-800/40' },
    { label: 'Carrier Score',      tab: 'carriers',    icon: Award,         color: 'text-pink-400 bg-pink-950/50 border-pink-800/40' },
    { label: 'Live Network',       tab: 'network',     icon: Activity,      color: 'text-teal-400 bg-teal-950/50 border-teal-800/40' },
    { label: 'Site List',          tab: 'sites',       icon: MapPin,        color: 'text-blue-400 bg-blue-950/50 border-blue-800/40' },
  ],
  sdwan_engineer: [
    { label: 'Site List',          tab: 'sites',       icon: MapPin,        color: 'text-blue-400 bg-blue-950/50 border-blue-800/40' },
    { label: 'DIA / Connectivity', tab: 'dia',         icon: Wifi,          color: 'text-cyan-400 bg-cyan-950/50 border-cyan-800/40' },
  ],
}

export default function Home() {
  const router = useRouter()
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

  function handleSiteClick(site: Site) {
    if (!selectedProject) return
    router.push(`/projects/${selectedProject.id}?tab=sites`)
  }

  function goToTab(tab: string) {
    if (!selectedProject) return
    router.push(`/projects/${selectedProject.id}?tab=${tab}`)
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
              <LATAMMap sites={allSites} onSiteClick={handleSiteClick} />

              {/* KPI overlay */}
              <div className="absolute top-4 left-4 grid grid-cols-2 gap-2">
                {[
                  { label: 'Total Sites', value: totalSites, color: 'text-white',       dot: '' },
                  { label: 'Completed',   value: completed,  color: 'text-green-400',   dot: 'dot-green' },
                  { label: 'In Progress', value: inProgress, color: 'text-blue-400',    dot: 'dot-blue' },
                  { label: 'Blocked',     value: blocked,    color: 'text-red-400',     dot: 'dot-red' },
                ].map(({ label, value, color, dot }) => (
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

              {/* Progress overlay */}
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

              {/* Map hint */}
              <div className="absolute bottom-10 right-4 bg-[#070d16]/80 backdrop-blur border border-gray-700/50 rounded-lg px-3 py-1.5">
                <p className="text-xs text-gray-400">Click any pin to see site details</p>
              </div>

              {/* Role quick-action cards */}
              {user && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-full max-w-2xl px-4">
                  <div className="flex gap-2 flex-wrap justify-center">
                    {(ROLE_ACTIONS[user.role] ?? ROLE_ACTIONS['program_manager']).map(({ label, tab, icon: Icon, color }) => {
                      const isEscalations = tab === 'escalations'
                      const openEsc = isEscalations
                        ? (selectedProject.escalations ?? []).filter(e => e.status !== 'resolved').length
                        : 0
                      return (
                        <button
                          key={tab}
                          onClick={() => goToTab(tab)}
                          className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-medium backdrop-blur transition-all hover:scale-105 hover:brightness-125 ${color}`}
                        >
                          <Icon className="w-3.5 h-3.5" />
                          {label}
                          {isEscalations && openEsc > 0 && (
                            <span className="bg-red-600 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center leading-none">
                              {openEsc}
                            </span>
                          )}
                          <ArrowRight className="w-3 h-3 opacity-60" />
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
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
              {/* Zone breakdown */}
              {allSites.length > 0 && (
                <div className="px-4 py-3 border-t border-gray-800 space-y-2">
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Zones</p>
                  {REGIONS.map(region => {
                    const sites = allSites.filter(s => getRegionForCountry(s.country) === region)
                    if (sites.length === 0) return null
                    const done = sites.filter(s => s.status === 'completed').length
                    const pct  = Math.round((done / sites.length) * 100)
                    const badgeCls = REGION_COLORS[region]
                    const barColor = REGION_BAR_COLORS[region]
                    return (
                      <div key={region}>
                        <div className="flex items-center justify-between mb-1">
                          <span className={`text-xs font-bold px-1.5 py-0.5 rounded border ${badgeCls}`}>{region}</span>
                          <span className="text-xs text-gray-500">{sites.length} sites · {pct}%</span>
                        </div>
                        <div className="bg-gray-700 rounded-full h-1">
                          <div className={`${barColor} h-1 rounded-full transition-all`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

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
