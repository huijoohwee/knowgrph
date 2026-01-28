import { useGraphStore } from '@/hooks/useGraphStore'
import { createId } from '@/lib/id'
import { openBottomPanel } from '@/features/bottom-panel/open'
import {
  BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT,
  BOTTOM_PANEL_MARKDOWN_OPEN_VIEWER_EVENT,
} from '@/features/bottom-panel/constants'
import { LS_KEYS } from '@/lib/config'
import { lsSetJson } from '@/lib/persistence'

import { createLocalMarkdownFile, isLocalMarkdownFolderSupported, openLocalMarkdownFolder } from './localMarkdownFolder'
import { findNextSourceFileIndex, normalizeParentPath } from './sourceFileNaming'

export type CreateNewMarkdownSourceFileArgs = {
  parentPath?: string | null
}

export function createNewMarkdownSourceFileAndOpenViewer(
  args?: CreateNewMarkdownSourceFileArgs,
): { id: string; name: string } | null {
  try {
    const store = useGraphStore.getState()

    const openViewerForMarkdown = (name: string, text: string) => {
      store.setMarkdownDocument(name, text)
      store.setMarkdownDocumentSourceUrl(null)
      store.setBottomPanelCurationView('markdown')
      try {
        lsSetJson(LS_KEYS.markdownLayoutMode, 'viewer')
      } catch {
        void 0
      }
      openBottomPanel('curation')
      try {
        const anyWindow = window as unknown as { CustomEvent?: typeof CustomEvent }
        const Ctor = anyWindow.CustomEvent || CustomEvent
        window.dispatchEvent(new Ctor(BOTTOM_PANEL_MARKDOWN_OPEN_VIEWER_EVENT))
        window.dispatchEvent(new Ctor(BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT))
      } catch {
        void 0
      }
    }

    const createInMemorySourceFileAndOpenViewer = (parentPathRaw: string | null) => {
      const existing = Array.isArray(store.sourceFiles) ? store.sourceFiles : []
      const parentPath = normalizeParentPath(parentPathRaw)
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
      openViewerForMarkdown(name, '')
      return { id, name }
    }

    if (!store.localMarkdownFolderHandle && isLocalMarkdownFolderSupported()) {
      void (async () => {
        const ok = await openLocalMarkdownFolder()
        if (!ok) return
        const nextStore = useGraphStore.getState()
        if (!nextStore.localMarkdownFolderHandle) {
          nextStore.setBottomPanelCurationView('markdown')
          try {
            lsSetJson(LS_KEYS.markdownLayoutMode, 'viewer')
          } catch {
            void 0
          }
          openBottomPanel('curation')
          try {
            const anyWindow = window as unknown as { CustomEvent?: typeof CustomEvent }
            const Ctor = anyWindow.CustomEvent || CustomEvent
            window.dispatchEvent(new Ctor(BOTTOM_PANEL_MARKDOWN_OPEN_VIEWER_EVENT))
            window.dispatchEvent(new Ctor(BOTTOM_PANEL_MARKDOWN_AUTO_OPEN_EVENT))
          } catch {
            void 0
          }
          nextStore.pushUiToast({
            id: 'local-new-file-readonly',
            kind: 'warning',
            message: 'Local folder is read-only in this browser.',
          })
          return
        }
        const parentPath = normalizeParentPath(args?.parentPath ?? nextStore.localMarkdownSelectedFolderPath ?? null)
        const createdPath = await createLocalMarkdownFile({ parentPath })
        if (createdPath) {
          openViewerForMarkdown(createdPath, '')
          return
        }
        createInMemorySourceFileAndOpenViewer(parentPath)
      })()
      return null
    }

    if (store.localMarkdownFolderHandle) {
      const parentPath = normalizeParentPath(args?.parentPath ?? store.localMarkdownSelectedFolderPath ?? null)
      void (async () => {
        try {
          const createdPath = await createLocalMarkdownFile({ parentPath })
          if (!createdPath) return
          openViewerForMarkdown(createdPath, '')
        } catch {
          store.pushUiToast({ id: 'local-new-file-failed', kind: 'error', message: 'Failed to create local Markdown file.' })
        }
      })()

      return null
    }

    const created = createInMemorySourceFileAndOpenViewer(args?.parentPath ?? null)

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

    return created
  } catch {
    return null
  }
}
