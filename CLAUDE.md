@AGENTS.md

# Telecom Rollout PM — System Prompt

## What this is
An AI-powered program management tool for enterprise telecom network rollouts, built for João Felipe (Program Manager, felipe.aguiar29@gmail.com). Manages multi-country, multi-wave site rollouts — tracking DIA circuits, site status, shipments, escalations, go-live timelines, and diversity path assurance.

**Repo:** github.com/joaofelipeagui/Telecom-Rollout  
**Live:** Railway (auto-deploys on push to main)  
**Local:** `C:\Users\DELL\Documents\telecom-rollout-pm`  
**API keys:** `.env.local` and Railway env vars only — NEVER in chat or committed to git

---

## Stack

| Layer | Tech |
|---|---|
| Framework | Next.js 16 App Router, TypeScript |
| UI | Tailwind CSS, shadcn/ui, Lucide icons |
| Maps | Mapbox GL JS (dark-v11) — world map with animated HTML markers and GeoJSON route lines |
| AI | Google Gemini API (`gemini-2.0-flash`) — free tier |
| Export | jsPDF (PDF), JSZip (KMZ) |
| Persistence | localStorage — no database, demo-friendly |
| Deploy | Railway |

**Critical Mapbox rules:**
- Import CSS via `@import "mapbox-gl/dist/mapbox-gl.css"` in `globals.css` — never dynamic import in useEffect
- Map `<div>` must always stay in DOM — never conditionally unmount it
- Map init `useEffect` deps must be `[token]` only — adding state vars that change post-mount destroys and re-creates the map

---

## Roles (6)
`program_manager`, `field_engineer`, `sdwan_engineer`, `telco_engineer`, `solutions_manager`, `solutions_director`

Each role sees different tabs in `src/app/projects/[id]/page.tsx`.

---

## Data Model (src/lib/types.ts)

### Core types
- **Site** — id, name, address, city, state, country, lat, lng, wave (1|2|3), status, refreshType, dias, checklist, photos, createdAt
- **DIA** — provider, status, circuitNumber, requestedAt, slaDate, confirmedAt, pathA, pathB, diversityConfirmed
- **Project** — id, name, role, sites[], waves[], escalations[], changeLog[]
- **Escalation** — id, siteId, priority (low|medium|high|critical), status (open|in_progress|resolved), title, description, assignee, dueDate, resolution
- **Wave** — number (1|2|3), name, goLiveDate, region

### Enums
```
DIAStatus:   not_requested → requested → received → confirmed → diverse_confirmed
RefreshType: SDWAN | SAP | WIFI | FIBER | MPLS | LTE | VOIP | COLOC | HYBRID | DIA_ONLY
Provider:    Claro | Vivo | TIM | Oi | Embratel
Site.status: pending | in_progress | completed | blocked
```

### Budget model (ExecDashboard)
```
SDWAN $18K, SAP $22K, WIFI $12K, FIBER $28K, MPLS $20K,
LTE $8K, VOIP $14K, COLOC $35K, HYBRID $24K, DIA_ONLY $10K
```

### RAG computation
```
Red:   blockedPct > 15% OR progress < 20% OR budgetVariance > 20%
Amber: blockedPct > 8%  OR progress < 55% OR budgetVariance > 8%
Green: everything else
```

---

## Key Source Files

```
src/
├── lib/
│   ├── types.ts              Core types, COUNTRY_CARRIERS, PROVIDERS, getRegionForCountry()
│   ├── store.ts              localStorage CRUD — updateSite, addEscalation, getSiteStats()
│   ├── demoSites.ts          52 demo sites across 4 regions, mid-rollout state (46% complete)
│   ├── csv.ts                exportProjectCSV()
│   ├── pdf.ts                generateExecutivePDF() — jsPDF dark navy A4
│   └── kmz.ts                generateKMZ() — JSZip KML export
├── app/
│   ├── globals.css           Mapbox CSS import + panel-texture, card-glow, dot-green/blue/red
│   ├── layout.tsx            Dark mode, panel-texture body
│   ├── page.tsx              Dashboard: KPI cards, project list
│   └── projects/[id]/
│       └── page.tsx          Project detail: 6-role tab system
│   api/
│       ├── geocode/          Mapbox geocoding for CSV-imported sites (no lat/lng)
│       ├── ai/               Gemini AI narrative generation
│       ├── validate-code/    Access code validation (built, disconnected)
│       └── request-access/   Resend email access request (built, disconnected)
└── components/
    ├── ExecDashboard.tsx     RAG badge, 4 KPI cards, budget tracker, velocity sparkline,
    │                         wave milestone timeline, region performance, risk register,
    │                         executive action items, Print/PDF export
    ├── LogisticsMap.tsx      Mapbox world map, per-site shipment tracking panel (FedEx-style),
    │                         5 KPI filter cards (Active/Air/Road/Delivered/Customs),
    │                         geocoding overlay for CSV-imported sites
    ├── NetworkMonitor.tsx    Live event stream — 50+ event types per refresh type,
    │                         pause/play, severity filters, auto-scroll
    ├── SiteDetailPanel.tsx   DIA Circuits, Checklist (14 items), Photos, SLA countdown,
    │                         satellite map
    ├── ExecutiveReport.tsx   Wave cards, T-Minus timeline, Country Delay Analysis,
    │                         Risk Heatmap, AI narrative, PDF export
    ├── EscalationTracker.tsx Raise/manage escalations: priority, status, assignee, due date
    ├── GanttView.tsx         CSS Gantt: wave bars, milestone diamonds, today line, go-live flag
    ├── ChangeLog.tsx         Grouped by date, field/old→new diffs
    ├── DIAMatrix.tsx         Per-provider circuit status grid
    ├── CarrierScorecard.tsx  Carrier performance metrics
    ├── SLAAlerts.tsx         SLA deadline countdown alerts
    ├── AccessGate.tsx        Multi-code access gate (built but DISCONNECTED from layout)
    ├── roles/
    │   └── DirectorView.tsx  KPI cards + KMZ export
    ├── AddSiteDialog.tsx     Wave selection dropdown
    ├── NewProjectDialog.tsx  CSV parser with quoted-field regex fix; loads DEMO_SITES
    └── Sidebar.tsx           bg-[#070d16], blue shadow, sidebar-active-glow
```

---

## Logistics Map — Shipment Model

Shipments are auto-generated from `in_progress` and `pending` sites. Each site gets one shipment.

```typescript
type Shipment = {
  id: string
  siteId: string
  siteName: string
  status: 'in_transit' | 'delivered' | 'customs' | 'preparing'
  transport: 'air' | 'truck'
  speedTier: 'fast' | 'normal' | 'slow'
  progress: number        // 0–100
  origin: { lat, lng }
  destination: { lat, lng }
  eta: string
  equipment: string[]
  trackingEvents: TrackingEvent[]
}
```

Regional hubs: NAM (Chicago), LATAM (São Paulo), EMEA (Frankfurt), APAC (Singapore) — each has air and ground origin points.

**Geocoding:** CSV-imported sites have no lat/lng → `geocodeSites()` async function calls `/api/geocode` before building shipments. Map div stays mounted during geocoding (overlay pattern).

---

## Demo Data (src/lib/demoSites.ts)

52 sites across NAM / LATAM / EMEA / MEA / APAC. Mid-rollout state:

| Status | Count | % |
|---|---|---|
| completed | 24 | 46% |
| in_progress | 14 | 27% |
| blocked | 3 | 6% (BUE, RUH, SZX) |
| pending | 11 | 21% |

Wave breakdown: W1=88% done, W2=43% done, W3=31% started.

DIA circuit data: `diverseOk` (diverse_confirmed), `confirmedOne`, `inProgress1`, `requested1` helpers — 65 total circuits, 38 confirmed.

Exec Dashboard RAG with demo data: **AMBER** (progress 46%, 3 blocked, budget on track).

---

## Design System

```
Background:   #070d16, #0a0f1a, #0d1424
Blue accent:  #3b82f6
CSS classes:  panel-texture, card-glow, sidebar-active-glow,
              dot-green, dot-blue, dot-red, dot-yellow,
              text-label, text-value, text-subvalue
```

Dark navy panel with dot-grid texture (panel-texture). Blue glow borders (card-glow). Sidebar with left blue accent line (sidebar-active-glow).

---

## Security Layer (built, currently disconnected)

Files exist but AccessGate is NOT wired to layout.tsx. To re-enable: wrap `{children}` in `<AccessGate>` in `src/app/layout.tsx`.

- Multi-code support: `NEXT_PUBLIC_ACCESS_CODES` (comma-separated) or `NEXT_PUBLIC_ACCESS_CODE`
- Owner email (felipe.aguiar29@gmail.com) always valid as access code
- Brute-force: 5 attempts → 15-min lockout in localStorage
- Request Access form → POST `/api/request-access` → Resend emails requester + owner
- Requires `RESEND_API_KEY` in Railway env vars (not yet configured)

---

## Environment Variables

| Variable | Purpose | Where |
|---|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapbox maps + geocoding | Railway + .env.local |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini AI | Railway + .env.local |
| `NEXT_PUBLIC_ACCESS_CODE` | Access gate code | Railway + .env.local |
| `OWNER_EMAIL` | Owner email for access gate | Railway + .env.local |
| `RESEND_API_KEY` | Email delivery (not yet set) | Railway only |

---

## CSV Import Format

Required columns: `name`, `address`, `city`, `state`, `country`, `wave`  
Optional: `status`, `type` (maps to refreshType)

Demo CSV files in `public/demo-csv/`:
- `global-sdwan-rollout.csv` (28 sites)
- `latam-fiber-mpls.csv` (27 sites)
- `emea-hybrid-sap.csv` (30 sites)

Real customer file: `C:\Users\DELL\Documents\Customer_Global_Sites_Import_Enhanced.csv` (105 sites, anonymized, includes `type` column)

---

## Excel Files (local, not in repo)

| File | Contents |
|---|---|
| `C:\Users\DELL\Documents\Customer_Global_Network_Sites.xlsx` | 104 sites anonymized (L'Oréal → "Customer"), 6 sheets: Sites, Circuit Tracker, Diversity Recommendations, Design Guide, Summary by Region, CSV Import |
| `C:\Users\DELL\Documents\Loreal_Global_Network_Sites.xlsx` | Original with L'Oréal branding — internal only |
| `C:\Users\DELL\Documents\Loreal_Global_Sites_Import.csv` | 104 sites CSV-ready for app import |

---

## Important Behavioral Rules

1. API keys NEVER in chat or git — only `.env.local` and Railway env vars
2. When editing LogisticsMap.tsx: keep map `<div>` always in DOM; don't add state vars to map init useEffect deps
3. The `Provider` type is limited to 5 Brazilian carriers — this is intentional for the demo scope
4. The `?share=1` URL param puts the project page in read-only mode (used for client sharing)
5. All data is in localStorage — no backend, no database — a full reset means clearing browser storage
