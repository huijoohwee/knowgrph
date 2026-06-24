import type { RenderSpec } from './htmlVideoRendererSsot'

export type SpecValidationOk = { ok: true; spec: Readonly<RenderSpec> }
export type SpecValidationError = {
  ok: false
  errorCode: 'invalid_spec'
  field: string
  reason: string
}
export type SpecValidationResult = SpecValidationOk | SpecValidationError

const isPlainRecord = (value: unknown): value is Record<string, unknown> => {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value))
}

const invalidSpec = (field: string, reason: string): SpecValidationError => ({
  ok: false,
  errorCode: 'invalid_spec',
  field,
  reason,
})

const validateIntegerRange = (
  value: unknown,
  field: string,
  min: number,
  max: number,
): number | SpecValidationError => {
  if (typeof value !== 'number' || !Number.isInteger(value)) return invalidSpec(field, 'must be an integer')
  if (value < min || value > max) return invalidSpec(field, `must be between ${min} and ${max}`)
  return value
}

const walkDomForContent = (node: Node): boolean => {
  if (node.nodeType === Node.TEXT_NODE) return Boolean(String(node.textContent || '').trim())
  if (node.nodeType === Node.ELEMENT_NODE) return true
  for (let i = 0; i < node.childNodes.length; i += 1) {
    if (walkDomForContent(node.childNodes[i]!)) return true
  }
  return false
}

export function htmlHasContent(html: string): boolean {
  const raw = String(html || '')
  if (!raw.trim()) return false
  const Parser = typeof DOMParser === 'function' ? DOMParser : null
  if (Parser) {
    const document = new Parser().parseFromString(raw, 'text/html')
    return walkDomForContent(document.body)
  }
  const withoutComments = raw.replace(/<!--[\s\S]*?-->/g, '')
  const hasElement = /<[a-z][\w:-]*(?:\s[^>]*)?>/i.test(withoutComments)
  const text = withoutComments.replace(/<[^>]*>/g, '').trim()
  return hasElement || Boolean(text)
}

export function validateRenderSpec(candidate: unknown): SpecValidationResult {
  if (!isPlainRecord(candidate)) return invalidSpec('renderSpec', 'must be an object')

  const html = typeof candidate.html === 'string' ? candidate.html : ''
  if (!html.trim()) return invalidSpec('html', 'must be a non-empty string')
  if (!htmlHasContent(html)) return invalidSpec('html', 'must contain parseable content')

  const durationMs = validateIntegerRange(candidate.durationMs, 'durationMs', 1, 3600000)
  if (typeof durationMs !== 'number') return durationMs
  const fps = validateIntegerRange(candidate.fps, 'fps', 1, 120)
  if (typeof fps !== 'number') return fps
  const width = validateIntegerRange(candidate.width, 'width', 1, 7680)
  if (typeof width !== 'number') return width
  const height = validateIntegerRange(candidate.height, 'height', 1, 4320)
  if (typeof height !== 'number') return height

  const css = typeof candidate.css === 'string' ? candidate.css : undefined
  if (typeof candidate.css !== 'undefined' && typeof candidate.css !== 'string') {
    return invalidSpec('css', 'must be a string when provided')
  }
  const data = typeof candidate.data === 'undefined' ? undefined : candidate.data
  if (typeof data !== 'undefined' && !isPlainRecord(data)) return invalidSpec('data', 'must be a JSON object when provided')
  const engineHint = typeof candidate.engineHint === 'string' ? candidate.engineHint.trim() : undefined
  if (typeof candidate.engineHint !== 'undefined' && typeof candidate.engineHint !== 'string') {
    return invalidSpec('engineHint', 'must be a string when provided')
  }
  if (engineHint && engineHint.length > 255) return invalidSpec('engineHint', 'must be at most 255 characters')

  return {
    ok: true,
    spec: {
      html,
      durationMs,
      fps,
      width,
      height,
      ...(typeof css === 'string' ? { css } : {}),
      ...(typeof data !== 'undefined' ? { data } : {}),
      ...(engineHint ? { engineHint } : {}),
    },
  }
}
