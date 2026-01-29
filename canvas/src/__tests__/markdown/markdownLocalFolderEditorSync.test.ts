import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { LS_KEYS, UI_COPY } from '@/lib/config'
import { lsSetBool, lsSetJson } from '@/lib/persistence'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { useGraphStore } from '@/hooks/useGraphStore'

export async function testMarkdownLocalFolderSelectionKeepsEditorTextInSync() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  let root: ReturnType<typeof createRoot> | null = null
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
      setTimeout(() => cb(Date.now()), 0) as unknown as number

    lsSetJson(LS_KEYS.markdownLayoutMode, 'viewer')
    lsSetBool(LS_KEYS.markdownSidebarOpen, true)

    const state = useGraphStore.getState()
    state.resetAll()
    state.setBottomPanelCurationView('markdown')
    state.clearSourceFiles()

    const content = ['# Local doc', '', 'Hello from local folder.'].join('\n')
    const file = ({ name: 'source-1.md', text: async () => content } as unknown) as File
    const filesByPath = new Map<string, File>()
    filesByPath.set('folder/source-1.md', file)
    state.setLocalMarkdownFallbackFilesByPath(filesByPath, 'folder')

    const { readLocalMarkdownFileText } = await import('@/features/source-files/localMarkdownFolder')
    const probe = await readLocalMarkdownFileText('folder/source-1.md')
    if (!String(probe || '').includes('Hello from local folder.')) {
      throw new Error('expected localMarkdownFallbackFilesByPath to be readable via readLocalMarkdownFileText')
    }

    state.addSourceFile({
      id: 'sf-local-1',
      name: 'folder/source-1.md',
      text: '',
      enabled: true,
      status: 'idle',
      source: { kind: 'local', path: 'folder/source-1.md' },
    })
    state.setMarkdownDocument(null, null)

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0))
    await tick()
    await tick()

    const folderBtn = doc.querySelector('button[title="folder"]') as HTMLButtonElement | null
    if (!folderBtn) throw new Error('expected Source Files folder button for folder')
    folderBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const fileBtn = doc.querySelector('button[title="folder/source-1.md"]') as HTMLButtonElement | null
    if (!fileBtn) throw new Error('expected Source Files row button for folder/source-1.md')

    fileBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await new Promise<void>(resolve => setTimeout(resolve, 350))
    await tick()

    const after = useGraphStore.getState()
    const storedText = String(after.markdownDocumentText || '')
    if (!storedText.includes('Hello from local folder.')) {
      throw new Error(`expected store markdownDocumentText to be updated after local file select, got length=${storedText.length}`)
    }

    const previewRoot = doc.querySelector('[data-testid="markdown-preview-root"]') as HTMLElement | null
    if (!previewRoot) throw new Error('expected markdown preview root')
    const rendered = String(previewRoot.textContent || '')
    if (!rendered.includes('Hello from local folder.')) {
      throw new Error(`expected Viewer to render local file text, got length=${rendered.length}`)
    }

    const editToggleTitle = UI_COPY.bottomPanelMarkdownEditToggleTitle
    const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
    const editBtn = buttons.find(b => (b.getAttribute('aria-label') || '') === editToggleTitle) || null
    if (!editBtn) throw new Error('expected Edit toggle button')

    editBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    await tick()

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) throw new Error('expected editor textarea after toggling to editor')
    if (!String(textarea.value || '').includes('Hello from local folder.')) {
      throw new Error('expected Editor text to match Viewer after local file select')
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
