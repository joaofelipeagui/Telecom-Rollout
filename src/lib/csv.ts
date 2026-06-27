import { Project, Site, PROVIDERS } from './types'
import { isSiteDIAReady, isSiteLogisticsReady } from './types'

function esc(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  if (s.includes(',') || s.includes('"') || s.includes('\n')) return `"${s.replace(/"/g, '""')}"`
  return s
}

function row(...cols: (string | number | undefined | null)[]): string {
  return cols.map(esc).join(',')
}

export function exportProjectCSV(project: Project): void {
  const sites = project.sites

  const headers = [
    'Site Name', 'Country', 'City', 'State', 'Address',
    'Status', 'Wave',
    'Claro Status', 'Claro Circuit', 'Claro SLA',
    'Vivo Status',  'Vivo Circuit',  'Vivo SLA',
    'TIM Status',   'TIM Circuit',   'TIM SLA',
    'Oi Status',    'Oi Circuit',    'Oi SLA',
    'Embratel Status', 'Embratel Circuit', 'Embratel SLA',
    'DIA Ready', 'Devices Installed',
    'Primary Router', 'Primary Router Status',
    'Backup Router',  'Backup Router Status',
    'Checklist Done / Total',
    'Notes',
    'Created At',
  ]

  const lines = [headers.join(',')]

  for (const s of sites) {
    const provCols: (string | undefined)[] = []
    for (const p of PROVIDERS) {
      const dia = s.dias[p]
      provCols.push(dia?.status ?? 'not_requested', dia?.circuitNumber, dia?.slaDate)
    }

    const checkDone = s.checklist ? s.checklist.filter(c => c.done).length : 0
    const checkTotal = s.checklist ? s.checklist.length : 0

    lines.push(row(
      s.name, s.country, s.city, s.state, s.address,
      s.status, s.wave ? `Wave ${s.wave}` : '',
      ...provCols,
      isSiteDIAReady(s) ? 'Yes' : 'No',
      isSiteLogisticsReady(s) ? 'Yes' : 'No',
      s.routers?.[0]?.tagNumber, s.routers?.[0]?.status,
      s.routers?.[1]?.tagNumber, s.routers?.[1]?.status,
      checkTotal ? `${checkDone}/${checkTotal}` : '',
      s.notes,
      s.createdAt ? new Date(s.createdAt).toLocaleDateString() : '',
    ))
  }

  // Summary section
  lines.push('')
  lines.push(row('SUMMARY'))
  lines.push(row('Total Sites', sites.length))
  lines.push(row('Completed', sites.filter(s => s.status === 'completed').length))
  lines.push(row('In Progress', sites.filter(s => s.status === 'in_progress').length))
  lines.push(row('Blocked', sites.filter(s => s.status === 'blocked').length))
  lines.push(row('DIA Ready', sites.filter(isSiteDIAReady).length))
  lines.push(row('Devices Installed', sites.filter(isSiteLogisticsReady).length))
  lines.push(row('Generated', new Date().toLocaleString()))

  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${project.name.replace(/\s+/g, '_')}_Status_${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
