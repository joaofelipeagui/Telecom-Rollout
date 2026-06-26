'use client'
import { useEffect, useState } from 'react'
import { getProjects, saveProject } from '@/lib/store'
import { Project, UserProfile, ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { getCurrentUser, clearCurrentUser } from '@/lib/user'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Plus, Globe, Network, Zap, LogOut } from 'lucide-react'
import Link from 'next/link'
import { NewProjectDialog } from '@/components/NewProjectDialog'
import { RolePicker } from '@/components/RolePicker'

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [open, setOpen] = useState(false)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setUser(getCurrentUser())
    setProjects(getProjects())
    setLoaded(true)
  }, [])

  if (!loaded) return null
  if (!user) return <RolePicker onEnter={u => setUser(u)} />

  function handleCreate(project: Project) {
    saveProject(project)
    setProjects(getProjects())
    setOpen(false)
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center">
              <Network className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Telecom Rollout PM</h1>
              <p className="text-xs text-gray-400">AI-powered network deployment management</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5">
              <div className={`w-5 h-5 rounded-full ${ROLE_COLORS[user.role]} flex items-center justify-center text-white text-xs font-bold`}>
                {user.name[0].toUpperCase()}
              </div>
              <div>
                <p className="text-xs font-medium text-white leading-none">{user.name}</p>
                <p className="text-xs text-gray-400 leading-none mt-0.5">{ROLE_LABELS[user.role]}</p>
              </div>
              <button onClick={() => { clearCurrentUser(); setUser(null) }} className="ml-1 text-gray-500 hover:text-gray-300">
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
            <Button onClick={() => setOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">
        {projects.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
            <div className="w-20 h-20 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-6">
              <Globe className="w-10 h-10 text-blue-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">No projects yet</h2>
            <p className="text-gray-400 mb-8 max-w-md">
              Create your first rollout project to start tracking sites, DIA circuits, and generating KMZ files with AI assistance.
            </p>
            <Button onClick={() => setOpen(true)} size="lg" className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-5 h-5 mr-2" />
              Create First Project
            </Button>
            <div className="mt-16 grid grid-cols-3 gap-6 max-w-2xl">
              {[
                { icon: Zap, label: 'AI Site Analysis', desc: 'Satellite image analysis for every site' },
                { icon: Network, label: 'DIA Tracking', desc: '5 providers × 1500 sites at once' },
                { icon: Globe, label: 'KMZ Generator', desc: 'One-click Google Earth export' },
              ].map(({ icon: Icon, label, desc }) => (
                <div key={label} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-left">
                  <Icon className="w-6 h-6 text-blue-400 mb-2" />
                  <div className="text-sm font-semibold text-white">{label}</div>
                  <div className="text-xs text-gray-400 mt-1">{desc}</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Projects ({projects.length})</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {projects.map(project => (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="bg-gray-900 border-gray-800 hover:border-blue-500/50 transition-all cursor-pointer group">
                    <CardHeader className="pb-2">
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-white text-base group-hover:text-blue-400 transition-colors">
                          {project.name}
                        </CardTitle>
                        <Badge variant="outline" className="text-xs border-gray-700 text-gray-400">
                          {project.sites.length} sites
                        </Badge>
                      </div>
                      <p className="text-sm text-gray-400">{project.customer}</p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex gap-4 text-xs text-gray-500">
                        <span>{project.sites.filter(s => s.status === 'completed').length} completed</span>
                        <span>{project.sites.filter(s => s.status === 'blocked').length} blocked</span>
                      </div>
                      <div className="mt-3 bg-gray-800 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full transition-all"
                          style={{
                            width: project.sites.length
                              ? `${(project.sites.filter(s => s.status === 'completed').length / project.sites.length) * 100}%`
                              : '0%'
                          }}
                        />
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <NewProjectDialog open={open} onClose={() => setOpen(false)} onCreate={handleCreate} />
    </div>
  )
}
