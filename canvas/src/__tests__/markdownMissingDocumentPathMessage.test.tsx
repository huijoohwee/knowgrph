import React from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownViewerPane } from '@/features/markdown-workspace/MarkdownViewerPane'
import type { MarkdownSelectionInfo } from '@/features/markdown-workspace/markdownUtils'
import { UI_COPY } from '@/lib/config'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'

export async function testMarkdownViewerShowsMissingDocumentPathMessage() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null

  try {
    const anyWindow = dom.window as unknown as {
      requestAnimationFrame?: (cb: (ts: number) => void) => number
    }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number
    ;(globalThis as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }).requestAnimationFrame =
      anyWindow.requestAnimationFrame

    const doc = dom.window.document

    const container = doc.createElement('section')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)

    const selectionInfo: MarkdownSelectionInfo = {
      id: 'n1',
      kind: 'node',
      documentPath: '',
      lineStart: null,
      lineEnd: null,
      highlightBackgroundColor: null,
      highlightUnderlineColor: null,
    }

    root.render(
      React.createElement(MarkdownViewerPane, {
        viewerRef: React.createRef<HTMLElement>(),
        handleViewerScroll: () => void 0,
        markdownPreviewText: '',
        previewBasePath: '',
        highlightedLineRange: null,
        markdownWordWrap: false,
        markdownPresentationMode: false,
        markdownTextHighlight: false,
        sidebarPosition: 'left',
        stickyHeadingTopPx: undefined,
        selectionInfo,
        flashSelectionId: null,
        presentationApiRef: React.createRef(),
        setPresentationSlideState: () => void 0,
        uiPanelTextFontClass: 'font-sans text-xs',
        uiPanelMonospaceTextClass: 'font-mono text-xs',
        annotateDisplayMode: 'inline',
        onShowInGraphDataTable: () => void 0,
        onShowInSlidesGallery: () => void 0,
        onShowInEditor: () => void 0,
        isMarkdownPreviewTruncated: false,
        uiPanelKeyValueTextSizeClass: 'text-xs',
        flashLine: null,
        tokens: [],
        markdownViewerWidthMode: 'standard',
        viewMode: 'viewer',
        showSidebar: false,
        onToggleSidebar: () => void 0,
        collapsedIds: new Set<string>(),
        onToggleCollapse: () => void 0,
        onExpandAll: () => void 0,
        onCollapseAll: () => void 0,
        onTocSelect: () => void 0,
        onTocDoubleClick: () => void 0,
        onTocReorder: () => void 0,
        onInsertLineAfter: () => void 0,
        onReorderLineBlock: () => void 0,
        sourceFiles: [],
        onSourceFileSelect: () => void 0,
        sourceFilesPanelIntegration: undefined,
        geoDatasetIntegration: undefined,
      } as never),
    )

    const tick = (label: string) =>
      new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`${label} timed out`)), 750) as unknown as number
        const raf = anyWindow.requestAnimationFrame
        if (typeof raf === 'function') {
          raf(() => {
            clearTimeout(timer)
            resolve()
          })
          return
        }
        setTimeout(() => {
          clearTimeout(timer)
          resolve()
        }, 0)
      })

    await tick('mount')

    let text = ''
    for (let i = 0; i < 8; i += 1) {
      text = String(container.textContent || '')
      if (text.trim()) break
      await tick(`settle:${i}`)
    }
    if (!text.includes(UI_COPY.markdownWorkspaceMissingDocumentPathLabel)) {
      throw new Error(
        `expected markdown viewer to show missing documentPath message, got ${JSON.stringify(
          UI_COPY.markdownWorkspaceMissingDocumentPathLabel,
        )} not found in ${JSON.stringify(text)}`,
      )
    }
  } finally {
    try {
      root?.unmount()
    } catch {
      void 0
    }
    restoreDom()
    restoreWindow()
  }
}
