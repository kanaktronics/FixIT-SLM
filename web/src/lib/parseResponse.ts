import { Section } from '@/types'

/**
 * Parse a FIXIT SLM response string into structured sections.
 * Splits on **Section Title** markdown bold headers.
 */
export function parseResponse(raw: string): Section[] {
  const sections: Section[] = []

  // Split on bold headers — **Title**
  const parts = raw.split(/\*\*([^*]+)\*\*/)

  // parts alternates: [before-first-header, header1, content1, header2, content2, ...]
  // Start from index 1 (first header)
  let index = 0
  for (let i = 1; i < parts.length; i += 2) {
    const title   = parts[i].trim()
    const content = (parts[i + 1] || '').trim()

    if (!title) continue

    sections.push({
      title,
      content,
      index,
      variant: getVariant(title),
    })
    index++
  }

  // If no structured sections found, return the whole response as a single section
  if (sections.length === 0 && raw.trim()) {
    sections.push({
      title: 'Response',
      content: raw.trim(),
      index: 0,
      variant: 'default',
    })
  }

  return sections
}

function getVariant(title: string): Section['variant'] {
  const lower = title.toLowerCase()
  if (lower.includes('mistake') || lower.includes('error') || lower.includes('warning')) {
    return 'warning'
  }
  if (lower.includes('verify') || lower.includes('success') || lower.includes('confirm')) {
    return 'success'
  }
  return 'default'
}

/**
 * Extract a short title from the user message for conversation history.
 */
export function extractTitle(message: string): string {
  const clean = message.trim()
  if (clean.length <= 48) return clean
  return clean.slice(0, 48) + '...'
}

/**
 * Auto-detect the most appropriate mode from a user message.
 */
export function detectMode(message: string): string {
  const lower = message.toLowerCase()

  if (
    lower.match(/\b(not working|broken|fails|error|doesn't|doesn't|won't|won't|stopped|issue|problem|fix)\b/)
  ) return 'troubleshoot'

  if (
    lower.match(/\b(how does|what is|explain|teach me|what are|why does|how do)\b/)
  ) return 'learn'

  if (
    lower.match(/\b(build|create|make|design|set up|implement|develop)\b/)
  ) return 'build'

  if (
    lower.match(/\b(tradeoff|trade-off|vs|versus|compare|difference between|which is better|pros and cons)\b/)
  ) return 'decide'

  if (
    lower.match(/\b(should I|want to|planning to|thinking about|my plan)\b/)
  ) return 'reality'

  return 'troubleshoot' // Default
}
