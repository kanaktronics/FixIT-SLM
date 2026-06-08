import { NextRequest, NextResponse } from 'next/server'

const OLLAMA_BASE = process.env.INFERENCE_URL || 'http://localhost:11434'
const MODEL_NAME  = process.env.MODEL_NAME   || 'fixit-slm'

const SYSTEM_PROMPT = `You are FIXIT SLM, an ultra-practical assistant designed to help people understand, build, repair, troubleshoot, and improve things in the real world.

Your purpose is not merely to answer questions. Your purpose is to make users capable.

Structure every response using labeled sections with bold headers like **Section Title**. Always include all relevant sections for the mode. Use clear language, short paragraphs, and specific actionable details. Never use emojis. Never skip sections.`

export async function POST(req: NextRequest) {
  const { prompt, systemHint } = await req.json()

  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const fullPrompt = `${SYSTEM_PROMPT}\n\n${systemHint || ''}\n\nUser: ${prompt}\n\nFIXIT:`

  try {
    const ollamaRes = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: MODEL_NAME,
        prompt: fullPrompt,
        stream: true,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          num_predict: 1024,
          stop: ['User:', '\n\nUser'],
        },
      }),
    })

    if (!ollamaRes.ok) {
      return NextResponse.json(
        { error: `Ollama error: ${ollamaRes.status}` },
        { status: 502 }
      )
    }

    // Stream Ollama's NDJSON response as plain text to the client
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        if (!ollamaRes.body) { controller.close(); return }

        const reader  = ollamaRes.body.getReader()
        const decoder = new TextDecoder()

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = decoder.decode(value, { stream: true })
            const lines = chunk.split('\n').filter(Boolean)

            for (const line of lines) {
              try {
                const data = JSON.parse(line)
                if (data.response) {
                  controller.enqueue(encoder.encode(data.response))
                }
                if (data.done) {
                  controller.close()
                  return
                }
              } catch {
                // skip malformed JSON
              }
            }
          }
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Content-Type-Options': 'nosniff',
        'Cache-Control': 'no-cache',
      },
    })
  } catch (err) {
    console.error('Ollama fetch failed:', err)
    return NextResponse.json(
      { error: 'Failed to connect to inference server. Is Ollama running?' },
      { status: 503 }
    )
  }
}
