import React from 'react'
import { createRoot } from 'react-dom/client'
import { initWindowHarness } from '@/tests/lib/windowHarness'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { MemoryStorage } from '@/tests/lib/memoryStorage'
import { UI_COPY } from '@/lib/config'
import { BottomPanelMarkdownSection } from '@/components/BottomPanel/BottomPanelMarkdownSection'
import { findElementWithText, findElementWithTitle } from './markdownTestUtils'

export async function testMarkdownLayoutViewToggleEndToEnd() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const raf = (cb: () => void) => {
      const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: () => void) => number }
      if (anyWindow.requestAnimationFrame) {
        anyWindow.requestAnimationFrame(cb)
        return
      }
      setTimeout(cb, 0)
    }
    const tick = () => new Promise<void>(resolve => raf(() => resolve()))
    await tick()

    const editorTitle = UI_COPY.bottomPanelMarkdownEditorTitle
    const viewerTitle = UI_COPY.bottomPanelMarkdownViewerTitle
    const editToggleTitle = UI_COPY.bottomPanelMarkdownEditToggleTitle

    // Initial state: Viewer mode (default)
    const editorHeaderInitial = findElementWithTitle(doc.body as HTMLElement, editorTitle)
    const viewerHeaderInitial = findElementWithTitle(doc.body as HTMLElement, viewerTitle)
    
    // In viewer mode, editor header should NOT be visible, viewer header SHOULD be visible
    if (editorHeaderInitial) throw new Error('editor header should be absent in initial viewer layout')
    if (!viewerHeaderInitial) {
      throw new Error('viewer header not found in initial viewer layout')
    }

    const findToggleButton = (title: string): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        if (btn.getAttribute('title') === title) return btn
        if (btn.getAttribute('aria-label') === title) return btn
      }
      return null
    }

    const editButton = findToggleButton(editToggleTitle)
    if (!editButton) {
      throw new Error('Edit toggle button not found')
    }
    
    // Toggle to Editor Mode
    editButton.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const editorHeaderEditorMode = findElementWithTitle(doc.body as HTMLElement, editorTitle)
    const viewerHeaderEditorMode = findElementWithTitle(doc.body as HTMLElement, viewerTitle)
    
    if (!editorHeaderEditorMode) {
      throw new Error('editor header not found after toggling to editor mode')
    }
    if (viewerHeaderEditorMode) throw new Error('viewer header should be absent in editor mode')

    // Toggle back to Viewer Mode
    // Note: The button might have re-rendered, so find it again or reuse if stable
    const editButton2 = findToggleButton(editToggleTitle)
    if (!editButton2) {
       throw new Error('Edit toggle button not found in editor mode')
    }
    editButton2.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()

    const editorHeaderViewerMode = findElementWithTitle(doc.body as HTMLElement, editorTitle)
    const viewerHeaderViewerMode = findElementWithTitle(doc.body as HTMLElement, viewerTitle)
    
    if (!viewerHeaderViewerMode) {
      throw new Error('viewer header not found after toggling back to viewer mode')
    }
    if (editorHeaderViewerMode) throw new Error('editor header should be absent in viewer mode')

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}

export async function testMarkdownPresentationFullscreenFromBottomPanelControls() {
  const storage = new MemoryStorage()
  const { restore: restoreWindow } = initWindowHarness({ storage })
  const { dom, restore: restoreDom } = initJsdomHarness()
  try {
    const anyWindow = dom.window as unknown as { requestAnimationFrame?: (cb: (ts: number) => void) => number }
    if (!anyWindow.requestAnimationFrame) {
      anyWindow.requestAnimationFrame = (cb: (ts: number) => void) =>
        setTimeout(() => cb(Date.now()), 0) as unknown as number
    }

    const doc = dom.window.document
    const container = doc.createElement('div')
    container.id = 'root'
    doc.body.appendChild(container)
    const root = createRoot(container as unknown as HTMLElement)
    root.render(React.createElement(BottomPanelMarkdownSection))

    const tick = () =>
      new Promise<void>(resolve =>
        anyWindow.requestAnimationFrame ? anyWindow.requestAnimationFrame(() => resolve()) : setTimeout(() => resolve(), 0),
      )

    await tick()
    await tick()

    const editorTitle = UI_COPY.bottomPanelMarkdownEditorTitle
    const viewerTitle = UI_COPY.bottomPanelMarkdownViewerTitle
    const editToggleTitle = UI_COPY.bottomPanelMarkdownEditToggleTitle

    const textarea = doc.querySelector('textarea') as HTMLTextAreaElement | null
    if (!textarea) {
      throw new Error('editor textarea not found')
    }

    const markdownLines: string[] = []
    markdownLines.push('---')
    markdownLines.push('title: Demo')
    markdownLines.push('---')
    markdownLines.push('')
    markdownLines.push('# Slide 1')
    markdownLines.push('')
    markdownLines.push('Content for slide 1.')
    const markdown = markdownLines.join('\n')

    textarea.value = markdown
    textarea.dispatchEvent(new dom.window.Event('input', { bubbles: true }))
    textarea.dispatchEvent(new dom.window.Event('change', { bubbles: true }))

    await tick()
    await tick()

    const fullscreenTitle = UI_COPY.bottomPanelMarkdownFullscreenToggleTitle
    const findFullscreenButton = (): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        const label = btn.getAttribute('aria-label') || ''
        if (label === fullscreenTitle) return btn
      }
      return null
    }

    const fullscreenBtn = findFullscreenButton()
    if (!fullscreenBtn) {
      throw new Error('markdown fullscreen toggle button not found')
    }

    // First click: Enables presentation mode (inline), but fails to enter fullscreen due to ref timing
    fullscreenBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))

    await tick()
    await tick()

    // Verify presentation root is present (inline)
    const inlinePresentationRoot = doc.querySelector('[data-testid="markdown-presentation-root"]')
    if (!inlinePresentationRoot) {
        throw new Error('expected inline presentation to be rendered after first fullscreen click')
    }

    // Switching: After entering inline presentation, user can still switch back to editor/viewer
    const findToggleButton = (title: string): HTMLButtonElement | null => {
      const buttons = Array.from(doc.querySelectorAll('button')) as HTMLButtonElement[]
      for (const btn of buttons) {
        if (btn.getAttribute('title') === title) return btn
        if (btn.getAttribute('aria-label') === title) return btn
      }
      return null
    }

    const editBtn = findToggleButton(editToggleTitle)
    if (!editBtn) throw new Error('edit toggle button not found after entering presentation')
    editBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    await tick()
    await tick()

    const editorHeader = findElementWithTitle(doc.body as HTMLElement, editorTitle)
    const viewerHeader = findElementWithTitle(doc.body as HTMLElement, viewerTitle)
    if (!editorHeader) throw new Error('expected editor mode to be reachable after entering presentation')
    if (viewerHeader) throw new Error('expected viewer header to be hidden in editor mode after toggle')

    // Second click: Should trigger enterFullscreen since ref is now populated
    fullscreenBtn.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true }))
    
    await tick()
    await tick()

    const overlay = doc.querySelector('.fixed.inset-0.z-\\[99999\\], .absolute.inset-0.z-\\[99999\\]') as HTMLDivElement | null
    if (!overlay) {
      throw new Error('expected PreviewOverlay to be open after fullscreen toggle from bottom panel controls')
    }
    
    // In fullscreen overlay, the structure is different (ZoomPanViewport).
    // We check if the slide content is present in the overlay.
    const slideContent = findElementWithText(overlay, 'Slide 1')
    if (!slideContent) {
       throw new Error('expected overlay to contain slide content "Slide 1"')
    }

    root.unmount()
  } finally {
    restoreDom()
    restoreWindow()
  }
}
