import fs from 'node:fs'
import path from 'node:path'

import { JSDOM } from 'jsdom'

import {
  emitMarkdownLayoutRequest,
  MARKDOWN_LAYOUT_REQUEST_EVENT,
  readMarkdownLayoutRequestEventDetail,
  subscribeMarkdownLayoutRequest,
} from '@/lib/markdown-workspace-runtime/markdownWorkspaceRuntime.shared'

const readUtf8 = (relativePath: string): string => {
  return fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')
}

export const testMarkdownLayoutRequestHelpersDispatchAndSubscribe = async () => {
  const dom = new JSDOM('<!doctype html><html><body></body></html>', { url: 'http://localhost' })
  const g = globalThis as unknown as { window?: unknown; document?: unknown }
  g.window = dom.window
  g.document = dom.window.document

  const modes: string[] = []
  const unsubscribe = subscribeMarkdownLayoutRequest(detail => {
    modes.push(detail.mode)
  })

  emitMarkdownLayoutRequest('editor')
  await new Promise<void>(resolve => setTimeout(resolve, 0))
  if (modes.length !== 1 || modes[0] !== 'editor') {
    throw new Error(`expected markdown layout helper to notify with editor mode, got ${JSON.stringify(modes)}`)
  }

  const detail = readMarkdownLayoutRequestEventDetail(
    new dom.window.CustomEvent(MARKDOWN_LAYOUT_REQUEST_EVENT, { detail: { mode: 'split' } }),
  )
  if (!detail || detail.mode !== 'split') {
    throw new Error(`expected markdown layout event detail parser to read split mode, got ${JSON.stringify(detail)}`)
  }

  const invalid = readMarkdownLayoutRequestEventDetail(
    new dom.window.CustomEvent(MARKDOWN_LAYOUT_REQUEST_EVENT, { detail: { mode: 'viewer' } }),
  )
  if (invalid) {
    throw new Error('expected markdown layout event detail parser to reject unsupported modes')
  }

  unsubscribe()
}

export const testMarkdownLayoutRequestCallsitesUseSharedContract = () => {
  const sharedText = readUtf8('src/lib/markdown-workspace-runtime/markdownWorkspaceRuntime.shared.ts')
  const chatText = readUtf8('src/features/chat/FloatingPanelChat.tsx')
  const interactionsText = readUtf8('src/lib/markdown-workspace-runtime/useMarkdownWorkspaceInteractions.ts')

  if (!sharedText.includes('export const MARKDOWN_LAYOUT_REQUEST_EVENT')) {
    throw new Error('expected markdown layout event constant to live in the shared runtime module')
  }
  if (!sharedText.includes('export function emitMarkdownLayoutRequest')) {
    throw new Error('expected markdown layout runtime module to expose a shared emitter')
  }
  if (!sharedText.includes('export function readMarkdownLayoutRequestEventDetail')) {
    throw new Error('expected markdown layout runtime module to expose a shared detail parser')
  }
  if (!sharedText.includes('export function subscribeMarkdownLayoutRequest')) {
    throw new Error('expected markdown layout runtime module to expose a shared subscriber')
  }
  if (!chatText.includes("emitMarkdownLayoutRequest('editor')")) {
    throw new Error('expected FloatingPanelChat to emit markdown layout requests via the shared helper')
  }
  if (chatText.includes("new CustomEvent(MARKDOWN_LAYOUT_REQUEST_EVENT")) {
    throw new Error('expected FloatingPanelChat to avoid raw markdown layout event construction')
  }
  if (chatText.includes("const MARKDOWN_LAYOUT_REQUEST_EVENT = 'kg:markdown-workspace-layout-request'")) {
    throw new Error('expected FloatingPanelChat to avoid owning a duplicate markdown layout event constant')
  }
  if (!interactionsText.includes('subscribeMarkdownLayoutRequest')) {
    throw new Error('expected useMarkdownWorkspaceInteractions to subscribe via the shared helper')
  }
  if (interactionsText.includes('window.addEventListener(MARKDOWN_LAYOUT_REQUEST_EVENT')) {
    throw new Error('expected useMarkdownWorkspaceInteractions to avoid raw markdown layout listener wiring')
  }
}
