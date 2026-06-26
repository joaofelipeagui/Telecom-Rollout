export type UserRole =
  | 'program_manager'
  | 'field_engineer'
  | 'sdwan_engineer'
  | 'telco_engineer'
  | 'solutions_manager'
  | 'solutions_director'

export interface UserProfile {
  id: string
  name: string
  role: UserRole
  avatar?: string
}

export const ROLE_LABELS: Record<UserRole, string> = {
  program_manager: 'Program Manager',
  field_engineer: 'Field Engineer',
  sdwan_engineer: 'SD-WAN Engineer',
  telco_engineer: 'Telco Engineer',
  solutions_manager: 'Solutions Manager',
  solutions_director: 'Solutions Director',
}

export const ROLE_COLORS: Record<UserRole, string> = {
  program_manager: 'bg-blue-500',
  field_engineer: 'bg-orange-500',
  sdwan_engineer: 'bg-purple-500',
  telco_engineer: 'bg-cyan-500',
  solutions_manager: 'bg-green-500',
  solutions_director: 'bg-yellow-500',
}

export const ROLE_DESCRIPTIONS: Record<UserRole, string> = {
  program_manager: 'Full project control — sites, DIA tracking, KMZ export, AI assistant',
  field_engineer: 'Site checklist, field notes, GPS confirmation, on-site photos',
  sdwan_engineer: 'Circuit details, DIA numbers, SD-WAN topology, path config',
  telco_engineer: 'Provider status, diversity path assurance, circuit validation',
  solutions_manager: 'Project health, customer deliverables, team progress',
  solutions_director: 'Portfolio KPIs, executive dashboard, risk overview',
}

export type SiteStatus = 'pending' | 'in_progress' | 'completed' | 'blocked'
export type DIAStatus = 'not_requested' | 'requested' | 'received' | 'confirmed' | 'diverse_confirmed'

export const PROVIDERS = ['Claro', 'Vivo', 'TIM', 'Oi', 'Embratel'] as const
export type Provider = typeof PROVIDERS[number]

export interface DIA {
  provider: Provider
  status: DIAStatus
  circuitNumber?: string
  requestedAt?: string
  confirmedAt?: string
  pathA?: string
  pathB?: string
  diversityConfirmed?: boolean
}

export interface Site {
  id: string
  name: string
  address: string
  city: string
  state: string
  lat?: number
  lng?: number
  status: SiteStatus
  dias: Partial<Record<Provider, DIA>>
  notes?: string
  kmzGenerated?: boolean
  aiDescription?: string
  createdAt: string
}

export interface Project {
  id: string
  name: string
  customer: string
  sites: Site[]
  createdAt: string
}
