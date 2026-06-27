import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const flightNumber = req.nextUrl.searchParams.get('flight')
  if (!flightNumber) return NextResponse.json({ error: 'No flight number' }, { status: 400 })

  const key = process.env.AVIATIONSTACK_KEY
  if (!key) return NextResponse.json({ error: 'No API key configured' }, { status: 500 })

  const iata = flightNumber.replace(/\s+/g, '').toUpperCase()
  const url = `http://api.aviationstack.com/v1/flights?access_key=${key}&flight_iata=${iata}&limit=1`

  try {
    const res = await fetch(url)
    const data = await res.json()

    if (!data.data?.length) {
      return NextResponse.json({ error: 'Flight not found' }, { status: 404 })
    }

    const f = data.data[0]
    return NextResponse.json({
      flightNumber: f.flight?.iata,
      status: f.flight_status,
      departure: {
        airport: f.departure?.airport,
        iata: f.departure?.iata,
        scheduled: f.departure?.scheduled,
        actual: f.departure?.actual,
      },
      arrival: {
        airport: f.arrival?.airport,
        iata: f.arrival?.iata,
        scheduled: f.arrival?.scheduled,
        estimated: f.arrival?.estimated,
        actual: f.arrival?.actual,
      },
      airline: f.airline?.name,
    })
  } catch {
    return NextResponse.json({ error: 'Failed to fetch flight data' }, { status: 500 })
  }
}
