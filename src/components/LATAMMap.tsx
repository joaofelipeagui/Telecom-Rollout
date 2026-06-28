'use client'
import { useEffect, useRef, useState } from 'react'
import { Site } from '@/lib/types'

const STATUS_COLORS = {
  completed:   '#22c55e',
  in_progress: '#3b82f6',
  blocked:     '#ef4444',
  pending:     '#6b7280',
}

const STATUS_LABELS = {
  completed:   'Completed',
  in_progress: 'In Progress',
  blocked:     'Blocked',
  pending:     'Pending',
}

interface Props {
  sites: Site[]
  onSiteClick?: (site: Site) => void
}

export function LATAMMap({ sites, onSiteClick }: Props) {
  const mapRef      = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<mapboxgl.Map | null>(null)
  const [loaded, setLoaded] = useState(false)
  const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN

  useEffect(() => {
    if (!token || !mapRef.current || mapInstance.current) return

    import('mapbox-gl').then(({ default: mapboxgl }) => {
      import('mapbox-gl/dist/mapbox-gl.css')
      mapboxgl.accessToken = token

      const map = new mapboxgl.Map({
        container: mapRef.current!,
        style: 'mapbox://styles/mapbox/dark-v11',
        center: [10, 20],
        zoom: 1.6,
        projection: 'mercator' as any,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

      map.on('load', () => {
        setLoaded(true)
        mapInstance.current = map

        sites.filter(s => s.lat && s.lng).forEach(site => {
          // Marker element
          const el = document.createElement('div')
          const color = STATUS_COLORS[site.status]
          el.style.cssText = `
            width: 12px; height: 12px; border-radius: 50%;
            background: ${color};
            border: 2px solid rgba(255,255,255,0.4);
            cursor: pointer;
            transition: transform 0.15s;
            box-shadow: 0 0 8px ${color}99;
          `
          el.addEventListener('mouseenter', () => { el.style.transform = 'scale(2)' })
          el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

          // DIA info
          const diaTotal     = Object.keys(site.dias).length
          const diaConfirmed = Object.values(site.dias).filter(
            d => d.status === 'confirmed' || d.status === 'diverse_confirmed'
          ).length
          const checklistDone = (site.checklist ?? []).filter(c => c.done).length
          const checklistTotal = (site.checklist ?? []).length

          const waveHtml = site.wave
            ? `<span style="background:#1e3a5f;color:#93c5fd;font-size:10px;padding:1px 6px;border-radius:9999px;font-weight:600">Wave ${site.wave}</span>`
            : ''

          const diaHtml = diaTotal > 0
            ? `<div style="display:flex;align-items:center;gap:6px;margin-top:5px">
                <div style="font-size:10px;color:#9ca3af">DIA</div>
                <div style="font-size:10px;color:${diaConfirmed === diaTotal ? '#4ade80' : '#facc15'};font-weight:600">
                  ${diaConfirmed}/${diaTotal} confirmed
                </div>
               </div>`
            : ''

          const checklistHtml = checklistTotal > 0
            ? `<div style="display:flex;align-items:center;gap:6px;margin-top:3px">
                <div style="font-size:10px;color:#9ca3af">Checklist</div>
                <div style="font-size:10px;color:#d1d5db;font-weight:600">${checklistDone}/${checklistTotal}</div>
               </div>`
            : ''

          const popup = new mapboxgl.Popup({
            offset: 14,
            closeButton: false,
            maxWidth: '220px',
            className: 'site-popup',
          }).setHTML(`
            <div style="font-family:system-ui,sans-serif;padding:2px 0;min-width:180px">
              <div style="font-weight:700;font-size:13px;color:#fff;line-height:1.3;margin-bottom:4px">
                ${site.name}
              </div>
              <div style="font-size:11px;color:#9ca3af;margin-bottom:6px">
                ${[site.city, site.country].filter(Boolean).join(', ')}
              </div>
              <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
                <span style="background:${color}22;color:${color};font-size:10px;padding:1px 6px;border-radius:9999px;font-weight:600;border:1px solid ${color}44">
                  ${STATUS_LABELS[site.status]}
                </span>
                ${waveHtml}
              </div>
              ${diaHtml}
              ${checklistHtml}
              <div style="margin-top:8px;padding-top:7px;border-top:1px solid #1f2937">
                <div style="font-size:11px;color:#60a5fa;font-weight:600;cursor:pointer" data-site-id="${site.id}">
                  View site details →
                </div>
              </div>
            </div>
          `)

          const marker = new mapboxgl.Marker({ element: el })
            .setLngLat([site.lng!, site.lat!])
            .setPopup(popup)
            .addTo(map)

          // Click pin → open popup
          el.addEventListener('click', (e) => {
            e.stopPropagation()
            marker.togglePopup()
          })

          // Delegate click on "View site details" link inside popup
          popup.on('open', () => {
            setTimeout(() => {
              const link = document.querySelector(`[data-site-id="${site.id}"]`)
              link?.addEventListener('click', () => {
                popup.remove()
                onSiteClick?.(site)
              })
            }, 50)
          })
        })
      })
    })

    return () => { mapInstance.current?.remove(); mapInstance.current = null }
  }, [token, sites.length])

  if (!token) return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-xl">
      <p className="text-gray-500 text-sm">Configure MAPBOX_TOKEN for the map</p>
    </div>
  )

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      <div className="absolute bottom-10 left-3 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-2 space-y-1">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-xs text-gray-300 capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
      <style>{`
        .mapboxgl-popup-content {
          background: #0f172a !important;
          border: 1px solid #1e293b !important;
          border-radius: 10px !important;
          padding: 12px 14px !important;
          box-shadow: 0 8px 32px rgba(0,0,0,0.6) !important;
        }
        .mapboxgl-popup-tip { display: none !important; }
      `}</style>
    </div>
  )
}
