import React from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import Toolbar from '@/components/Toolbar'
import { EmbeddedEditorShell } from '@/components/EmbeddedEditorShell'

const tick = async () => {
  await new Promise<void>(resolve => setTimeout(resolve, 0))
}

export async function testToolbarEditorButtonTogglesWorkspaceViewMode() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    useGraphStore.getState().setWorkspaceViewMode('canvas')

    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    root.render(
      <Toolbar onZoomIn={() => {}} onZoomOut={() => {}} onReset={() => {}} onZoomSelection={() => {}} />,
    )

    await tick()

    const editorBtn = dom.window.document.querySelector('button[aria-label="Editor"]') as HTMLButtonElement | null
    const statusBtn = dom.window.document.querySelector('button[aria-label="Status"]') as HTMLButtonElement | null
    if (!editorBtn) throw new Error('expected Editor button')
    if (!statusBtn) throw new Error('expected Status button')

    editorBtn.click()
    await tick()
    if (useGraphStore.getState().workspaceViewMode !== 'editor') throw new Error('expected workspaceViewMode to be editor after click')

    editorBtn.click()
    await tick()
    if (useGraphStore.getState().workspaceViewMode !== 'canvas') throw new Error('expected workspaceViewMode to be canvas after second click')

    root.unmount()
  } finally {
    try {
      useGraphStore.getState().setWorkspaceViewMode('canvas')
    } catch {
      void 0
    }
    restore()
  }
}

export async function testEmbeddedEditorShellRendersCanvasPreviewIframe() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  try {
    const container = dom.window.document.getElementById('root')
    if (!container) throw new Error('missing root container')

    const root = createRoot(container)
    root.render(<EmbeddedEditorShell previewSrc="/" />)
    await tick()

    const iframe = dom.window.document.querySelector('iframe[title="Canvas Preview"]') as HTMLIFrameElement | null
    if (!iframe) throw new Error('expected Canvas Preview iframe')
    const src = String(iframe.getAttribute('src') || '')
    if (src !== '/') throw new Error(`expected iframe src to be /, got ${src}`)
    const marker = String(iframe.getAttribute('data-kg-preview') || '')
    if (marker !== '1') throw new Error(`expected iframe to include data-kg-preview=1, got ${marker}`)

    root.unmount()
  } finally {
    restore()
  }
}
