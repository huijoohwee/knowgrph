export type MarkdownWorkspaceStatusSuccessArgs = {
  setStatusWithAutoClear: (label: string, ttlMs?: number) => void
  label: string
  ttlMs?: number | null
}

export type MarkdownWorkspaceStatusErrorArgs = {
  setStatusError: (label: string) => void
  prefix?: string | null
  error?: unknown
  fallbackMessage?: string
  includeDetail?: boolean
}

export type MarkdownWorkspaceStatusInfoArgs = {
  setStatusInfo: (label: string, opts?: { ttlMs?: number }) => void
  label: string
  ttlMs?: number | null
}

function readMarkdownWorkspaceStatusErrorDetail(error: unknown, fallbackMessage: string): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = String((error as { message?: unknown }).message ?? '').trim()
    if (message) return message
  }
  const text = String(error ?? '').trim()
  return text || fallbackMessage
}

export function buildMarkdownWorkspaceStatusErrorMessage(args: {
  prefix?: string | null
  error?: unknown
  fallbackMessage?: string
  includeDetail?: boolean
}): string {
  const prefix = String(args.prefix || '').trim()
  const fallbackMessage = String(args.fallbackMessage || 'Request failed').trim() || 'Request failed'
  if (args.includeDetail === false) return prefix || fallbackMessage
  const detail = readMarkdownWorkspaceStatusErrorDetail(args.error, fallbackMessage)
  if (!prefix) return detail
  return detail ? `${prefix}: ${detail}` : prefix
}

export function applyMarkdownWorkspaceSuccessStatus(args: MarkdownWorkspaceStatusSuccessArgs): void {
  const label = String(args.label || '').trim()
  if (!label) return
  try {
    if (typeof args.ttlMs === 'number' && Number.isFinite(args.ttlMs)) {
      args.setStatusWithAutoClear(label, args.ttlMs)
      return
    }
    args.setStatusWithAutoClear(label)
  } catch {
    void 0
  }
}

export function applyMarkdownWorkspaceErrorStatus(args: MarkdownWorkspaceStatusErrorArgs): void {
  const message = buildMarkdownWorkspaceStatusErrorMessage({
    prefix: args.prefix,
    error: args.error,
    fallbackMessage: args.fallbackMessage,
    includeDetail: args.includeDetail,
  })
  if (!message) return
  try {
    args.setStatusError(message)
  } catch {
    void 0
  }
}

export function applyMarkdownWorkspaceInfoStatus(args: MarkdownWorkspaceStatusInfoArgs): void {
  const label = String(args.label || '').trim()
  if (!label) return
  try {
    if (typeof args.ttlMs === 'number' && Number.isFinite(args.ttlMs)) {
      args.setStatusInfo(label, { ttlMs: args.ttlMs })
      return
    }
    args.setStatusInfo(label)
  } catch {
    void 0
  }
}
