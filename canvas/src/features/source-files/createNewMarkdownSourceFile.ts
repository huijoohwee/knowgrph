import { useGraphStore } from '@/hooks/useGraphStore'
import { createId } from '@/lib/id'
import { openBottomPanel } from '@/features/bottom-panel/open'
import {
  BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT,
  BOTTOM_PANEL_MARKDOWN_OPEN_VIEWER_EVENT,
} from '@/features/bottom-panel/constants'
import { LS_KEYS } from '@/lib/config'
import { lsSetJson } from '@/lib/persistence'

const escapeRegex = (text: string): string => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const normalizeParentPath = (raw: string | null | undefined): string => {
  const trimmed = String(raw || '').trim().replace(/\\/g, '/')
  return trimmed.replace(/^\/+/, '').replace(/\/+$/, '')
}

const findNextSourceFileIndex = (names: string[], parentPath: string): number => {
  let max = 0
  const prefix = normalizeParentPath(parentPath)
  const re = prefix
    ? new RegExp(`^${escapeRegex(prefix)}/source-(\\d+)\\.md$`, 'i')
    : /^source-(\d+)\.md$/i
  for (const name of names) {
    const match = re.exec(String(name || '').trim())
    if (!match) continue
    const n = Number(match[1])
    if (!Number.isFinite(n)) continue
    max = Math.max(max, Math.floor(n))
  }
  return Math.max(1, max + 1)
}

export type CreateNewMarkdownSourceFileArgs = {
  parentPath?: string | null
}

export function createNewMarkdownSourceFileAndOpenViewer(
  args?: CreateNewMarkdownSourceFileArgs,
): { id: string; name: string } | null {
  try {
    const store = useGraphStore.getState()
    const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
    const parentPath = normalizeParentPath(args?.parentPath ?? null)
    const nextIndex = findNextSourceFileIndex(existing.map(f => String(f.name || '')), parentPath)
    const baseName = `source-${nextIndex}.md`
    const name = parentPath ? `${parentPath}/${baseName}` : baseName
    const id = createId('sf')

    store.addSourceFile({
      id,
      name,
      text: '',
      enabled: true,
      status: 'idle',
      source: { kind: 'local' },
    })
    store.setMarkdownDocument(name, '')
    store.setMarkdownDocumentSourceUrl(null)
    store.setBottomPanelCurationView('markdown')

    try {
      lsSetJson(LS_KEYS.markdownLayoutMode, 'viewer')
    } catch {
      void 0
    }

    openBottomPanel('curation')

    const dispatchViewer = () => {
      try {
        const anyWindow = window as unknown as { CustomEvent?: typeof CustomEvent }
        const Ctor = anyWindow.CustomEvent || CustomEvent
        window.dispatchEvent(new Ctor(BOTTOM_PANEL_MARKDOWN_OPEN_VIEWER_EVENT))
        window.dispatchEvent(new Ctor(BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT))
      } catch {
        void 0
      }
    }
    dispatchViewer()
    try {
      const raf =
        typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function'
          ? window.requestAnimationFrame.bind(window)
          : (cb: FrameRequestCallback) => window.setTimeout(() => cb(Date.now()), 0) as unknown as number
      raf(() => dispatchViewer())
    } catch {
      void 0
    }

    return { id, name }
  } catch {
    return null
  }
}
