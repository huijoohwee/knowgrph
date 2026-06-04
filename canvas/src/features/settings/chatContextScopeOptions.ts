export const CHAT_CONTEXT_SCOPE_OPTIONS = [
  { value: 'hybrid', label: 'Selection + Workspace (Default)' },
  { value: 'selection', label: 'Canvas Selection' },
  { value: 'workspace', label: 'Workspace Source Files' },
] as const

export type ChatContextScopeOptionValue = (typeof CHAT_CONTEXT_SCOPE_OPTIONS)[number]['value']

export function normalizeChatContextScopeOption(value: unknown): ChatContextScopeOptionValue {
  const raw = String(value ?? '').trim()
  return CHAT_CONTEXT_SCOPE_OPTIONS.some(option => option.value === raw) ? raw as ChatContextScopeOptionValue : 'hybrid'
}
