import type { InvocationTokenKind } from '@/lib/markdown/invocationTokens'
import { buildAgenticOsInvocationChipTitle } from '@/features/agentic-os/agenticOsInvocationChips'
import { resolveInlineInvocationChipClassName } from '@/features/markdown/ui/dataViewChipStyles'
import { getChatInvocationOptions } from '@/features/chat/chatInvocationRegistry'
import { CHAT_SKILL_OPTIONS } from '@/features/chat/chatSkillRegistry'

type ComposerInvocationSourcePart = {
  tokenKind: InvocationTokenKind
  text: string
}

const formatComposerInvocationSource = (args: { token: string; label?: string; summary?: string; source: string; toolName?: string }): string => [
  args.label ? `${args.token} - ${args.label}` : args.token,
  args.summary || '',
  args.toolName ? `Tool: ${args.toolName}` : '',
  `Source: ${args.source}`,
].filter(Boolean).join('\n')

const CHAT_COMPOSER_SLASH_INVOCATION_SOURCES = new Map(CHAT_SKILL_OPTIONS.map(option => [
  option.slashCommand.toLowerCase(),
  formatComposerInvocationSource({ token: option.slashCommand, label: option.label, summary: option.summary, source: 'chat skill registry' }),
] as const))

export function readComposerInvocationChipClassName(part: Pick<ComposerInvocationSourcePart, 'text'>): string {
  return resolveInlineInvocationChipClassName({
    value: part.text,
    extraClassName: 'pointer-events-none cursor-text no-underline',
  })
}

export function readComposerInvocationSourceTitle(part: ComposerInvocationSourcePart): string {
  const agenticTitle = buildAgenticOsInvocationChipTitle(part.text)
  if (agenticTitle) return agenticTitle
  const normalized = part.text.toLowerCase()
  if (part.tokenKind === 'slash') {
    const source = CHAT_COMPOSER_SLASH_INVOCATION_SOURCES.get(normalized)
    if (source) return source
  }
  if (part.tokenKind === 'keyword') {
    const source = new Map(getChatInvocationOptions().map(option => [
      option.token.toLowerCase(),
      formatComposerInvocationSource({
        token: option.token,
        label: option.label,
        summary: option.summary,
        source: option.sourcePath || 'chat invocation registry',
        toolName: option.toolName,
      }),
    ] as const)).get(normalized)
    if (source) return source
  }
  return formatComposerInvocationSource({
    token: part.text,
    label: part.tokenKind === 'binding' ? 'Binding reference' : 'Invocation token',
    summary: 'Composer token preserved as visible invocation grammar.',
    source: 'FloatingPanel Chat composer',
  })
}
