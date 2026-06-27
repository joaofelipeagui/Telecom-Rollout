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

export type DeviceStatus =
  | 'ordered'
  | 'warehouse'
  | 'in_flight'
  | 'landed'
  | 'in_transit'
  | 'delivered'
  | 'installed'

export const DEVICE_STATUS_LABELS: Record<DeviceStatus, string> = {
  ordered: 'Ordered',
  warehouse: 'Warehouse',
  in_flight: 'In Flight',
  landed: 'Landed',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  installed: 'Installed ✓',
}

export const DEVICE_STATUS_COLORS: Record<DeviceStatus, string> = {
  ordered: 'text-gray-400',
  warehouse: 'text-gray-300',
  in_flight: 'text-blue-400',
  landed: 'text-cyan-400',
  in_transit: 'text-yellow-400',
  delivered: 'text-orange-400',
  installed: 'text-green-400',
}

export interface Router {
  role: 'primary' | 'backup'
  tagNumber: string
  model: string
  serialNumber?: string
  status: DeviceStatus
  flightNumber?: string
  flightOrigin?: string
  flightDestination?: string
  flightETA?: string
  courierName?: string
  courierTracking?: string
  dispatchedAt?: string
  deliveredAt?: string
  installedAt?: string
  installedBy?: string
  notes?: string
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

export const LATAM_COUNTRIES = [
  'Brazil', 'Colombia', 'Chile', 'Argentina', 'Mexico',
  'Peru', 'Ecuador', 'Uruguay', 'Paraguay', 'Bolivia',
  'Venezuela', 'Panama', 'Costa Rica', 'Guatemala', 'Honduras',
] as const
export type LatamCountry = typeof LATAM_COUNTRIES[number]

export interface ActivityEvent {
  id: string
  siteId: string
  siteName: string
  action: string
  user: string
  timestamp: string
}

export type Wave = 1 | 2 | 3

export interface Site {
  id: string
  name: string
  address: string
  city: string
  state: string
  country: string
  lat?: number
  lng?: number
  status: SiteStatus
  dias: Partial<Record<Provider, DIA>>
  routers?: [Router, Router]
  notes?: string
  kmzGenerated?: boolean
  aiDescription?: string
  wave?: Wave
  createdAt: string
}

export interface WaveConfig {
  wave: Wave
  label: string
  goLiveDate?: string
}

export interface Project {
  id: string
  name: string
  customer: string
  region?: string
  sites: Site[]
  activity?: ActivityEvent[]
  waves?: WaveConfig[]
  createdAt: string
}

export function defaultRouter(role: 'primary' | 'backup'): Router {
  return {
    role,
    tagNumber: '',
    model: 'Cisco ISR4321',
    status: 'ordered',
  }
}

export function isSiteLogisticsReady(site: Site): boolean {
  return !!(site.routers?.[0]?.status === 'installed' && site.routers?.[1]?.status === 'installed')
}

export function isSiteDIAReady(site: Site): boolean {
  const confirmed = Object.values(site.dias).filter(
    d => d.status === 'confirmed' || d.status === 'diverse_confirmed'
  ).length
  return confirmed >= 2
}

export function isSiteFullyReady(site: Site): boolean {
  return isSiteLogisticsReady(site) && isSiteDIAReady(site)
}

