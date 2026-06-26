'use client'
import { Project, Site, Provider, DIAStatus, DIA } from './types'

const STORAGE_KEY = 'telecom_pm_projects'

export function getProjects(): Project[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

export function saveProjects(projects: Project[]) {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEY, JSON.stringify(projects))
}

export function getProject(id: string): Project | null {
  return getProjects().find(p => p.id === id) ?? null
}

export function saveProject(project: Project) {
  const projects = getProjects()
  const idx = projects.findIndex(p => p.id === project.id)
  if (idx >= 0) projects[idx] = project
  else projects.push(project)
  saveProjects(projects)
}

export function updateSiteDIA(
  projectId: string,
  siteId: string,
  provider: Provider,
  update: Partial<DIA>
) {
  const project = getProject(projectId)
  if (!project) return
  const site = project.sites.find(s => s.id === siteId)
  if (!site) return
  site.dias[provider] = { ...site.dias[provider], provider, ...update } as DIA
  saveProject(project)
  return project
}

export function updateSite(projectId: string, siteId: string, update: Partial<Site>) {
  const project = getProject(projectId)
  if (!project) return
  const idx = project.sites.findIndex(s => s.id === siteId)
  if (idx < 0) return
  project.sites[idx] = { ...project.sites[idx], ...update }
  saveProject(project)
  return project
}

export function getSiteStats(sites: Site[]) {
  const total = sites.length
  const completed = sites.filter(s => s.status === 'completed').length
  const blocked = sites.filter(s => s.status === 'blocked').length
  const inProgress = sites.filter(s => s.status === 'in_progress').length
  const pending = sites.filter(s => s.status === 'pending').length

  let totalDIA = 0, confirmedDIA = 0
  for (const site of sites) {
    for (const dia of Object.values(site.dias)) {
      totalDIA++
      if (dia.status === 'confirmed' || dia.status === 'diverse_confirmed') confirmedDIA++
    }
  }

  return { total, completed, blocked, inProgress, pending, totalDIA, confirmedDIA }
}
