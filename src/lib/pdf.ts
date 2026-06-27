import { jsPDF } from 'jspdf'
import { Project, Site, WaveConfig } from './types'
import { isSiteDIAReady, isSiteLogisticsReady } from './types'

// ── color helpers ─────────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return [r, g, b]
}

type RGB = [number, number, number]

const C = {
  bg:        [15, 23, 42]  as RGB,   // #0f172a — page background
  surface:   [22, 33, 55]  as RGB,   // card surface
  border:    [37, 55, 85]  as RGB,   // subtle border
  white:     [241, 245, 249] as RGB, // near-white text
  muted:     [100, 116, 139] as RGB, // gray-500
  blue:      [59, 130, 246]  as RGB, // accent blue
  green:     [34, 197, 94]   as RGB,
  yellow:    [234, 179, 8]   as RGB,
  orange:    [249, 115, 22]  as RGB,
  red:       [239, 68, 68]   as RGB,
  cyan:      [34, 211, 238]  as RGB,
  purple:    [168, 85, 247]  as RGB,
}

// ── layout constants ──────────────────────────────────────────────────────────

const PAGE_W  = 210  // A4 mm
const PAGE_H  = 297
const MARGIN  = 14
const COL_W   = PAGE_W - MARGIN * 2

// ── cursor helper ─────────────────────────────────────────────────────────────

class Doc {
  pdf: jsPDF
  y: number

  constructor() {
    this.pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    this.y = 0
  }

  /** Ensure there's at least `need` mm remaining; add page if not */
  need(mm: number) {
    if (this.y + mm > PAGE_H - MARGIN) this.newPage()
  }

  newPage() {
    this.pdf.addPage()
    this.y = MARGIN
    this.fillPage()
  }

  fillPage() {
    this.pdf.setFillColor(...C.bg)
    this.pdf.rect(0, 0, PAGE_W, PAGE_H, 'F')
  }

  setFont(size: number, style: 'normal' | 'bold' = 'normal', color: RGB = C.white) {
    this.pdf.setFontSize(size)
    this.pdf.setFont('helvetica', style)
    this.pdf.setTextColor(...color)
  }

  text(str: string, x: number, opts?: { align?: 'left' | 'center' | 'right' }) {
    this.pdf.text(str, x, this.y, opts)
  }

  gap(mm: number) { this.y += mm }

  rect(x: number, w: number, h: number, fill: RGB, stroke?: RGB) {
    this.pdf.setFillColor(...fill)
    if (stroke) {
      this.pdf.setDrawColor(...stroke)
      this.pdf.roundedRect(x, this.y, w, h, 1.5, 1.5, 'FD')
    } else {
      this.pdf.roundedRect(x, this.y, w, h, 1.5, 1.5, 'F')
    }
  }

  hrule(color: RGB = C.border) {
    this.pdf.setDrawColor(...color)
    this.pdf.line(MARGIN, this.y, PAGE_W - MARGIN, this.y)
    this.y += 3
  }

  sectionTitle(label: string) {
    this.need(12)
    this.setFont(7, 'bold', C.blue)
    this.text(label.toUpperCase(), MARGIN)
    this.gap(4)
    this.hrule(C.border)
  }
}

// ── completionPct ──────────────────────────────────────────────────────────────

function pct(sites: Site[]) {
  if (!sites.length) return 0
  return Math.round((sites.filter(s => s.status === 'completed').length / sites.length) * 100)
}

function daysUntil(d: string) {
  return Math.ceil((new Date(d).getTime() - Date.now()) / 86400000)
}

// ── mini progress bar ──────────────────────────────────────────────────────────

function progressBar(doc: Doc, x: number, y: number, w: number, value: number, color: RGB) {
  doc.pdf.setFillColor(...C.surface)
  doc.pdf.roundedRect(x, y, w, 2, 0.5, 0.5, 'F')
  if (value > 0) {
    doc.pdf.setFillColor(...color)
    doc.pdf.roundedRect(x, y, w * value / 100, 2, 0.5, 0.5, 'F')
  }
}

// ── main export ───────────────────────────────────────────────────────────────

export async function generateExecutivePDF(
  project: Project,
  waves: WaveConfig[],
  aiReportText?: string
): Promise<void> {
  const doc = new Doc()
  const pdf = doc.pdf
  const sites = project.sites
  const total = sites.length

  // First page background
  doc.fillPage()
  doc.y = MARGIN

  // ── Cover band ────────────────────────────────────────────────────────────

  // Blue header stripe
  pdf.setFillColor(...C.blue)
  pdf.rect(0, 0, PAGE_W, 38, 'F')

  doc.y = 10
  pdf.setFontSize(18)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(255, 255, 255)
  pdf.text('EXECUTIVE REPORT', MARGIN, doc.y)

  doc.y = 19
  pdf.setFontSize(11)
  pdf.setFont('helvetica', 'normal')
  pdf.text(`${project.name}  ·  ${project.customer}`, MARGIN, doc.y)

  doc.y = 26
  pdf.setFontSize(8)
  pdf.setTextColor(200, 225, 255)
  const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  pdf.text(dateStr, MARGIN, doc.y)

  doc.y = 44

  // ── KPI row ────────────────────────────────────────────────────────────────

  const completed  = sites.filter(s => s.status === 'completed').length
  const blocked    = sites.filter(s => s.status === 'blocked').length
  const inProgress = sites.filter(s => s.status === 'in_progress').length
  const diaReady   = sites.filter(isSiteDIAReady).length
  const logReady   = sites.filter(isSiteLogisticsReady).length
  const overall    = pct(sites)

  const kpis = [
    { label: 'Total Sites',   value: String(total),             color: C.blue },
    { label: 'Completed',     value: String(completed),         color: C.green },
    { label: 'In Progress',   value: String(inProgress),        color: C.cyan },
    { label: 'Blocked',       value: String(blocked),           color: C.red },
    { label: 'DIA Ready',     value: `${diaReady}/${total}`,    color: C.purple },
    { label: 'Devices Inst.', value: `${logReady}/${total}`,    color: C.orange },
  ]

  const kpiW = COL_W / kpis.length
  kpis.forEach((k, i) => {
    const x = MARGIN + i * kpiW
    doc.rect(x, kpiW - 4, 14, C.surface, C.border)
    pdf.setFillColor(...k.color)
    pdf.roundedRect(x, doc.y, 2.5, 14, 0.5, 0.5, 'F')

    pdf.setFontSize(13)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...k.color)
    pdf.text(k.value, x + 5, doc.y + 5.5)

    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...C.muted)
    pdf.text(k.label.toUpperCase(), x + 5, doc.y + 10)
  })

  doc.y += 18

  // Overall progress bar
  pdf.setFontSize(7)
  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(...C.muted)
  pdf.text('OVERALL PROGRESS', MARGIN, doc.y)
  pdf.setTextColor(...C.white)
  pdf.text(`${overall}%`, PAGE_W - MARGIN, doc.y, { align: 'right' })
  doc.y += 3.5
  progressBar(doc, MARGIN, doc.y, COL_W, overall, C.blue)
  doc.y += 7

  // ── Waves ─────────────────────────────────────────────────────────────────

  doc.sectionTitle('Rollout Waves')

  const waveColors: RGB[] = [C.blue, C.purple, C.cyan]
  const waveW = COL_W / 3 - 2

  waves.forEach((w, i) => {
    const x    = MARGIN + i * (waveW + 3)
    const ws   = sites.filter(s => s.wave === w.wave)
    const wpct = pct(ws)
    const days = w.goLiveDate ? daysUntil(w.goLiveDate) : null
    const col  = waveColors[i]

    doc.rect(x, waveW, 24, C.surface, C.border)

    // Wave number pill
    pdf.setFillColor(...col)
    pdf.circle(x + 5, doc.y + 5, 3.5, 'F')
    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(255, 255, 255)
    pdf.text(String(w.wave), x + 5, doc.y + 5, { align: 'center' })

    pdf.setFontSize(8)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...C.white)
    pdf.text(w.label, x + 11, doc.y + 5)

    if (w.goLiveDate) {
      pdf.setFontSize(6.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(days !== null && days < 0 ? C.red[0] : C.muted[0], days !== null && days < 0 ? C.red[1] : C.muted[1], days !== null && days < 0 ? C.red[2] : C.muted[2])
      const lbl = days === null ? '' : days < 0 ? `${Math.abs(days)}d overdue` : `T-${days} days`
      pdf.text(`${lbl}  ·  ${new Date(w.goLiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, x + 4, doc.y + 11.5)
    }

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...C.muted)
    pdf.text(`${ws.length} sites  ·  ${wpct}% done`, x + 4, doc.y + 16.5)

    progressBar(doc, x + 4, doc.y + 19.5, waveW - 8, wpct, col)
  })

  doc.y += 28

  // ── Country Delay Analysis ────────────────────────────────────────────────

  doc.need(40)
  doc.sectionTitle('Country Delay Analysis')

  // table header
  const cols = [
    { label: 'Country',  x: MARGIN,      w: 40 },
    { label: 'Sites',    x: MARGIN + 40, w: 18 },
    { label: 'Done',     x: MARGIN + 58, w: 18 },
    { label: 'Blocked',  x: MARGIN + 76, w: 18 },
    { label: 'Progress', x: MARGIN + 94, w: 60 },
    { label: 'Status',   x: MARGIN + 154,w: 28 },
  ]

  pdf.setFillColor(...C.surface)
  pdf.rect(MARGIN, doc.y, COL_W, 6, 'F')
  cols.forEach(c => {
    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...C.muted)
    pdf.text(c.label.toUpperCase(), c.x + 2, doc.y + 4)
  })
  doc.y += 8

  // country map
  const countryMap: Record<string, { total: number; completed: number; blocked: number; pending: number }> = {}
  for (const s of sites) {
    if (!countryMap[s.country]) countryMap[s.country] = { total: 0, completed: 0, blocked: 0, pending: 0 }
    countryMap[s.country].total++
    if (s.status === 'completed') countryMap[s.country].completed++
    else if (s.status === 'blocked') countryMap[s.country].blocked++
    else countryMap[s.country].pending++
  }

  const countryRows = Object.entries(countryMap)
    .map(([country, d]) => ({
      country, ...d,
      pct: Math.round((d.completed / d.total) * 100),
      status: d.blocked / d.total > 0.2 ? 'Delayed' : d.blocked > 0 ? 'At Risk' : d.completed / d.total > 0.8 ? 'On Track' : 'In Progress',
    }))
    .sort((a, b) => b.total - a.total)

  const statusColor: Record<string, RGB> = {
    'On Track': C.green, 'In Progress': C.blue, 'At Risk': C.yellow, 'Delayed': C.red,
  }

  countryRows.forEach((row, i) => {
    doc.need(8)
    if (i % 2 === 0) {
      pdf.setFillColor(22, 33, 55)
      pdf.rect(MARGIN, doc.y - 1, COL_W, 7, 'F')
    }

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...C.white)
    pdf.text(row.country, cols[0].x + 2, doc.y + 3.5)

    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...C.muted)
    pdf.text(String(row.total),     cols[1].x + 2, doc.y + 3.5)

    pdf.setTextColor(...C.green)
    pdf.text(String(row.completed), cols[2].x + 2, doc.y + 3.5)

    pdf.setTextColor(row.blocked > 0 ? C.red[0] : C.muted[0], row.blocked > 0 ? C.red[1] : C.muted[1], row.blocked > 0 ? C.red[2] : C.muted[2])
    pdf.text(String(row.blocked),   cols[3].x + 2, doc.y + 3.5)

    progressBar(doc, cols[4].x + 2, doc.y + 1.5, 50, row.pct, statusColor[row.status])
    pdf.setTextColor(...C.muted)
    pdf.text(`${row.pct}%`, cols[4].x + 56, doc.y + 3.5)

    const sc = statusColor[row.status]
    pdf.setFillColor(sc[0], sc[1], sc[2], )
    pdf.setFillColor(sc[0] * 0.2, sc[1] * 0.2, sc[2] * 0.2)
    pdf.roundedRect(cols[5].x + 2, doc.y + 0.5, 24, 5.5, 1, 1, 'F')
    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...sc)
    pdf.text(row.status, cols[5].x + 14, doc.y + 4, { align: 'center' })

    doc.y += 7
  })

  doc.y += 4

  // ── Risk Register ─────────────────────────────────────────────────────────

  doc.need(20)
  doc.sectionTitle('Risk Register')

  type RL = 'low' | 'medium' | 'high' | 'critical'
  const riskColor: Record<RL, RGB> = { low: C.green, medium: C.yellow, high: C.orange, critical: C.red }
  const riskLabel: Record<RL, string> = { low: 'LOW', medium: 'MED', high: 'HIGH', critical: 'CRIT' }

  const diaP = total ? Math.round(diaReady / total * 100) : 0
  const logP = total ? Math.round(logReady / total * 100) : 0
  const bPct = total ? Math.round(blocked / total * 100) : 0

  const risks = [
    { title: 'DIA Circuit Delays',     prob: diaP < 30 ? 'high' : diaP < 60 ? 'medium' : 'low', impact: 'high', desc: `${diaReady}/${total} sites DIA-confirmed (${diaP}%)` },
    { title: 'Device Logistics Gap',   prob: logP < 30 ? 'high' : logP < 70 ? 'medium' : 'low', impact: 'high', desc: `${logReady}/${total} routers installed (${logP}%)` },
    { title: 'High Blockage Rate',     prob: bPct > 20 ? 'high' : bPct > 0 ? 'low' : 'low',    impact: bPct > 20 ? 'high' : 'medium', desc: `${blocked} site(s) blocked (${bPct}%)` },
    { title: 'Go-Live Schedule Risk',  prob: overall < 60 ? 'medium' : 'low',                   impact: 'high', desc: `Overall completion at ${overall}%` },
    { title: 'Country Concentration',  prob: 'low',                                              impact: 'medium', desc: `${Object.keys(countryMap).length} countries in scope` },
  ] as { title: string; prob: RL; impact: RL; desc: string }[]

  risks.forEach(r => {
    doc.need(10)
    pdf.setFillColor(...C.surface)
    pdf.roundedRect(MARGIN, doc.y, COL_W, 9, 1, 1, 'F')

    const pc = riskColor[r.prob], ic = riskColor[r.impact]

    // Probability pill
    pdf.setFillColor(pc[0] * 0.25, pc[1] * 0.25, pc[2] * 0.25)
    pdf.roundedRect(MARGIN + 2, doc.y + 2, 14, 5, 1, 1, 'F')
    pdf.setFontSize(5.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...pc)
    pdf.text(`P: ${riskLabel[r.prob]}`, MARGIN + 9, doc.y + 5.2, { align: 'center' })

    // Impact pill
    pdf.setFillColor(ic[0] * 0.25, ic[1] * 0.25, ic[2] * 0.25)
    pdf.roundedRect(MARGIN + 18, doc.y + 2, 14, 5, 1, 1, 'F')
    pdf.setFontSize(5.5)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...ic)
    pdf.text(`I: ${riskLabel[r.impact]}`, MARGIN + 25, doc.y + 5.2, { align: 'center' })

    pdf.setFontSize(7)
    pdf.setFont('helvetica', 'bold')
    pdf.setTextColor(...C.white)
    pdf.text(r.title, MARGIN + 36, doc.y + 4)

    pdf.setFontSize(6.5)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...C.muted)
    pdf.text(r.desc, MARGIN + 36, doc.y + 7.5)

    doc.y += 11
  })

  doc.y += 4

  // ── T-Minus Summary ───────────────────────────────────────────────────────

  const firstWave = waves.find(w => w.goLiveDate)
  if (firstWave?.goLiveDate) {
    doc.need(50)
    doc.sectionTitle(`T-Minus Summary  ·  Wave ${firstWave.wave} Go-Live: ${new Date(firstWave.goLiveDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`)

    const milestones = [
      { label: 'DIA Circuits Confirmed', done: diaReady,                                           t: 30, color: C.cyan },
      { label: 'Devices Delivered',      done: sites.filter(s => s.routers?.every(r => ['delivered','installed'].includes(r.status))).length, t: 14, color: C.orange },
      { label: 'Routers Installed',      done: logReady,                                           t: 7,  color: C.yellow },
      { label: 'KMZ Documents Ready',    done: sites.filter(s => s.kmzGenerated).length,           t: 21, color: C.purple },
      { label: 'Sites Completed',        done: completed,                                           t: 0,  color: C.green },
    ]

    milestones.forEach(m => {
      doc.need(10)
      const mpct = total ? Math.round(m.done / total * 100) : 0
      const deadline = new Date(new Date(firstWave.goLiveDate!).getTime() - m.t * 86400000)
      const dLeft = Math.ceil((deadline.getTime() - Date.now()) / 86400000)
      const isDone = mpct === 100
      const isOverdue = !isDone && dLeft < 0

      const dotColor: RGB = isDone ? C.green : isOverdue ? C.red : dLeft < 7 ? C.yellow : C.muted

      // Dot
      pdf.setFillColor(...dotColor)
      pdf.circle(MARGIN + 3, doc.y + 3.5, 2, 'F')

      pdf.setFontSize(7.5)
      pdf.setFont('helvetica', isDone ? 'bold' : 'normal')
      pdf.setTextColor(...(isDone ? C.green : isOverdue ? C.red : C.white))
      pdf.text(m.label, MARGIN + 9, doc.y + 4)

      // Status badge
      const badgeLabel = isDone ? 'DONE' : isOverdue ? `${Math.abs(dLeft)}d OVERDUE` : `T-${m.t}d · ${dLeft}d left`
      pdf.setFontSize(6)
      pdf.setFont('helvetica', 'bold')
      pdf.setTextColor(...dotColor)
      pdf.text(badgeLabel, PAGE_W - MARGIN, doc.y + 4, { align: 'right' })

      // Progress bar
      progressBar(doc, MARGIN + 9, doc.y + 6, COL_W - 60, mpct, m.color)
      pdf.setFontSize(6)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...C.muted)
      pdf.text(`${m.done}/${total} (${mpct}%)`, MARGIN + COL_W - 50, doc.y + 7.5)

      doc.y += 11
    })

    doc.y += 2
  }

  // ── AI Executive Report text ───────────────────────────────────────────────

  if (aiReportText) {
    doc.need(20)
    doc.sectionTitle('AI Executive Summary')

    const lines = pdf.splitTextToSize(aiReportText, COL_W)
    lines.forEach((line: string) => {
      doc.need(5)
      pdf.setFontSize(7.5)
      pdf.setFont('helvetica', 'normal')
      pdf.setTextColor(...C.white)
      pdf.text(line, MARGIN, doc.y)
      doc.y += 4.5
    })
  }

  // ── Footer on every page ──────────────────────────────────────────────────

  const pageCount = pdf.getNumberOfPages()
  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i)
    pdf.setDrawColor(...C.border)
    pdf.line(MARGIN, PAGE_H - 10, PAGE_W - MARGIN, PAGE_H - 10)
    pdf.setFontSize(6)
    pdf.setFont('helvetica', 'normal')
    pdf.setTextColor(...C.muted)
    pdf.text(`${project.name}  ·  Confidential`, MARGIN, PAGE_H - 6)
    pdf.text(`Page ${i} of ${pageCount}`, PAGE_W - MARGIN, PAGE_H - 6, { align: 'right' })
  }

  // ── Save ──────────────────────────────────────────────────────────────────

  const filename = `${project.name.replace(/\s+/g, '_')}_Executive_Report_${new Date().toISOString().slice(0, 10)}.pdf`
  pdf.save(filename)
}
