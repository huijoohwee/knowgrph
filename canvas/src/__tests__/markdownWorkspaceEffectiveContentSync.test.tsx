import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  resolveLiveWorkspaceStreamingText,
  useMarkdownWorkspaceEffectiveContent,
} from '@/lib/markdown-workspace-runtime/useMarkdownWorkspaceEffectiveContent'

const tick = async (n = 1): Promise<void> => {
  for (let i = 0; i < n; i += 1) {
    await new Promise<void>(resolve => setTimeout(resolve, 0))
  }
}

export async function testMarkdownWorkspaceEffectiveContentPrefersCanonicalWritebackWhenEditorIsClean() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const container = dom.window.document.getElementById('root')
  if (!container) throw new Error('missing root container')
  const root = createRoot(container)

  try {
    const canonicalText = [
      '---',
      'title: Demo',
      'flow:',
      '  nodes:',
      '    - id: SCENE_01',
      '      summary: Updated from graph writeback.',
      '---',
      '',
      '# Demo',
    ].join('\n')

    function Harness() {
      const [activeText, setActiveText] = React.useState('stale workspace text')
      const userEditedActiveTextRef = React.useRef(false)
      const effective = useMarkdownWorkspaceEffectiveContent({
        activePath: '/docs/demo.md' as never,
        activeDocumentKey: 'docs/demo.md',
        activeEntryKind: 'file',
        activeText,
        setActiveText,
        markdownDocumentName: '/docs/demo.md',
        markdownDocumentText: canonicalText,
        layoutMode: 'split',
        contentMode: 'document',
        widgetFormat: 'markdown',
        widgetEditorText: '',
        widgetViewerText: '',
        pdfWorkspaceViewerTextOverride: null,
        webpageWorkspaceMeta: null,
        webpageWorkspaceEditorTextOverride: null,
        webpageWorkspaceViewerTextOverride: null,
        userEditedActiveTextRef,
      })

      return (
        <output
          data-testid="state"
          data-active-text={activeText}
          data-effective-text={effective.effectiveActiveText}
        />
      )
    }

    const readState = () => {
      const el = dom.window.document.querySelector('[data-testid="state"]')
      if (!(el instanceof dom.window.HTMLElement)) throw new Error('missing state output')
      return {
        activeText: el.getAttribute('data-active-text') || '',
        effectiveText: el.getAttribute('data-effective-text') || '',
      }
    }

    await act(async () => {
      root.render(<Harness />)
      await tick(4)
    })

    const state = readState()
    if (state.activeText !== canonicalText) {
      throw new Error(`expected clean workspace editor text to resync from canonical markdown writeback, got ${JSON.stringify(state)}`)
    }
    if (state.effectiveText !== canonicalText) {
      throw new Error(`expected effective workspace text to prefer canonical markdown writeback, got ${JSON.stringify(state)}`)
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

export async function testMarkdownWorkspaceEffectiveContentPreservesUnsavedEditorDraftOverCanonicalWriteback() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const container = dom.window.document.getElementById('root')
  if (!container) throw new Error('missing root container')
  const root = createRoot(container)

  try {
    const draftText = 'locally edited unsaved draft'
    const canonicalText = 'upstream canonical text'

    function Harness() {
      const [activeText, setActiveText] = React.useState(draftText)
      const userEditedActiveTextRef = React.useRef(true)
      const effective = useMarkdownWorkspaceEffectiveContent({
        activePath: '/docs/demo.md' as never,
        activeDocumentKey: 'docs/demo.md',
        activeEntryKind: 'file',
        activeText,
        setActiveText,
        markdownDocumentName: '/docs/demo.md',
        markdownDocumentText: canonicalText,
        layoutMode: 'split',
        contentMode: 'document',
        widgetFormat: 'markdown',
        widgetEditorText: '',
        widgetViewerText: '',
        pdfWorkspaceViewerTextOverride: null,
        webpageWorkspaceMeta: null,
        webpageWorkspaceEditorTextOverride: null,
        webpageWorkspaceViewerTextOverride: null,
        userEditedActiveTextRef,
      })

      return (
        <output
          data-testid="state"
          data-active-text={activeText}
          data-effective-text={effective.effectiveActiveText}
        />
      )
    }

    const readState = () => {
      const el = dom.window.document.querySelector('[data-testid="state"]')
      if (!(el instanceof dom.window.HTMLElement)) throw new Error('missing state output')
      return {
        activeText: el.getAttribute('data-active-text') || '',
        effectiveText: el.getAttribute('data-effective-text') || '',
      }
    }

    await act(async () => {
      root.render(<Harness />)
      await tick(4)
    })

    const state = readState()
    if (state.activeText !== draftText || state.effectiveText !== draftText) {
      throw new Error(`expected unsaved workspace draft to remain authoritative over canonical writeback, got ${JSON.stringify(state)}`)
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

export async function testMarkdownWorkspaceEffectiveContentKeepsNonMarkdownSourceTextAuthoritative() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><div id="root"></div></body></html>')
  const container = dom.window.document.getElementById('root')
  if (!container) throw new Error('missing root container')
  const root = createRoot(container)

  try {
    const jsonSourceText = '{"rows":[{"Column":"Value"}]}'
    const derivedMarkdownText = '| Column |\n|---|\n| Value |'

    function Harness() {
      const [activeText, setActiveText] = React.useState(jsonSourceText)
      const userEditedActiveTextRef = React.useRef(false)
      const effective = useMarkdownWorkspaceEffectiveContent({
        activePath: '/docs/data.json' as never,
        activeDocumentKey: 'docs/data.json',
        activeEntryKind: 'file',
        activeText,
        setActiveText,
        markdownDocumentName: '/docs/data.json',
        markdownDocumentText: derivedMarkdownText,
        layoutMode: 'split',
        contentMode: 'document',
        widgetFormat: 'markdown',
        widgetEditorText: '',
        widgetViewerText: '',
        pdfWorkspaceViewerTextOverride: null,
        webpageWorkspaceMeta: null,
        webpageWorkspaceEditorTextOverride: null,
        webpageWorkspaceViewerTextOverride: null,
        userEditedActiveTextRef,
      })

      return (
        <output
          data-testid="state"
          data-active-text={activeText}
          data-effective-text={effective.effectiveActiveText}
        />
      )
    }

    const readState = () => {
      const el = dom.window.document.querySelector('[data-testid="state"]')
      if (!(el instanceof dom.window.HTMLElement)) throw new Error('missing state output')
      return {
        activeText: el.getAttribute('data-active-text') || '',
        effectiveText: el.getAttribute('data-effective-text') || '',
      }
    }

    await act(async () => {
      root.render(<Harness />)
      await tick(4)
    })

    const state = readState()
    if (state.activeText !== jsonSourceText || state.effectiveText !== jsonSourceText) {
      throw new Error(`expected non-markdown workspace source text to remain authoritative over derived markdown text, got ${JSON.stringify(state)}`)
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

export function testMarkdownWorkspaceEffectiveContentPrefersMatchingLiveStreamingDraft() {
  useGraphStore.getState().setChatWorkspaceStreamingState({
    path: '/chat-log/20260527T193000Z/kgc-trace_20260527T193000Z.md',
    text: '# streaming draft',
  })
  try {
    const state = useGraphStore.getState()
    const resolved = resolveLiveWorkspaceStreamingText({
      activePath: '/chat-log/20260527T193000Z/kgc-trace_20260527T193000Z.md' as never,
      streamingPath: state.chatWorkspaceStreamingPath,
      streamingText: state.chatWorkspaceStreamingText,
      userEditedActiveText: false,
    })
    if (resolved !== '# streaming draft') {
      throw new Error(`expected matching live workspace stream draft to override empty editor content, got ${JSON.stringify({ resolved })}`)
    }
    const hiddenByUserDraft = resolveLiveWorkspaceStreamingText({
      activePath: '/chat-log/20260527T193000Z/kgc-trace_20260527T193000Z.md' as never,
      streamingPath: state.chatWorkspaceStreamingPath,
      streamingText: state.chatWorkspaceStreamingText,
      userEditedActiveText: true,
    })
    if (hiddenByUserDraft) {
      throw new Error(`expected live workspace stream override to yield to an unsaved user draft, got ${JSON.stringify({ hiddenByUserDraft })}`)
    }
  } finally {
    useGraphStore.getState().setChatWorkspaceStreamingState(null)
  }
}
