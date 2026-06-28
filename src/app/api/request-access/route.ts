import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { issueCode } from '@/lib/accessCodes'

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })

  const { name, email, message } = await req.json()
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  const resend    = new Resend(apiKey)
  const ownerEmail = process.env.OWNER_EMAIL ?? 'felipe.aguiar29@gmail.com'
  const appUrl    = process.env.NEXT_PUBLIC_APP_URL ?? 'your app URL'
  const now       = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })
  const code      = issueCode(name, email)

  // ── Email to requester with their code ──
  const toRequester = resend.emails.send({
    from: 'Telecom Rollout PM <onboarding@resend.dev>',
    to: email,
    subject: `Your Access Code — Telecom Rollout PM`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#f1f5f9;border-radius:12px;overflow:hidden">
        <div style="background:#1e3a5f;padding:24px 28px;border-bottom:1px solid #334155">
          <h2 style="margin:0;font-size:18px;color:#60a5fa">🔐 Your Access Code</h2>
          <p style="margin:4px 0 0;font-size:13px;color:#94a3b8">Telecom Rollout PM</p>
        </div>
        <div style="padding:28px">
          <p style="margin:0 0 8px;font-size:14px;color:#cbd5e1">Hi ${name},</p>
          <p style="margin:0 0 24px;font-size:14px;color:#94a3b8">Your personal access code is ready. Use it to sign in:</p>
          <div style="background:#0f2744;border:1px solid #1e40af;border-radius:10px;padding:20px;text-align:center;margin-bottom:24px">
            <p style="margin:0 0 6px;font-size:12px;color:#60a5fa;letter-spacing:2px;text-transform:uppercase">Access Code</p>
            <p style="margin:0;font-size:28px;font-weight:700;color:#fff;letter-spacing:6px;font-family:monospace">${code}</p>
          </div>
          <a href="${appUrl}"
             style="display:block;background:#2563eb;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;text-align:center;margin-bottom:20px">
            Open Telecom Rollout PM →
          </a>
          <p style="margin:0;font-size:12px;color:#475569">This code is personal to you (${email}). Do not share it.</p>
        </div>
      </div>
    `,
  })

  // ── Notification to owner ──
  const toOwner = resend.emails.send({
    from: 'Telecom Rollout PM <onboarding@resend.dev>',
    to: ownerEmail,
    subject: `Access Granted — ${name}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#f1f5f9;border-radius:12px;overflow:hidden">
        <div style="background:#14532d;padding:24px 28px;border-bottom:1px solid #166534">
          <h2 style="margin:0;font-size:18px;color:#4ade80">✅ Access Code Issued</h2>
          <p style="margin:4px 0 0;font-size:13px;color:#86efac">Telecom Rollout PM</p>
        </div>
        <div style="padding:24px 28px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:90px">Name</td>
                <td style="padding:8px 0;font-size:14px;font-weight:600;color:#f1f5f9">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Email</td>
                <td style="padding:8px 0;font-size:14px"><a href="mailto:${email}" style="color:#60a5fa">${email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Code</td>
                <td style="padding:8px 0;font-size:16px;font-weight:700;color:#fff;font-family:monospace;letter-spacing:3px">${code}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Time</td>
                <td style="padding:8px 0;font-size:13px;color:#94a3b8">${now}</td></tr>
            ${message ? `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top">Message</td>
                <td style="padding:8px 0;font-size:13px;color:#cbd5e1">${message}</td></tr>` : ''}
          </table>
          <p style="margin:16px 0 0;font-size:12px;color:#475569">The code was automatically sent to the requester's email.</p>
        </div>
      </div>
    `,
  })

  const [r1, r2] = await Promise.all([toRequester, toOwner])
  if (r1.error) return NextResponse.json({ error: r1.error.message }, { status: 500 })
  if (r2.error) console.warn('Owner notification failed:', r2.error.message)

  return NextResponse.json({ ok: true })
}
