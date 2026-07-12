import type { SourceFile } from '@/hooks/store/types'
import { splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'
import {
  AGENTIC_VIDEO_ROUTE_TOKEN,
  GENERATION_KIND_INVOCATIONS,
  GENERATION_PROVIDER_INVOCATIONS,
  GENERATION_SPECIFICATION_INVOCATIONS,
} from '@/features/chat/generationInvocation'
import { buildLiveCanvasHeroVideoQuery } from './liveCanvasHeroVideoGeneration'

export const LIVE_CANVAS_HERO_TOKENS = [
  AGENTIC_VIDEO_ROUTE_TOKEN,
  ...GENERATION_PROVIDER_INVOCATIONS.map(item => item.token),
  ...GENERATION_SPECIFICATION_INVOCATIONS.map(item => item.token),
  ...GENERATION_KIND_INVOCATIONS.map(item => item.token),
] as const

export const LIVE_CANVAS_HERO_DEFAULT_QUERY_TOKENS = [
  AGENTIC_VIDEO_ROUTE_TOKEN,
  GENERATION_PROVIDER_INVOCATIONS[0].token,
  ...GENERATION_KIND_INVOCATIONS.map(item => item.token),
  GENERATION_SPECIFICATION_INVOCATIONS[0].token,
] as const

export type LiveCanvasHeroToken = typeof LIVE_CANVAS_HERO_TOKENS[number]
export type LiveCanvasHeroInvocation = {
  token: LiveCanvasHeroToken
  group: 'Route' | 'Provider' | 'Specification' | 'Outputs'
  label: string
  summary: string
  sourcePath: string
  keywords: string[]
}
export type LiveCanvasHeroModel = {
  status: 'ready'
  invocations: LiveCanvasHeroInvocation[]
  defaultQuery: string
  sourceLabel: string | null
  sourceWorkspacePath: string | null
}

export function buildLiveCanvasHeroModel(args: { sourceFiles?: readonly SourceFile[] | null } = {}): LiveCanvasHeroModel {
  const query = buildLiveCanvasHeroVideoQuery(args.sourceFiles)
  return {
    status: 'ready',
    defaultQuery: query.query,
    sourceLabel: query.source?.name || null,
    sourceWorkspacePath: query.source?.workspacePath || null,
    invocations: [
      {
        token: AGENTIC_VIDEO_ROUTE_TOKEN,
        group: 'Route',
        label: 'Video agent',
        summary: 'Agentic video route.',
        sourcePath: 'canvas/src/features/chat/generationInvocation.ts',
        keywords: ['video', 'agent'],
      },
      ...GENERATION_PROVIDER_INVOCATIONS.map(item => ({
        ...item,
        group: 'Provider' as const,
        sourcePath: 'canvas/src/features/chat/generationInvocation.ts',
        keywords: ['provider'],
      })),
      ...GENERATION_SPECIFICATION_INVOCATIONS.map(item => ({
        ...item,
        group: 'Specification' as const,
        sourcePath: 'canvas/src/features/chat/generationInvocation.ts',
        keywords: ['specification'],
      })),
      ...GENERATION_KIND_INVOCATIONS.map(item => ({
        ...item,
        group: 'Outputs' as const,
        sourcePath: 'canvas/src/features/chat/generationInvocation.ts',
        keywords: ['output'],
      })),
    ],
  }
}

export const liveCanvasHeroQueryHasToken = (query: string, token: LiveCanvasHeroToken) =>
  splitInvocationTokenSegments(query).some(part => part.kind === 'token' && part.value.toLowerCase() === token.toLowerCase())

export const appendLiveCanvasHeroToken = (query: string, token: LiveCanvasHeroToken) =>
  liveCanvasHeroQueryHasToken(query, token) ? query.trim() : [query.trim(), token].filter(Boolean).join(' ')
