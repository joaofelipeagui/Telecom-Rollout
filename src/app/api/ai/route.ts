import Anthropic from '@anthropic-ai/sdk'
import { NextRequest, NextResponse } from 'next/server'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const TELECOM_SYSTEM = `You are an expert AI assistant embedded in a telecom network rollout program management system.
You help Program Managers, Solutions Directors, and field engineers track multi-country, multi-wave site rollouts.
You have deep knowledge of: DIA (Dedicated Internet Access) circuits, diversity path design, SD-WAN, MPLS, FIBER, LTE failover, COLOC, VOIP, SAP connectivity, and enterprise telecom best practices.
Telecom providers in scope: Claro, Vivo, TIM, Oi, Embratel.
Be concise, direct, and actionable. Use bullet points when listing items. Speak like a senior telecom PM.`

const VALID_IMAGE_MEDIA_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'] as const
type ImageMediaType = (typeof VALID_IMAGE_MEDIA_TYPES)[number]

function textFromMessage(msg: Anthropic.Message): string {
  const block = msg.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('Claude returned no text content')
  }
  return block.text
}

export async function POST(req: NextRequest) {
  try {
    const { type, payload } = await req.json()

    if (type === 'analyze_site') {
      const { address, city, state, imageBase64, imageMediaType } = payload

      const textPrompt = `${imageBase64 ? 'Analyze this satellite image of a customer site' : 'Based on the address'}: ${address}, ${city}${state ? ` - ${state}` : ''}.

Provide a brief technical site assessment covering:
1. Building type and size (enterprise HQ, data center, commercial, warehouse, etc.)
2. Roof access and equipment installation feasibility
3. Visible or likely nearby infrastructure (aerial cables, underground ducts, telco poles, PoPs)
4. Recommended diversity path entry points (primary and secondary)

Be concise and technical — 3 to 4 sentences. Focus on what matters for a telecom rollout PM.`

      const mediaType: ImageMediaType = VALID_IMAGE_MEDIA_TYPES.includes(imageMediaType)
        ? imageMediaType
        : 'image/png'

      const content: Anthropic.MessageParam['content'] = imageBase64
        ? [
            { type: 'image', source: { type: 'base64', media_type: mediaType, data: imageBase64 } },
            { type: 'text', text: textPrompt },
          ]
        : textPrompt

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: TELECOM_SYSTEM,
        messages: [{ role: 'user', content }],
      })
      return NextResponse.json({ result: textFromMessage(msg) })
    }

    if (type === 'query') {
      const { question, projectData } = payload

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: TELECOM_SYSTEM,
        messages: [{
          role: 'user',
          content: `Project data:\n${JSON.stringify(projectData, null, 2)}\n\nQuestion: ${question}`,
        }],
      })
      return NextResponse.json({ result: textFromMessage(msg) })
    }

    if (type === 'status_report') {
      const { projectData } = payload

      const msg = await client.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 2048,
        system: TELECOM_SYSTEM,
        messages: [{
          role: 'user',
          content: `Generate a professional weekly status report based on this project data:\n${JSON.stringify(projectData, null, 2)}\n\nStructure the report with these sections:\n- Executive Summary (2–3 sentences)\n- Overall Progress (wave-by-wave breakdown)\n- DIA Circuit Status (per provider)\n- Top Blockers & Risks\n- Recommended Actions for this week\n\nTone: direct, professional, suitable for a C-level audience.`,
        }],
      })
      return NextResponse.json({ result: textFromMessage(msg) })
    }

    return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
  } catch (err) {
    console.error('AI route error:', err)
    const message = err instanceof Error ? err.message : 'AI request failed'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
