import {
  findAgenticOsInvocationByToken,
  type AgenticOsResolvedInvocation,
} from '@/features/agentic-os/agenticOsDocInvocations'
import {
  normalizeInvocationTokenSpacing,
  splitInvocationTokenSegments,
} from '@/lib/markdown/invocationTokens'

export const LIVE_CANVAS_HERO_TOKENS = [
  '/runtime-ready.check',
  '/cost.audit',
  '#token-economics',
  '#runtime-ready',
  '@runtime-proof',
  '@dev-only',
] as const

export const LIVE_CANVAS_HERO_DEFAULT_QUERY_TOKENS = [
  '/runtime-ready.check',
  '#token-economics',
  '@dev-only',
] as const satisfies readonly LiveCanvasHeroToken[]

export type LiveCanvasHeroToken = typeof LIVE_CANVAS_HERO_TOKENS[number]

export type LiveCanvasHeroInvocation = AgenticOsResolvedInvocation & {
  token: LiveCanvasHeroToken
}

export type LiveCanvasHeroModel =
  | {
      status: 'ready'
      invocations: LiveCanvasHeroInvocation[]
      defaultQuery: string
    }
  | {
      status: 'blocked'
      missingTokens: LiveCanvasHeroToken[]
    }

export function buildLiveCanvasHeroModel(): LiveCanvasHeroModel {
  const invocations: LiveCanvasHeroInvocation[] = []
  const missingTokens: LiveCanvasHeroToken[] = []

  for (const token of LIVE_CANVAS_HERO_TOKENS) {
    const invocation = findAgenticOsInvocationByToken(token)
    if (!invocation) {
      missingTokens.push(token)
      continue
    }
    invocations.push({ ...invocation, token })
  }

  if (missingTokens.length > 0) return { status: 'blocked', missingTokens }
  return {
    status: 'ready',
    invocations,
    defaultQuery: normalizeInvocationTokenSpacing(LIVE_CANVAS_HERO_DEFAULT_QUERY_TOKENS.join(' ')),
  }
}

export function liveCanvasHeroQueryHasToken(query: string, token: LiveCanvasHeroToken): boolean {
  return splitInvocationTokenSegments(String(query || '')).some(segment => (
    segment.kind === 'token' && segment.value.toLowerCase() === token.toLowerCase()
  ))
}

export function appendLiveCanvasHeroToken(query: string, token: LiveCanvasHeroToken): string {
  const current = String(query || '')
  if (liveCanvasHeroQueryHasToken(current, token)) return normalizeInvocationTokenSpacing(current)
  return normalizeInvocationTokenSpacing([current.trim(), token].filter(Boolean).join(' '))
}
