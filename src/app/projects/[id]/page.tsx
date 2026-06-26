'use client'
import { useEffect, useState, use } from 'react'
import { getProject, saveProject, getSiteStats } from '@/lib/store'
import { Project, Site, PROVIDERS, UserProfile, ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { getCurrentUser, clearCurrentUser } from '@/lib/user'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import { ArrowLeft, Download, Bot, Plus, MapPin, LogOut } from 'lucide-react'
import Link from 'next/link'
import { SitesTable } from '@/components/SitesTable'
import { DIAMatrix } from '@/components/DIAMatrix'
import { AIAssistant } from '@/components/AIAssistant'
import { AddSiteDialog } from '@/components/AddSiteDialog'
import { FieldEngineerView } from '@/components/roles/FieldEngineerView'
import { TelcoEngineerView } from '@/components/roles/TelcoEngineerView'
import { SDWANEngineerView } from '@/components/roles/SDWANEngineerView'
import { DirectorView } from '@/components/roles/DirectorView'
import { generateKMZ, downloadBlob } from '@/lib/kmz'
import { RolePicker } from '@/components/RolePicker'

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const [project, setProject] = useState<Project | null>(null)
  const [user, setUser] = useState<UserProfile | null>(null)
  const [userLoaded, setUserLoaded] = useState(false)
  const [addSiteOpen, setAddSiteOpen] = useState(false)

  useEffect(() => {
    setProject(getProject(id))
    setUser(getCurrentUser())
    setUserLoaded(true)
  }, [id])

  function reload() { setProject(getProject(id)) }

  async function handleKMZ() {
    if (!project) return
    const blob = await generateKMZ(project.sites, project.name.replace(/\s+/g, '_'))
    downloadBlob(blob, `${project.name.replace(/\s+/g, '_')}.kmz`)
  }

  if (!userLoaded) return null
  if (!user) return <RolePicker onEnter={u => setUser(u)} />
  if (!project) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Project not found</p>
    </div>
  )

  const stats = getSiteStats(project.sites)
  const progress = stats.total ? Math.round((stats.completed / stats.total) * 100) : 0
  const diaProgress = stats.totalDIA ? Math.round((stats.confirmedDIA / stats.totalDIA) * 100) : 0

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center gap-4 mb-1">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1">
              <h1 className="text-lg font-bold text-white">{project.name}</h1>
              <p className="text-xs text-gray-400">{project.customer}</p>
            </div>
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
            <Button variant="outline" size="sm" onClick={handleKMZ} className="border-gray-700 text-gray-300 hover:text-white">
              <Download className="w-4 h-4 mr-2" />
              Export KMZ
            </Button>
            <Button size="sm" onClick={() => setAddSiteOpen(true)} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" />
              Add Site
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: 'Total Sites', value: stats.total, color: 'text-white' },
            { label: 'Completed', value: stats.completed, color: 'text-green-400' },
            { label: 'In Progress', value: stats.inProgress, color: 'text-blue-400' },
            { label: 'Blocked', value: stats.blocked, color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="bg-gray-900 border-gray-800">
              <CardContent className="pt-4">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-400 mt-1">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">Site Progress</span>
                <span className="text-white font-medium">{progress}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>
          <Card className="bg-gray-900 border-gray-800">
            <CardContent className="pt-4">
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-400">DIA Circuits Confirmed</span>
                <span className="text-white font-medium">{stats.confirmedDIA}/{stats.totalDIA}</span>
              </div>
              <Progress value={diaProgress} className="h-2" />
            </CardContent>
          </Card>
        </div>

        {/* Role-specific views */}
        {user.role === 'field_engineer' ? (
          <FieldEngineerView project={project} onUpdate={reload} />
        ) : user.role === 'telco_engineer' ? (
          <TelcoEngineerView project={project} onUpdate={reload} />
        ) : user.role === 'sdwan_engineer' ? (
          <SDWANEngineerView project={project} onUpdate={reload} />
        ) : user.role === 'solutions_director' ? (
          <DirectorView project={project} />
        ) : (
          /* program_manager + solutions_manager: full tabs */
          <Tabs defaultValue="sites">
            <TabsList className="bg-gray-900 border border-gray-800">
              <TabsTrigger value="sites" className="data-[state=active]:bg-gray-800">Sites</TabsTrigger>
              <TabsTrigger value="dia" className="data-[state=active]:bg-gray-800">DIA Matrix</TabsTrigger>
              <TabsTrigger value="ai" className="data-[state=active]:bg-gray-800">
                <Bot className="w-3.5 h-3.5 mr-1" />
                AI Assistant
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sites" className="mt-4">
              <SitesTable project={project} onUpdate={reload} />
            </TabsContent>
            <TabsContent value="dia" className="mt-4">
              <DIAMatrix project={project} onUpdate={reload} />
            </TabsContent>
            <TabsContent value="ai" className="mt-4">
              <AIAssistant project={project} />
            </TabsContent>
          </Tabs>
        )}
      </div>

      <AddSiteDialog
        open={addSiteOpen}
        onClose={() => setAddSiteOpen(false)}
        onAdd={(site) => {
          project.sites.push(site)
          saveProject(project)
          reload()
          setAddSiteOpen(false)
        }}
      />
    </div>
  )
}
