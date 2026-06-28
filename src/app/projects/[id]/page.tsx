'use client'
import { useEffect, useState, use } from 'react'
import { useSearchParams } from 'next/navigation'
import { ToastProvider, toast } from '@/components/ui/toast'
import { getProject, saveProject, getSiteStats } from '@/lib/store'
import { Project, UserProfile, ROLE_LABELS, ROLE_COLORS } from '@/lib/types'
import { getCurrentUser, clearCurrentUser } from '@/lib/user'
import { exportProjectCSV } from '@/lib/csv'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Progress } from '@/components/ui/progress'
import {
  ArrowLeft, Download, Bot, Plus, LogOut, Package,
  BarChart3, AlertTriangle, GitBranch, Clock, Share2, FileSpreadsheet, Eye, X, Lightbulb,
  Bell, Award, Activity, Wifi as WifiIcon
} from 'lucide-react'
import Link from 'next/link'
import { SitesTable } from '@/components/SitesTable'
import { DIAMatrix } from '@/components/DIAMatrix'
import { AIAssistant } from '@/components/AIAssistant'
import { AddSiteDialog } from '@/components/AddSiteDialog'
import { FieldEngineerView } from '@/components/roles/FieldEngineerView'
import { TelcoEngineerView } from '@/components/roles/TelcoEngineerView'
import { SDWANEngineerView } from '@/components/roles/SDWANEngineerView'
import { DirectorView } from '@/components/roles/DirectorView'
import { ExecDashboard } from '@/components/ExecDashboard'
import { LogisticsView } from '@/components/LogisticsView'
import { ExecutiveReport } from '@/components/ExecutiveReport'
import { EscalationTracker } from '@/components/EscalationTracker'
import { GanttView } from '@/components/GanttView'
import { ChangeLog } from '@/components/ChangeLog'
import { SLAAlerts, getSLAAlertCount } from '@/components/SLAAlerts'
import { CarrierScorecard } from '@/components/CarrierScorecard'
import { NetworkMonitor } from '@/components/NetworkMonitor'
import { generateKMZ, downloadBlob } from '@/lib/kmz'
import { RolePicker } from '@/components/RolePicker'

export default function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const searchParams = useSearchParams()
  const readonly = searchParams.get('share') === '1'

  const tabParam = searchParams.get('tab') ?? undefined

  const [project, setProject]       = useState<Project | null>(null)
  const [user, setUser]             = useState<UserProfile | null>(null)
  const [userLoaded, setUserLoaded] = useState(false)
  const [addSiteOpen, setAddSiteOpen] = useState(false)
  const [copied, setCopied]         = useState(false)
  const [tipDismissed, setTipDismissed] = useState(true)

  useEffect(() => {
    const dismissed = localStorage.getItem('onboarding_tip_dismissed')
    if (!dismissed) setTipDismissed(false)
  }, [])

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
    toast('KMZ file downloaded')
  }

  function handleCSV() {
    if (!project) return
    exportProjectCSV(project)
    toast('CSV exported successfully')
  }

  function handleShare() {
    const url = `${window.location.origin}/projects/${id}?share=1`
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      toast('Read-only link copied to clipboard', 'info')
      setTimeout(() => setCopied(false), 2000)
    })
  }

  if (!userLoaded) return null
  if (!user && !readonly) return <RolePicker onEnter={u => setUser(u)} />
  if (!project) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <p className="text-gray-400">Project not found</p>
    </div>
  )

  const stats = getSiteStats(project.sites)
  const progress    = stats.total    ? Math.round((stats.completed   / stats.total)    * 100) : 0
  const diaProgress = stats.totalDIA ? Math.round((stats.confirmedDIA / stats.totalDIA) * 100) : 0
  const openEscalations = (project.escalations ?? []).filter(e => e.status !== 'resolved').length
  const slaAlertCount   = getSLAAlertCount(project)

  const effectiveRole = user?.role ?? 'solutions_director'

  function dismissTip() {
    localStorage.setItem('onboarding_tip_dismissed', '1')
    setTipDismissed(true)
  }

  return (
    <ToastProvider>
    <div className="min-h-screen bg-gray-950">
      {/* Onboarding tip */}
      {!tipDismissed && !readonly && (
        <div className="bg-blue-950/60 border-b border-blue-800/40 px-6 py-2.5 flex items-center gap-3">
          <Lightbulb className="w-4 h-4 text-blue-400 flex-shrink-0" />
          <p className="text-xs text-blue-200 flex-1">
            <span className="font-semibold">Quick tips:</span>{' '}
            Click any site row to open its detail panel · Change status directly from the dropdown on each row · Use <span className="font-medium">Filters</span> to narrow by wave or country · <span className="font-medium">Share</span> creates a read-only link for stakeholders
          </p>
          <button onClick={dismissTip} className="text-blue-400 hover:text-blue-200 flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
      {/* Top bar */}
      <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 py-3">
          <div className="flex items-center gap-3 flex-wrap">
            <Link href="/" className="text-gray-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <h1 className="text-base font-bold text-white truncate">{project.name}</h1>
              <p className="text-xs text-gray-400">{project.customer}</p>
            </div>

            {readonly && (
              <Badge className="bg-yellow-900/50 text-yellow-300 border-yellow-700/50 gap-1">
                <Eye className="w-3 h-3" /> Read Only
              </Badge>
            )}

            {user && (
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
            )}

            <Button variant="outline" size="sm" onClick={handleShare}
              className="border-gray-700 text-gray-300 hover:text-white h-8 text-xs">
              <Share2 className="w-3.5 h-3.5 mr-1.5" />
              {copied ? 'Link Copied!' : 'Share'}
            </Button>
            <Button variant="outline" size="sm" onClick={handleCSV}
              className="border-gray-700 text-gray-300 hover:text-white h-8 text-xs">
              <FileSpreadsheet className="w-3.5 h-3.5 mr-1.5" />
              Export CSV
            </Button>
            <Button variant="outline" size="sm" onClick={handleKMZ}
              className="border-gray-700 text-gray-300 hover:text-white h-8 text-xs">
              <Download className="w-3.5 h-3.5 mr-1.5" />
              KMZ
            </Button>
            {!readonly && (
              <Button size="sm" onClick={() => setAddSiteOpen(true)} className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
                <Plus className="w-3.5 h-3.5 mr-1" /> Add Site
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Stats strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-5">
          {[
            { label: 'Total Sites', value: stats.total,     color: 'text-white' },
            { label: 'Completed',   value: stats.completed, color: 'text-green-400' },
            { label: 'In Progress', value: stats.inProgress,color: 'text-blue-400' },
            { label: 'Blocked',     value: stats.blocked,   color: 'text-red-400' },
          ].map(({ label, value, color }) => (
            <Card key={label} className="card-glow bg-[#070d16] border-0">
              <CardContent className="pt-4 pb-3">
                <div className={`text-2xl font-bold ${color}`}>{value}</div>
                <div className="text-xs text-gray-500 mt-1">{label}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <Card className="card-glow bg-[#070d16] border-0">
            <CardContent className="pt-4 pb-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400">Site Progress</span>
                <span className="text-white font-semibold">{progress}%</span>
              </div>
              <Progress value={progress} className="h-1.5" />
            </CardContent>
          </Card>
          <Card className="card-glow bg-[#070d16] border-0">
            <CardContent className="pt-4 pb-3">
              <div className="flex justify-between text-xs mb-2">
                <span className="text-gray-400">DIA Confirmed</span>
                <span className="text-white font-semibold">{stats.confirmedDIA}/{stats.totalDIA}</span>
              </div>
              <Progress value={diaProgress} className="h-1.5" />
            </CardContent>
          </Card>
        </div>

        {/* Role-specific views */}
        {effectiveRole === 'field_engineer' ? (
          <Tabs defaultValue={tabParam ?? "field"}>
            <TabsList className="bg-gray-900 border border-gray-800 mb-4 flex-wrap h-auto gap-0.5">
              <TabsTrigger value="field"   className="data-[state=active]:bg-gray-800 text-xs">Field View</TabsTrigger>
              <TabsTrigger value="sites"   className="data-[state=active]:bg-gray-800 text-xs">Sites</TabsTrigger>
              <TabsTrigger value="network" className="data-[state=active]:bg-gray-800 text-xs">
                <Activity className="w-3.5 h-3.5 mr-1" />Live Network
              </TabsTrigger>
            </TabsList>
            <TabsContent value="field">   <FieldEngineerView project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="sites">   <SitesTable project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="network"> <NetworkMonitor project={project} /></TabsContent>
          </Tabs>

        ) : effectiveRole === 'sdwan_engineer' ? (
          <Tabs defaultValue={tabParam ?? "sdwan"}>
            <TabsList className="bg-gray-900 border border-gray-800 mb-4 flex-wrap h-auto gap-0.5">
              <TabsTrigger value="sdwan"   className="data-[state=active]:bg-gray-800 text-xs">SD-WAN View</TabsTrigger>
              <TabsTrigger value="sites"   className="data-[state=active]:bg-gray-800 text-xs">Sites</TabsTrigger>
              <TabsTrigger value="dia"     className="data-[state=active]:bg-gray-800 text-xs">DIA / Connectivity</TabsTrigger>
              <TabsTrigger value="network" className="data-[state=active]:bg-gray-800 text-xs">
                <Activity className="w-3.5 h-3.5 mr-1" />Live Network
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sdwan">   <SDWANEngineerView project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="sites">   <SitesTable project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="dia">     <DIAMatrix project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="network"> <NetworkMonitor project={project} /></TabsContent>
          </Tabs>

        ) : effectiveRole === 'telco_engineer' ? (
          /* Telco Engineer: circuit specialist — DIA workspace + SLA deadlines + carrier perf + live health */
          <Tabs defaultValue={tabParam ?? "dia"}>
            <TabsList className="bg-gray-900 border border-gray-800 mb-4 flex-wrap h-auto gap-0.5">
              <TabsTrigger value="dia"       className="data-[state=active]:bg-gray-800 text-xs">
                <WifiIcon className="w-3.5 h-3.5 mr-1" />DIA / Circuits
              </TabsTrigger>
              <TabsTrigger value="sla"       className="data-[state=active]:bg-gray-800 text-xs">
                <Bell className="w-3.5 h-3.5 mr-1" />
                SLA Alerts {slaAlertCount > 0 && <span className="ml-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">{slaAlertCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="carriers"  className="data-[state=active]:bg-gray-800 text-xs">
                <Award className="w-3.5 h-3.5 mr-1" />Carrier Score
              </TabsTrigger>
              <TabsTrigger value="network"   className="data-[state=active]:bg-gray-800 text-xs">
                <Activity className="w-3.5 h-3.5 mr-1" />Live Network
              </TabsTrigger>
              <TabsTrigger value="sites"     className="data-[state=active]:bg-gray-800 text-xs">Sites</TabsTrigger>
              <TabsTrigger value="changelog" className="data-[state=active]:bg-gray-800 text-xs">
                <Clock className="w-3.5 h-3.5 mr-1" />Changelog
              </TabsTrigger>
            </TabsList>
            <TabsContent value="dia">       <TelcoEngineerView project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="sla">       <SLAAlerts project={project} /></TabsContent>
            <TabsContent value="carriers">  <CarrierScorecard project={project} /></TabsContent>
            <TabsContent value="network">   <NetworkMonitor project={project} /></TabsContent>
            <TabsContent value="sites">     <SitesTable project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="changelog"> <ChangeLog project={project} /></TabsContent>
          </Tabs>

        ) : effectiveRole === 'solutions_manager' ? (
          /* Solutions Manager: account health + delivery assurance + customer-facing views */
          <Tabs defaultValue={tabParam ?? "exec"}>
            <TabsList className="bg-gray-900 border border-gray-800 mb-4 flex-wrap h-auto gap-0.5">
              <TabsTrigger value="exec"        className="data-[state=active]:bg-gray-800 text-xs">
                <BarChart3 className="w-3.5 h-3.5 mr-1" />Exec Dashboard
              </TabsTrigger>
              <TabsTrigger value="report"      className="data-[state=active]:bg-gray-800 text-xs">Report</TabsTrigger>
              <TabsTrigger value="sla"         className="data-[state=active]:bg-gray-800 text-xs">
                <Bell className="w-3.5 h-3.5 mr-1" />
                SLA Alerts {slaAlertCount > 0 && <span className="ml-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">{slaAlertCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="carriers"    className="data-[state=active]:bg-gray-800 text-xs">
                <Award className="w-3.5 h-3.5 mr-1" />Carrier Score
              </TabsTrigger>
              <TabsTrigger value="network"     className="data-[state=active]:bg-gray-800 text-xs">
                <Activity className="w-3.5 h-3.5 mr-1" />Live Network
              </TabsTrigger>
              <TabsTrigger value="escalations" className="data-[state=active]:bg-gray-800 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Escalations {openEscalations > 0 && <span className="ml-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{openEscalations}</span>}
              </TabsTrigger>
              <TabsTrigger value="gantt"       className="data-[state=active]:bg-gray-800 text-xs">
                <GitBranch className="w-3.5 h-3.5 mr-1" />Gantt
              </TabsTrigger>
              <TabsTrigger value="sites"       className="data-[state=active]:bg-gray-800 text-xs">Sites</TabsTrigger>
              <TabsTrigger value="dia"         className="data-[state=active]:bg-gray-800 text-xs">DIA Overview</TabsTrigger>
              <TabsTrigger value="changelog"   className="data-[state=active]:bg-gray-800 text-xs">
                <Clock className="w-3.5 h-3.5 mr-1" />Changelog
              </TabsTrigger>
            </TabsList>
            <TabsContent value="exec">         <ExecDashboard project={project} /></TabsContent>
            <TabsContent value="report">      <ExecutiveReport project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="sla">         <SLAAlerts project={project} /></TabsContent>
            <TabsContent value="carriers">    <CarrierScorecard project={project} /></TabsContent>
            <TabsContent value="network">     <NetworkMonitor project={project} /></TabsContent>
            <TabsContent value="escalations"> <EscalationTracker project={project} onUpdate={reload} readonly={readonly} /></TabsContent>
            <TabsContent value="gantt">       <GanttView project={project} /></TabsContent>
            <TabsContent value="sites">       <SitesTable project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="dia">         <DIAMatrix project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="changelog">   <ChangeLog project={project} /></TabsContent>
          </Tabs>

        ) : effectiveRole === 'solutions_director' ? (
          /* Solutions Director: strategic / portfolio view */
          <Tabs defaultValue={tabParam ?? "exec"}>
            <TabsList className="bg-gray-900 border border-gray-800 mb-4 flex-wrap h-auto gap-0.5">
              <TabsTrigger value="exec"        className="data-[state=active]:bg-gray-800 text-xs">
                <BarChart3 className="w-3.5 h-3.5 mr-1" />Exec Dashboard
              </TabsTrigger>
              <TabsTrigger value="director"    className="data-[state=active]:bg-gray-800 text-xs">Zone KPIs</TabsTrigger>
              <TabsTrigger value="report"      className="data-[state=active]:bg-gray-800 text-xs">Report</TabsTrigger>
              <TabsTrigger value="sla"         className="data-[state=active]:bg-gray-800 text-xs">
                <Bell className="w-3.5 h-3.5 mr-1" />
                SLA Alerts {slaAlertCount > 0 && <span className="ml-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">{slaAlertCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="carriers"    className="data-[state=active]:bg-gray-800 text-xs">
                <Award className="w-3.5 h-3.5 mr-1" />Carrier Score
              </TabsTrigger>
              <TabsTrigger value="network"     className="data-[state=active]:bg-gray-800 text-xs">
                <Activity className="w-3.5 h-3.5 mr-1" />Live Network
              </TabsTrigger>
              <TabsTrigger value="escalations" className="data-[state=active]:bg-gray-800 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Escalations {openEscalations > 0 && <span className="ml-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{openEscalations}</span>}
              </TabsTrigger>
              <TabsTrigger value="gantt"       className="data-[state=active]:bg-gray-800 text-xs">
                <GitBranch className="w-3.5 h-3.5 mr-1" />Gantt
              </TabsTrigger>
              <TabsTrigger value="sites"       className="data-[state=active]:bg-gray-800 text-xs">Sites</TabsTrigger>
              <TabsTrigger value="changelog"   className="data-[state=active]:bg-gray-800 text-xs">
                <Clock className="w-3.5 h-3.5 mr-1" />Changelog
              </TabsTrigger>
            </TabsList>
            <TabsContent value="exec">         <ExecDashboard project={project} /></TabsContent>
            <TabsContent value="director">    <DirectorView project={project} /></TabsContent>
            <TabsContent value="report">      <ExecutiveReport project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="sla">         <SLAAlerts project={project} /></TabsContent>
            <TabsContent value="carriers">    <CarrierScorecard project={project} /></TabsContent>
            <TabsContent value="network">     <NetworkMonitor project={project} /></TabsContent>
            <TabsContent value="escalations"> <EscalationTracker project={project} onUpdate={reload} readonly={readonly} /></TabsContent>
            <TabsContent value="gantt">       <GanttView project={project} /></TabsContent>
            <TabsContent value="sites">       <SitesTable project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="changelog">   <ChangeLog project={project} /></TabsContent>
          </Tabs>

        ) : (
          /* Program Manager: full operational control */
          <Tabs defaultValue={tabParam ?? "sites"}>
            <TabsList className="bg-gray-900 border border-gray-800 flex-wrap h-auto gap-0.5">
              <TabsTrigger value="sites"       className="data-[state=active]:bg-gray-800 text-xs">Sites</TabsTrigger>
              <TabsTrigger value="dia"         className="data-[state=active]:bg-gray-800 text-xs">DIA / Connectivity</TabsTrigger>
              <TabsTrigger value="logistics"   className="data-[state=active]:bg-gray-800 text-xs">
                <Package className="w-3.5 h-3.5 mr-1" />Logistics
              </TabsTrigger>
              <TabsTrigger value="gantt"       className="data-[state=active]:bg-gray-800 text-xs">
                <GitBranch className="w-3.5 h-3.5 mr-1" />Gantt
              </TabsTrigger>
              <TabsTrigger value="escalations" className="data-[state=active]:bg-gray-800 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 mr-1" />
                Escalations {openEscalations > 0 && <span className="ml-1 bg-red-600 text-white text-xs px-1.5 py-0.5 rounded-full">{openEscalations}</span>}
              </TabsTrigger>
              <TabsTrigger value="sla"         className="data-[state=active]:bg-gray-800 text-xs">
                <Bell className="w-3.5 h-3.5 mr-1" />
                SLA Alerts {slaAlertCount > 0 && <span className="ml-1 bg-orange-600 text-white text-xs px-1.5 py-0.5 rounded-full">{slaAlertCount}</span>}
              </TabsTrigger>
              <TabsTrigger value="carriers"    className="data-[state=active]:bg-gray-800 text-xs">
                <Award className="w-3.5 h-3.5 mr-1" />Carrier Score
              </TabsTrigger>
              <TabsTrigger value="network"     className="data-[state=active]:bg-gray-800 text-xs">
                <Activity className="w-3.5 h-3.5 mr-1" />Live Network
              </TabsTrigger>
              <TabsTrigger value="report"      className="data-[state=active]:bg-gray-800 text-xs">
                <BarChart3 className="w-3.5 h-3.5 mr-1" />Report
              </TabsTrigger>
              <TabsTrigger value="changelog"   className="data-[state=active]:bg-gray-800 text-xs">
                <Clock className="w-3.5 h-3.5 mr-1" />Log
              </TabsTrigger>
              <TabsTrigger value="ai"          className="data-[state=active]:bg-gray-800 text-xs">
                <Bot className="w-3.5 h-3.5 mr-1" />AI
              </TabsTrigger>
            </TabsList>
            <TabsContent value="sites"       className="mt-4"><SitesTable project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="dia"         className="mt-4"><DIAMatrix project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="logistics"   className="mt-4"><LogisticsView project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="gantt"       className="mt-4"><GanttView project={project} /></TabsContent>
            <TabsContent value="escalations" className="mt-4"><EscalationTracker project={project} onUpdate={reload} readonly={readonly} /></TabsContent>
            <TabsContent value="sla"         className="mt-4"><SLAAlerts project={project} /></TabsContent>
            <TabsContent value="carriers"    className="mt-4"><CarrierScorecard project={project} /></TabsContent>
            <TabsContent value="network"     className="mt-4"><NetworkMonitor project={project} /></TabsContent>
            <TabsContent value="report"      className="mt-4"><ExecutiveReport project={project} onUpdate={reload} /></TabsContent>
            <TabsContent value="changelog"   className="mt-4"><ChangeLog project={project} /></TabsContent>
            <TabsContent value="ai"          className="mt-4"><AIAssistant project={project} /></TabsContent>
          </Tabs>
        )}
      </div>

      {!readonly && (
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
      )}
    </div>
    </ToastProvider>
  )
}
