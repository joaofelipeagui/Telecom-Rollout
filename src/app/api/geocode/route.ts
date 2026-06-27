import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const address = req.nextUrl.searchParams.get('address')
  const country = req.nextUrl.searchParams.get('country') || 'Brazil'
  if (!address) return NextResponse.json({ error: 'No address' }, { status: 400 })

  const token = process.env.MAPBOX_TOKEN
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(address + ', ' + country)}.json?access_token=${token}&limit=1`

  const res = await fetch(url)
  const data = await res.json()

  if (!data.features?.length) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const [lng, lat] = data.features[0].center
  return NextResponse.json({ lat, lng })
}
