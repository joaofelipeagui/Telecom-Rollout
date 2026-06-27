'use client'
import { useEffect, useRef, useState } from 'react'
import { Site } from '@/lib/types'

const STATUS_COLORS = {
  completed: '#22c55e',
  in_progress: '#3b82f6',
  blocked: '#ef4444',
  pending: '#6b7280',
}

interface Props {
  sites: Site[]
  onSiteClick?: (site: Site) => void
}

export function LATAMMap({ sites, onSiteClick }: Props) {
  const mapRef = useRef<HTMLDivElement>(null)
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
        center: [-60, -15],
        zoom: 2.8,
        projection: 'mercator' as any,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'bottom-right')

      map.on('load', () => {
        setLoaded(true)
        mapInstance.current = map

        const sitesWithCoords = sites.filter(s => s.lat && s.lng)

        // Add site markers
        sitesWithCoords.forEach(site => {
          const el = document.createElement('div')
          el.style.cssText = `
            width: 10px; height: 10px; border-radius: 50%;
            background: ${STATUS_COLORS[site.status]};
            border: 2px solid rgba(255,255,255,0.3);
            cursor: pointer;
            transition: transform 0.15s;
            box-shadow: 0 0 6px ${STATUS_COLORS[site.status]}88;
          `
          el.addEventListener('mouseenter', () => { el.style.transform = 'scale(1.8)' })
          el.addEventListener('mouseleave', () => { el.style.transform = 'scale(1)' })

          const popup = new mapboxgl.Popup({ offset: 12, closeButton: false })
            .setHTML(`
              <div style="font-family:sans-serif;padding:4px 0">
                <div style="font-weight:600;font-size:13px;color:#fff">${site.name}</div>
                <div style="font-size:11px;color:#9ca3af">${site.city}, ${site.country || ''}</div>
                <div style="font-size:11px;margin-top:4px;color:${STATUS_COLORS[site.status]};font-weight:500">
                  ${site.status.replace('_', ' ').toUpperCase()}
                </div>
              </div>
            `)

          new mapboxgl.Marker({ element: el })
            .setLngLat([site.lng!, site.lat!])
            .setPopup(popup)
            .addTo(map)

          el.addEventListener('click', () => onSiteClick?.(site))
        })
      })
    })

    return () => { mapInstance.current?.remove(); mapInstance.current = null }
  }, [token, sites.length])

  if (!token) return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 rounded-xl">
      <p className="text-gray-500 text-sm">Configure MAPBOX_TOKEN for the LATAM map</p>
    </div>
  )

  return (
    <div className="relative w-full h-full rounded-xl overflow-hidden">
      <div ref={mapRef} className="w-full h-full" />
      {/* Legend */}
      <div className="absolute bottom-10 left-3 bg-gray-900/90 backdrop-blur border border-gray-700 rounded-lg px-3 py-2 space-y-1">
        {Object.entries(STATUS_COLORS).map(([status, color]) => (
          <div key={status} className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: color }} />
            <span className="text-xs text-gray-300 capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
