import { KNOWGRPH_PROBE_TREE_DOC_INVOCATION } from './agenticOsDocInvocations'

export { KNOWGRPH_PROBE_TREE_DOC_INVOCATION } from './agenticOsDocInvocations'

export const KNOWGRPH_PROBE_TREE_PROMPT_PRESET_ID = 'knowgrph-probe-tree' as const
export const KNOWGRPH_PROBE_TREE_PROMPT_PRESET_ALIAS = '/knowgrph-probe-tree-prompt-preset' as const
export const KNOWGRPH_PROBE_TREE_GENERATE_TOOL_NAME = 'knowgrph.probe.generate' as const
export const KNOWGRPH_PROBE_TREE_SELECT_TOOL_NAME = 'knowgrph.probe.select' as const
export const KNOWGRPH_PROBE_TREE_MAX_DEPTH = 8 as const

export const KNOWGRPH_PROBE_TREE_INVOCATION_TOKENS = [
  KNOWGRPH_PROBE_TREE_DOC_INVOCATION.slashCommand,
  KNOWGRPH_PROBE_TREE_DOC_INVOCATION.atToken,
  KNOWGRPH_PROBE_TREE_DOC_INVOCATION.hashToken,
] as const

export function buildKnowgrphProbeTreePromptPreset(request = ''): string {
  const authoredRequest = String(request || '').trim()
  return [
    KNOWGRPH_PROBE_TREE_DOC_INVOCATION.slashCommand,
    authoredRequest || 'Generate 2-4 bounded, editable next-question cards from this Widget Card. Keep the source card unchanged, connect each candidate branch, and publish the branch summary to a separate Rich Media Panel.',
  ].join('\n\n')
}

export function isKnowgrphProbeTreePromptPreset(value: unknown): boolean {
  const text = String(value || '').trim()
  if (!text) return false
  const firstLineTokens = new Set(String(text.split(/\r?\n/, 1)[0] || '').trim().split(/\s+/).filter(Boolean))
  return firstLineTokens.size === 1
    && firstLineTokens.has(KNOWGRPH_PROBE_TREE_DOC_INVOCATION.slashCommand)
    && text.length > KNOWGRPH_PROBE_TREE_DOC_INVOCATION.slashCommand.length
}
