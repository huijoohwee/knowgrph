import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MarkdownWorkspaceMain } from '@/features/markdown-workspace/main/MarkdownWorkspaceMain'
import {
  readLocalEditorWorkspaceSurfaceSnapshot,
  resetBrowserLocalSurfaceSnapshotsForTests,
} from '@/features/agent-ready/browserLocalSurfaceSnapshots'
import { inspectLocalEditorWorkspaceState } from '@/features/agent-ready/localEditorWorkspaceStateInspection'
import { useGraphStore } from '@/hooks/useGraphStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'

const tick = async (n = 1): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

const buildWorkspaceProps = (overrides: Partial<React.ComponentProps<typeof MarkdownWorkspaceMain>> = {}) => ({
  themeMode: 'light' as const,
  uiPanelTextFontClass: 'font-sans',
  uiPanelMonospaceTextClass: 'font-mono',
  explorerOpen: false,
  setExplorerOpen: () => void 0,
  layoutMode: 'viewer' as const,
  setLayoutMode: () => void 0,
  markdownWordWrap: true,
  setMarkdownWordWrap: () => void 0,
  markdownTextHighlight: false,
  setMarkdownTextHighlight: () => void 0,
  onToggleFullscreen: () => void 0,
  presentationApiRef: { current: null },
  isMarkdown: true,
  activeText: ['# Editor Workspace', '', 'Body line.'].join('\n'),
  setActiveText: () => void 0,
  activeDocumentKey: '/workspace/webmcp-editor-readiness.md',
  highlightedLineRange: null,
  revealLineInEditor: () => void 0,
  showInViewer: () => void 0,
  showInPresentation: () => void 0,
  showInGallery: () => void 0,
  editorUri: 'file:///workspace/webmcp-editor-readiness.md',
  editorLanguage: 'markdown',
  editorRef: { current: null },
  ...overrides,
})

export async function testMarkdownWorkspaceMainPublishesLiveEditorWorkspaceInspectionState() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  let cleanupAssertionError: Error | null = null
  try {
    resetBrowserLocalSurfaceSnapshotsForTests()
    useGraphStore.getState().resetAll()

    await act(async () => {
      root.render(React.createElement(MarkdownWorkspaceMain, buildWorkspaceProps()))
      await tick(8)
    })

    const initialInspection = inspectLocalEditorWorkspaceState(readLocalEditorWorkspaceSurfaceSnapshot())
    if (initialInspection.available !== true) {
      throw new Error(`expected mounted editor workspace readiness to be available, got ${JSON.stringify(initialInspection)}`)
    }
    if (
      initialInspection.activeDocumentKey !== '/workspace/webmcp-editor-readiness.md' ||
      initialInspection.layoutMode !== 'viewer' ||
      initialInspection.draftState.hasUncommittedDraft !== false ||
      initialInspection.liveStructure?.hasFrontmatter !== false
    ) {
      throw new Error(`expected initial editor workspace readiness to reflect the mounted markdown document, got ${JSON.stringify(initialInspection)}`)
    }
    if (!initialInspection.draftState.preview.includes('# Editor Workspace')) {
      throw new Error(`expected initial editor workspace preview to mirror the live markdown text, got ${JSON.stringify(initialInspection.draftState)}`)
    }

    const nextText = [
      '---',
      'title: Agent Ready Workspace',
      'flow:',
      '  subgraphs:',
      '    - id: sg-alpha',
      '      label: Alpha',
      '---',
      '',
      '# Editor Workspace',
      '',
      'Updated body line.',
    ].join('\n')

    await act(async () => {
      root.render(React.createElement(MarkdownWorkspaceMain, buildWorkspaceProps({
        layoutMode: 'editor',
        activeText: nextText,
      })))
      await tick(8)
    })

    const updatedInspection = inspectLocalEditorWorkspaceState(readLocalEditorWorkspaceSurfaceSnapshot())
    if (
      updatedInspection.available !== true ||
      updatedInspection.layoutMode !== 'editor' ||
      updatedInspection.draftState.hasUncommittedDraft !== false
    ) {
      throw new Error(`expected updated editor workspace readiness to reflect the rerendered editor state, got ${JSON.stringify(updatedInspection)}`)
    }
    if (
      updatedInspection.liveStructure?.hasFrontmatter !== true ||
      updatedInspection.liveStructure?.hasFlowBlock !== true ||
      updatedInspection.liveStructure?.flowSubgraphCount !== 1
    ) {
      throw new Error(`expected updated editor workspace readiness to parse live frontmatter and flow.subgraphs from the real owner path, got ${JSON.stringify(updatedInspection.liveStructure)}`)
    }
    if (
      !updatedInspection.liveStructure?.topLevelKeys.includes('title') ||
      !updatedInspection.liveStructure?.topLevelKeys.includes('flow')
    ) {
      throw new Error(`expected updated editor workspace readiness to surface frontmatter keys from the live markdown text, got ${JSON.stringify(updatedInspection.liveStructure)}`)
    }
    if (!updatedInspection.draftState.preview.includes('title: Agent Ready Workspace')) {
      throw new Error(`expected updated editor workspace preview to reflect the live frontmatter markdown text, got ${JSON.stringify(updatedInspection.draftState)}`)
    }
  } finally {
    try {
      await act(async () => {
        root.unmount()
        await tick(2)
      })
    } catch {
      void 0
    }
    const clearedInspection = inspectLocalEditorWorkspaceState(readLocalEditorWorkspaceSurfaceSnapshot())
    if (clearedInspection.available !== false) {
      cleanupAssertionError = new Error(`expected editor workspace readiness snapshot cleanup on unmount, got ${JSON.stringify(clearedInspection)}`)
    }
    resetBrowserLocalSurfaceSnapshotsForTests()
    useGraphStore.getState().resetAll()
    restore()
  }
  if (cleanupAssertionError) throw cleanupAssertionError
}

export async function testMarkdownWorkspaceMainShowsFrontmatterWarningsInActiveDocumentSurface() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    useGraphStore.getState().resetAll()

    await act(async () => {
      root.render(React.createElement(MarkdownWorkspaceMain, buildWorkspaceProps({
        layoutMode: 'editor',
        activeText: [
          '---',
          'title: Valid Frontmatter',
          'flow:',
          '  direction: LR',
          '---',
          '',
          '# Valid',
        ].join('\n'),
      })))
      await tick(4)
    })

    if (doc.querySelector('[aria-label="Frontmatter warning"]')) {
      throw new Error('expected valid frontmatter to avoid rendering a warning banner')
    }

    await act(async () => {
      root.render(React.createElement(MarkdownWorkspaceMain, buildWorkspaceProps({
        layoutMode: 'editor',
        activeText: [
          '---',
          'title: "Broken',
          'flow:',
          '  direction: LR',
          '---',
          '',
          '# Invalid',
        ].join('\n'),
      })))
      await tick(4)
    })

    const warningEl = doc.querySelector('[aria-label="Frontmatter warning"]') as HTMLElement | null
    if (!warningEl) throw new Error('expected malformed frontmatter to render an active document warning banner')
    const warningText = String(warningEl.textContent || '')
    if (!warningText.includes('Frontmatter warning')) {
      throw new Error(`expected warning banner label, got ${JSON.stringify(warningText)}`)
    }
    if (!warningText.includes('Markdown frontmatter YAML parse failed and frontmatter was ignored:')) {
      throw new Error(`expected parse failure detail in warning banner, got ${JSON.stringify(warningText)}`)
    }
  } finally {
    try {
      await act(async () => {
        root.unmount()
        await tick(2)
      })
    } catch {
      void 0
    }
    restore()
  }
}

export async function testMarkdownWorkspaceMainSuppressesTransientFrontmatterWarningsDuringStreamingTrace() {
  const { dom, restore } = initJsdomHarness()
  const doc = dom.window.document
  const container = doc.createElement('section')
  doc.body.appendChild(container)
  const root = createRoot(container as unknown as HTMLElement)

  try {
    await act(async () => {
      root.render(React.createElement(MarkdownWorkspaceMain, buildWorkspaceProps({
        layoutMode: 'editor',
        suppressFrontmatterWarnings: true,
        activeText: [
          '---',
          'title: "Broken',
          'flow: [a b]',
          '---',
          '',
          '# Streaming',
        ].join('\n'),
      })))
      await tick(4)
    })

    if (doc.querySelector('[aria-label="Frontmatter warning"]')) {
      throw new Error('expected transient streaming trace frontmatter parse failures to stay hidden while the draft is still streaming')
    }
  } finally {
    try {
      await act(async () => {
        root.unmount()
        await tick(2)
      })
    } catch {
      void 0
    }
    restore()
  }
}
