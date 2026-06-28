import { NextRequest, NextResponse } from 'next/server'
import { isValidCode } from '@/lib/accessCodes'

export async function POST(req: NextRequest) {
  const { code } = await req.json()
  if (!code) return NextResponse.json({ valid: false })
  return NextResponse.json({ valid: isValidCode(code) })
}
