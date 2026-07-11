import { resolveLiveCanvasHeroEmbedUrl } from '@/features/canvas/liveCanvasHeroEmbed'
import type { LiveCanvasHeroSourceSelection } from '@/features/canvas/liveCanvasHeroSourceSelection'

export const KNOWGRPH_CANVAS_EMBED_SELECT_MESSAGE = 'knowgrph.canvas-embed.select'
export const KNOWGRPH_CANVAS_EMBED_MESSAGE_VERSION = 1

export type KnowgrphCanvasEmbedSelectMessage = {
  type: typeof KNOWGRPH_CANVAS_EMBED_SELECT_MESSAGE
  version: typeof KNOWGRPH_CANVAS_EMBED_MESSAGE_VERSION
  sourcePath?: string
  embedUrl?: string
  iframe?: string
}

const decodeHtmlAttribute = (value: string): string => value
  .replace(/&amp;/gi, '&')
  .replace(/&quot;/gi, '"')
  .replace(/&#39;|&apos;/gi, "'")
  .replace(/&lt;/gi, '<')
  .replace(/&gt;/gi, '>')

export function readCanvasEmbedIframeSrc(markup: string): string | null {
  const value = String(markup || '').trim()
  if (!value) return null
  const match = value.match(/<iframe\b[^>]*\bsrc\s*=\s*(["'])(.*?)\1[^>]*>/is)
  return match?.[2] ? decodeHtmlAttribute(match[2].trim()) : null
}

function readMessageRecord(value: unknown): KnowgrphCanvasEmbedSelectMessage | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const record = value as Partial<KnowgrphCanvasEmbedSelectMessage>
  if (record.type !== KNOWGRPH_CANVAS_EMBED_SELECT_MESSAGE) return null
  if (record.version !== KNOWGRPH_CANVAS_EMBED_MESSAGE_VERSION) return null
  return record as KnowgrphCanvasEmbedSelectMessage
}

function inferSourcePath(url: URL, sourcePath: unknown): string {
  const explicitPath = String(sourcePath || '').trim()
  if (explicitPath) return explicitPath
  const documentPath = String(url.searchParams.get('kgDoc') || '').trim()
  if (documentPath) return `/${documentPath.replace(/^\/+/, '')}`
  return url.pathname || '/shared-canvas'
}

function resolveSelection(args: { embedUrl: string; sourcePath?: unknown }): LiveCanvasHeroSourceSelection | null {
  let parsedUrl: URL
  try {
    parsedUrl = new URL(String(args.embedUrl || '').trim())
  } catch {
    return null
  }
  if (parsedUrl.protocol !== 'https:' && parsedUrl.protocol !== 'http:') return null
  const sourcePath = inferSourcePath(parsedUrl, args.sourcePath)
  const embedUrl = resolveLiveCanvasHeroEmbedUrl({ sourcePath, selectedEmbedUrl: parsedUrl.toString() })
  return embedUrl ? { sourcePath, embedUrl } : null
}

export function resolveCanvasEmbedImport(value: unknown): LiveCanvasHeroSourceSelection | null {
  if (typeof value === 'string') {
    const raw = value.trim()
    if (!raw) return null
    const iframeSrc = readCanvasEmbedIframeSrc(raw)
    if (iframeSrc) return resolveSelection({ embedUrl: iframeSrc })
    try {
      return resolveCanvasEmbedImport(JSON.parse(raw) as unknown)
    } catch {
      return resolveSelection({ embedUrl: raw })
    }
  }

  const message = readMessageRecord(value)
  if (!message) return null
  const embedUrl = String(message.embedUrl || '').trim() || readCanvasEmbedIframeSrc(String(message.iframe || ''))
  return embedUrl ? resolveSelection({ embedUrl, sourcePath: message.sourcePath }) : null
}

export function isTrustedCanvasEmbedMessageSource(event: MessageEvent, runtimeWindow: Window = window): boolean {
  const parent = runtimeWindow.parent
  if (parent && parent !== runtimeWindow && event.source === parent) return true
  return Boolean(runtimeWindow.opener && event.source === runtimeWindow.opener)
}
