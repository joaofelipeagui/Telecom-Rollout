import crypto from 'crypto'

interface CodeRecord {
  email: string
  name: string
  issuedAt: string
}

// In-memory store — persists between requests, resets on redeploy (fine for demo)
const store = new Map<string, CodeRecord>()

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // no 0/O/1/I confusion

export function generateCode(): string {
  const bytes = crypto.randomBytes(8)
  return Array.from({ length: 8 }, (_, i) => CHARS[bytes[i] % CHARS.length]).join('')
}

export function issueCode(name: string, email: string): string {
  // If this email already has a code, reuse it
  for (const [code, rec] of store.entries()) {
    if (rec.email.toLowerCase() === email.toLowerCase()) return code
  }
  const code = generateCode()
  store.set(code, { email, name, issuedAt: new Date().toISOString() })
  return code
}

export function isValidCode(code: string): boolean {
  const upper = code.trim().toUpperCase()
  // Check env var codes
  const multi  = process.env.NEXT_PUBLIC_ACCESS_CODES ?? ''
  const single = process.env.NEXT_PUBLIC_ACCESS_CODE  ?? 'DEMO2025'
  const envCodes = (multi ? multi.split(',') : [single]).map(c => c.trim().toUpperCase())
  if (envCodes.includes(upper)) return true
  // Check issued codes
  return store.has(upper)
}
