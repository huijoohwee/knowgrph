import { isKgcStructuredMarkdown, normalizeKgcAssistantBodyForStorage } from '@/features/chat/chatHistoryWorkspace'

export type NeutralKgcFixtureArgs = {
  timestampMs: number
  workspacePath?: string
  requestText: string
  assistantText?: string
  expectationLabel?: string
}

const DEFAULT_NEUTRAL_ASSISTANT_TEXT = [
  'Create a neutral KGC document that proves Source Files landing, Editor Workspace handoff,',
  'and Canvas apply through the shared chat finalization path.',
].join(' ')

export const buildNeutralKgcFixtureDocument = (args: NeutralKgcFixtureArgs): string => {
  const markdown = normalizeKgcAssistantBodyForStorage({
    timestampMs: args.timestampMs,
    workspacePath: args.workspacePath,
    requestText: args.requestText,
    assistantText: args.assistantText || DEFAULT_NEUTRAL_ASSISTANT_TEXT,
  }).trim()
  if (!isKgcStructuredMarkdown(markdown)) {
    const label = args.expectationLabel || 'neutral KGC fixture'
    throw new Error(`expected ${label} builder to produce structured KGC markdown`)
  }
  return markdown
}

export const buildCanonicalKgcTemplateFixtureDocument = (
  overrides: Partial<NeutralKgcFixtureArgs> = {},
): string => buildNeutralKgcFixtureDocument({
  timestampMs: Date.UTC(2026, 3, 19, 18, 2, 22),
  workspacePath: '/chat-log/20260419T180222Z/kgc_20260419T180222Z.md',
  requestText: 'Generate a structured KGC response.',
  assistantText: 'Create a neutral KGC response document.',
  expectationLabel: 'canonical KGC template fixture',
  ...overrides,
})
