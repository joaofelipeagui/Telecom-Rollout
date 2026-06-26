import { GoogleGenerativeAI } from '@google/generative-ai'
import { NextRequest, NextResponse } from 'next/server'

const genai = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(req: NextRequest) {
  const { type, payload } = await req.json()

  if (type === 'analyze_site') {
    const { address, city, state, imageBase64 } = payload
    const model = genai.getGenerativeModel({ model: 'gemini-2.0-flash' })

    const prompt = `You are a telecom network engineer. ${imageBase64 ? 'Analyze this satellite image of a customer site' : 'Based on the address'}: ${address}, ${city} - ${state}, Brazil.

Provide a brief technical assessment (3-4 sentences) covering:
1. Building type and size (enterprise, data center, commercial building, etc.)
2. Roof access and antenna/equipment installation feasibility
3. Visible infrastructure nearby (aerial cables, underground ducts, telco poles)
4. Recommended diversity path entry points (primary and secondary)

Be concise and technical. Focus on what matters for a telecom rollout PM.`

    const parts = imageBase64
      ? [{ inlineData: { data: imageBase64, mimeType: 'image/jpeg' } }, { text: prompt }]
      : [{ text: prompt }]

    const result = await model.generateContent(parts)
    return NextResponse.json({ result: result.response.text() })
  }

  if (type === 'query') {
    const { question, projectData } = payload
    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: `You are an AI assistant for a telecom rollout project management system.
You help Program Managers track 1500+ site rollouts across Brazil with providers: Claro, Vivo, TIM, Oi, Embratel.
Answer questions about DIA circuit status, project progress, blockers, and next actions.
Be concise, direct, and actionable. Use bullet points when listing items.`
    })

    const result = await model.generateContent(
      `Project data summary:\n${JSON.stringify(projectData, null, 2)}\n\nQuestion: ${question}`
    )
    return NextResponse.json({ result: result.response.text() })
  }

  if (type === 'status_report') {
    const { projectData } = payload
    const model = genai.getGenerativeModel({
      model: 'gemini-2.0-flash',
      systemInstruction: `You are a Program Manager assistant. Generate concise, professional status reports for telecom rollout projects in Brazil.`
    })

    const result = await model.generateContent(
      `Generate a weekly status report based on this project data:\n${JSON.stringify(projectData, null, 2)}\n\nInclude: overall progress, DIA circuit status per provider, top blockers, and recommended actions. Format as a professional report.`
    )
    return NextResponse.json({ result: result.response.text() })
  }

  return NextResponse.json({ error: 'Unknown type' }, { status: 400 })
}
