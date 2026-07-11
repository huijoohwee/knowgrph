import { emitChatInputAppend } from '@/features/canvas/utils'
import { normalizeInvocationTokenSpacing, splitInvocationTokenSegments } from '@/lib/markdown/invocationTokens'
import { applyFloatingPanelChatInputAppend } from './floatingPanelChatInputAppend'

export type FloatingPanelChatInputHandoff = {
  text: string
  mode: 'append' | 'replace'
}

export type FloatingPanelChatSeedRequest = {
  text: string
  mode?: 'append' | 'replace'
}

let pendingInputHandoff: FloatingPanelChatInputHandoff | null = null

export function normalizeFloatingPanelChatSeedText(text: string): string {
  const raw = String(text || '')
  const trimmed = raw.trim()
  if (!trimmed) return ''
  const segments = splitInvocationTokenSegments(trimmed)
  const hasToken = segments.some(segment => segment.kind === 'token')
  const hasNonWhitespaceText = segments.some(
    segment => segment.kind === 'text' && /\S/.test(segment.value),
  )
  const tokenKinds = segments.flatMap(segment => (
    segment.kind === 'token' ? [segment.tokenKind] : []
  ))
  const slashTokenCount = tokenKinds.filter(kind => kind === 'slash').length
  const hasNonSlashToken = tokenKinds.some(kind => kind !== 'slash')
  if (!hasToken || hasNonWhitespaceText || !hasNonSlashToken || slashTokenCount > 1) return raw
  return normalizeInvocationTokenSpacing(trimmed)
}

export function resolveFloatingPanelChatSeed(args: FloatingPanelChatSeedRequest): FloatingPanelChatInputHandoff | null {
  const text = normalizeFloatingPanelChatSeedText(args.text)
  if (!text) return null
  return {
    text,
    mode: args.mode === 'append' ? 'append' : 'replace',
  }
}

function storeFloatingPanelChatInputHandoff(handoff: FloatingPanelChatInputHandoff): void {
  pendingInputHandoff = handoff
}

export function queueResolvedFloatingPanelChatInputHandoff(handoff: FloatingPanelChatInputHandoff): void {
  storeFloatingPanelChatInputHandoff({
    text: handoff.text,
    mode: handoff.mode === 'append' ? 'append' : 'replace',
  })
}

export function dispatchResolvedFloatingPanelChatSeed(handoff: FloatingPanelChatInputHandoff): void {
  emitChatInputAppend({
    text: handoff.text,
    mode: handoff.mode === 'append' ? 'append' : 'replace',
  })
}

export function queueFloatingPanelChatInputHandoff(args: FloatingPanelChatSeedRequest): void {
  const resolved = resolveFloatingPanelChatSeed(args)
  if (!resolved) return
  queueResolvedFloatingPanelChatInputHandoff(resolved)
}

export function consumeFloatingPanelChatInputHandoff(): FloatingPanelChatInputHandoff | null {
  const pending = pendingInputHandoff
  pendingInputHandoff = null
  return pending
}

export function flushFloatingPanelChatInputHandoff(): boolean {
  const pending = consumeFloatingPanelChatInputHandoff()
  if (!pending) return false
  dispatchResolvedFloatingPanelChatSeed(pending)
  return true
}

export function applyFloatingPanelChatInputHandoff(
  currentInput: string,
  handoff: FloatingPanelChatInputHandoff,
): string {
  return applyFloatingPanelChatInputAppend(currentInput, handoff)
}
