/**
 * FIXIT SLM — Ollama Client
 * Connects to local Ollama instance (or Cloud Run in production)
 */

const OLLAMA_BASE = process.env.NEXT_PUBLIC_INFERENCE_URL || 'http://localhost:11434'
const MODEL_NAME  = process.env.NEXT_PUBLIC_MODEL_NAME   || 'fixit-slm'

export interface OllamaResponse {
  model:     string
  response:  string
  done:      boolean
  context?:  number[]
  total_duration?: number
}

/**
 * Send a prompt to FIXIT SLM and stream the response.
 * Calls the /api/generate endpoint on the running Ollama instance.
 */
export async function streamGenerate(
  prompt: string,
  onToken: (token: string) => void,
  onDone: () => void,
  signal?: AbortSignal,
): Promise<void> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt,
      stream: true,
      options: {
        temperature: 0.7,
        top_p: 0.9,
        num_predict: 1024,
      },
    }),
  })

  if (!res.ok) {
    throw new Error(`Ollama error: ${res.status} ${res.statusText}`)
  }

  const reader = res.body?.getReader()
  if (!reader) throw new Error('No response body')

  const decoder = new TextDecoder()

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    const chunk = decoder.decode(value, { stream: true })
    const lines  = chunk.split('\n').filter(Boolean)

    for (const line of lines) {
      try {
        const data: OllamaResponse = JSON.parse(line)
        if (data.response) onToken(data.response)
        if (data.done) { onDone(); return }
      } catch {
        // Incomplete JSON chunk — continue
      }
    }
  }

  onDone()
}

/**
 * Non-streaming version — returns the full response string.
 */
export async function generate(prompt: string): Promise<string> {
  const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL_NAME,
      prompt,
      stream: false,
      options: { temperature: 0.7, top_p: 0.9, num_predict: 1024 },
    }),
  })

  if (!res.ok) throw new Error(`Ollama error: ${res.status}`)

  const data: OllamaResponse = await res.json()
  return data.response
}

/**
 * Check if Ollama is running and the model is available.
 */
export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { method: 'GET' })
    if (!res.ok) return false
    const data = await res.json()
    const models: string[] = (data.models || []).map((m: { name: string }) => m.name)
    return models.some(m => m.includes('fixit-slm'))
  } catch {
    return false
  }
}
