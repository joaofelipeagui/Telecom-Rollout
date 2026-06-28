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

// Primary carrier per country for simulation and display purposes
export const COUNTRY_CARRIERS: Record<string, [string, string]> = {
  // Latin America
  'Brazil':          ['Embratel', 'Vivo Empresas'],
  'Colombia':        ['ETB', 'Claro Colombia'],
  'Chile':           ['Entel', 'Movistar Chile'],
  'Argentina':       ['Telecom Argentina', 'Claro Argentina'],
  'Mexico':          ['Telmex', 'Izzi Telecom'],
  'Peru':            ['Telefónica Peru', 'Claro Peru'],
  'Ecuador':         ['CNT', 'Claro Ecuador'],
  'Uruguay':         ['Antel', 'Claro Uruguay'],
  'Paraguay':        ['Copaco', 'Personal Paraguay'],
  'Bolivia':         ['Entel Bolivia', 'Tigo Bolivia'],
  'Venezuela':       ['CANTV', 'Movilnet'],
  'Panama':          ['Cable & Wireless', 'Claro Panama'],
  'Costa Rica':      ['ICE', 'Tigo Costa Rica'],
  'Guatemala':       ['Tigo Guatemala', 'Claro Guatemala'],
  'Honduras':        ['Tigo Honduras', 'Claro Honduras'],
  'El Salvador':     ['Tigo El Salvador', 'Claro El Salvador'],
  'Nicaragua':       ['Claro Nicaragua', 'Tigo Nicaragua'],
  'Dominican Republic': ['Claro DR', 'Altice Dominicana'],
  // North America
  'United States':   ['AT&T Business', 'Verizon Business'],
  'USA':             ['AT&T Business', 'Verizon Business'],
  'Canada':          ['Bell Canada', 'Rogers Business'],
  // Europe
  'France':          ['Orange Business', 'SFR Business'],
  'Germany':         ['Deutsche Telekom', 'Vodafone Business DE'],
  'United Kingdom':  ['BT Business', 'Virgin Media Business'],
  'UK':              ['BT Business', 'Virgin Media Business'],
  'Italy':           ['TIM Enterprise', 'Fastweb Business'],
  'Spain':           ['Telefónica España', 'Vodafone ES'],
  'Netherlands':     ['KPN Business', 'Ziggo Business'],
  'Belgium':         ['Proximus', 'Orange Belgium'],
  'Switzerland':     ['Swisscom Business', 'Sunrise UPC'],
  'Austria':         ['A1 Telekom Austria', 'Magenta Telekom'],
  'Sweden':          ['Telia Business', 'Tele2 Business'],
  'Norway':          ['Telenor Business', 'Telia Norway'],
  'Denmark':         ['TDC Business', 'Telenor Denmark'],
  'Finland':         ['Elisa Business', 'Telia Finland'],
  'Poland':          ['Orange Poland', 'T-Mobile Poland'],
  'Portugal':        ['NOS Business', 'Nos Empresas'],
  'Czech Republic':  ['O2 Czech Republic', 'T-Mobile CZ'],
  'Hungary':         ['Magyar Telekom', 'Vodafone HU'],
  'Romania':         ['Orange Romania', 'Vodafone Romania'],
  // Asia-Pacific
  'Japan':           ['NTT Communications', 'KDDI Business'],
  'China':           ['China Telecom Business', 'China Unicom Business'],
  'South Korea':     ['KT Enterprise', 'SK Broadband'],
  'India':           ['Tata Communications', 'Airtel Business'],
  'Singapore':       ['Singtel Business', 'StarHub Business'],
  'Australia':       ['Telstra Enterprise', 'Optus Business'],
  'New Zealand':     ['Spark Business', 'Vodafone NZ'],
  'Hong Kong':       ['PCCW Business', 'HKT Enterprise'],
  'Taiwan':          ['Chunghwa Telecom', 'FarEasTone'],
  'Malaysia':        ['TM Business', 'Maxis Business'],
  'Indonesia':       ['Telkom Indonesia', 'Indosat Ooredoo'],
  'Thailand':        ['True Business', 'AIS Business'],
  'Philippines':     ['PLDT Enterprise', 'Globe Telecom'],
  'Vietnam':         ['VNPT', 'Viettel Business'],
  // Middle East & Africa
  'UAE':             ['Etisalat Business', 'du Telecom'],
  'Saudi Arabia':    ['STC Business', 'Zain KSA'],
  'South Africa':    ['MTN Business', 'Vodacom Business'],
  'Nigeria':         ['MTN Nigeria', 'Airtel Nigeria'],
  'Egypt':           ['Telecom Egypt', 'Etisalat Egypt'],
  'Kenya':           ['Safaricom Business', 'Airtel Kenya'],
  'Morocco':         ['Maroc Telecom', 'Orange Maroc'],
  'Israel':          ['Bezeq International', 'Partner Communications'],
  'Turkey':          ['Turk Telekom', 'Vodafone Turkey'],
}

export function getCarrierForCountry(country: string): string {
  const pair = COUNTRY_CARRIERS[country]
  return pair ? pair[0] : 'Local Carrier'
}

export interface DIA {
  provider: Provider
  status: DIAStatus
  circuitNumber?: string
  requestedAt?: string
  slaDate?: string
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

export interface ChecklistItem {
  id: string
  label: string
  category: 'pre_survey' | 'installation' | 'connectivity' | 'handover'
  done: boolean
  doneBy?: string
  doneAt?: string
}

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  { id: 'c1',  label: 'Site survey completed',                 category: 'pre_survey',   done: false },
  { id: 'c2',  label: 'Site access confirmed with customer',   category: 'pre_survey',   done: false },
  { id: 'c3',  label: 'Power availability confirmed',          category: 'pre_survey',   done: false },
  { id: 'c4',  label: 'Civil works approved',                  category: 'pre_survey',   done: false },
  { id: 'c5',  label: 'Equipment delivered to site',           category: 'installation', done: false },
  { id: 'c6',  label: 'Primary router installed & powered',    category: 'installation', done: false },
  { id: 'c7',  label: 'Backup router installed & powered',     category: 'installation', done: false },
  { id: 'c8',  label: 'Primary DIA circuit connected & tested',category: 'connectivity', done: false },
  { id: 'c9',  label: 'Backup DIA circuit connected & tested', category: 'connectivity', done: false },
  { id: 'c10', label: 'SD-WAN configuration pushed',           category: 'connectivity', done: false },
  { id: 'c11', label: 'Failover test passed',                  category: 'connectivity', done: false },
  { id: 'c12', label: 'Customer acceptance signed',            category: 'handover',     done: false },
  { id: 'c13', label: 'KMZ document delivered',                category: 'handover',     done: false },
  { id: 'c14', label: 'Hand-over documentation submitted',     category: 'handover',     done: false },
]

export interface SitePhoto {
  id: string
  name: string
  dataUrl: string
  uploadedAt: string
  note?: string
}

export interface Escalation {
  id: string
  siteId: string
  siteName: string
  title: string
  description: string
  priority: 'low' | 'medium' | 'high' | 'critical'
  status: 'open' | 'in_progress' | 'resolved'
  raisedBy: string
  raisedAt: string
  assignedTo?: string
  dueDate?: string
  resolution?: string
  resolvedAt?: string
}

export interface ChangeLogEntry {
  id: string
  siteId?: string
  siteName?: string
  field: string
  oldValue?: string
  newValue: string
  changedBy: string
  changedAt: string
}

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
  checklist?: ChecklistItem[]
  photos?: SitePhoto[]
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
  escalations?: Escalation[]
  changelog?: ChangeLogEntry[]
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

