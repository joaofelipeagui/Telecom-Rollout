import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

export async function POST(req: NextRequest) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return NextResponse.json({ error: 'Email service not configured' }, { status: 500 })

  const { name, email, message } = await req.json()
  if (!name || !email) return NextResponse.json({ error: 'Name and email required' }, { status: 400 })

  const resend = new Resend(apiKey)
  const ownerEmail = process.env.OWNER_EMAIL ?? 'felipe.aguiar29@gmail.com'
  const now = new Date().toLocaleString('en-GB', { dateStyle: 'full', timeStyle: 'short' })

  const { error } = await resend.emails.send({
    from: 'Telecom Rollout PM <onboarding@resend.dev>',
    to: ownerEmail,
    subject: `Access Request — ${name}`,
    html: `
      <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#0f172a;color:#f1f5f9;border-radius:12px;overflow:hidden">
        <div style="background:#1e3a5f;padding:24px 28px;border-bottom:1px solid #334155">
          <h2 style="margin:0;font-size:18px;color:#60a5fa">🔐 New Access Request</h2>
          <p style="margin:4px 0 0;font-size:13px;color:#94a3b8">Telecom Rollout PM</p>
        </div>
        <div style="padding:24px 28px">
          <table style="width:100%;border-collapse:collapse">
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;width:90px">Name</td>
                <td style="padding:8px 0;font-size:14px;font-weight:600;color:#f1f5f9">${name}</td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Email</td>
                <td style="padding:8px 0;font-size:14px"><a href="mailto:${email}" style="color:#60a5fa">${email}</a></td></tr>
            <tr><td style="padding:8px 0;color:#94a3b8;font-size:13px">Time</td>
                <td style="padding:8px 0;font-size:13px;color:#94a3b8">${now}</td></tr>
            ${message ? `<tr><td style="padding:8px 0;color:#94a3b8;font-size:13px;vertical-align:top">Message</td>
                <td style="padding:8px 0;font-size:13px;color:#cbd5e1">${message}</td></tr>` : ''}
          </table>
        </div>
        <div style="padding:16px 28px;border-top:1px solid #1e293b">
          <a href="mailto:${email}?subject=Re: Telecom Rollout PM Access&body=Hi ${encodeURIComponent(name)},%0A%0AYour access code is: "
             style="display:inline-block;background:#2563eb;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:13px;font-weight:600">
            Reply with access code →
          </a>
        </div>
      </div>
    `,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
