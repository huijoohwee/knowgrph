import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { StoryboardWidgetInlineValueEditor } from '@/components/StoryboardWidget/StoryboardWidgetInlineValueEditor'
import CommandMenuCatalogPanel from '@/features/command-menu/CommandMenuCatalogPanel'
import {
  clearWorkspaceDataViewFloatingBinding,
  setWorkspaceDataViewFloatingBinding,
  setWorkspaceDataViewFloatingDensity,
  useWorkspaceDataViewFloatingDensity,
  type WorkspaceDataViewFloatingBinding,
} from '@/features/markdown-workspace/main/viewer/workspaceDataViewFloatingStore'
import { coerceWorkspaceDataViewConfig, type WorkspaceDataViewConfig } from '@/features/markdown-workspace/main/viewer/workspaceDataViewConfig'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { CardMarkdownPreview } from '@/lib/cards/CardMarkdownPreview'
import { insertMediaIntoActiveCardInlineTextEditor } from '@/lib/cards/cardInlineTextExternalCommands'
import { writeCommandMenuMediaNameDraft } from '@/lib/command-menu/commandMenuMediaNameSync'
import { collectInlineKeywordCommandCandidates } from '@/lib/command-menu/inlineCommandMenuCatalog'
import { UPLOADED_MEDIA_PANEL_STORAGE_KEY } from '@/lib/storage/uploadedMediaPanelItems'
import {
  DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME,
  resolveDataViewChipClass,
} from '@/features/markdown/ui/dataViewChipStyles'
import { renderSafeHtmlBlock } from '@/features/markdown/ui/markdownPreviewLinks'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'
const readUtf8 = (relativePath: string) => readFileSync(new URL(relativePath, import.meta.url), 'utf8')
const buildFloatingBinding = (viewConfig: WorkspaceDataViewConfig): WorkspaceDataViewFloatingBinding => ({
  registrationId: 'storybook-refresh-density',
  contextLabel: 'Storyboard',
  activePanel: 'layout',
  canMutate: true,
  viewerLayout: 'kanban',
  viewerMode: 'multiDimTable',
  allowMultiDimLayout: true,
  columns: [],
  groupByColumnId: null,
  viewConfig,
  setViewConfig: () => void 0,
  onChangeLayout: () => void 0,
})
const buildViewConfig = (density: { rowHeightPreset: 'compact' | 'comfortable'; fieldLineMode: 'single' | 'double' }): WorkspaceDataViewConfig => {
  const viewConfig = coerceWorkspaceDataViewConfig({
    v: 2,
    id: 'v0',
    name: 'Kanban View',
    layout: 'kanban',
    groupByColumnId: null,
    visibleColumnIds: null,
    columnTypesById: null,
    filterGroups: [{ id: 'g0', rules: [] }],
    sortRules: [],
    rowHeightPreset: density.rowHeightPreset,
    fieldLineMode: density.fieldLineMode,
  })
  if (!viewConfig) throw new Error('expected test view config to coerce')
  return viewConfig
}
export async function testCardInlineTextEditorTextareaKeepsInvocationTokensNative() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const raw = 'Imported /prd-tad.create #frontmatter @operator document source unit.'
  const committedValues: string[] = []
  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: raw,
          ariaLabel: 'Strybldr card summary',
          placeholder: 'Summary',
          canEdit: true,
          editorSurface: 'control',
          editActivation: 'click',
          multiline: true,
          rows: 2,
          markdownPreview: 'auto',
          editorClassName: 'h-full min-h-[3rem] resize-none overflow-auto rounded border bg-[color:var(--kg-input-bg)] px-1.5 py-1 text-[10px] leading-4 text-[color:var(--kg-text-primary)]',
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await waitForFrames(dom.window, 8)
    })
    const display = container.querySelector('[data-kg-card-inline-edit="1"]') as HTMLElement | null
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error(`expected card inline text display, html=${container.innerHTML}`)
    }
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 6)
    })
    const textarea = container.querySelector('textarea[data-kg-card-inline-edit-input="1"]') as HTMLTextAreaElement | null
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error(`expected card textarea editor to mount, html=${container.innerHTML}`)
    }
    if (textarea.value !== raw) {
      throw new Error(`expected card textarea to keep raw authored value, got ${JSON.stringify(textarea.value)}`)
    }
    if (textarea.getAttribute('data-kg-card-inline-edit-projected-overlay') === '1') {
      throw new Error(`expected / # @ text to stay native without projected overlay activation, html=${container.innerHTML}`)
    }
    if (String(textarea.getAttribute('class') || '').includes('text-transparent') || String(textarea.getAttribute('class') || '').includes('caret-transparent')) {
      throw new Error(`expected / # @ textarea editing to keep native visible text and caret, class=${JSON.stringify(textarea.getAttribute('class'))}`)
    }
    const overlay = container.querySelector('[data-kg-chat-input-overlay="1"]') as HTMLElement | null
    const slashChip = container.querySelector('[data-kg-chat-input-invocation-chip="slash"][data-kg-chat-input-invocation-token="/prd-tad.create"]')
    const keywordChip = container.querySelector('[data-kg-chat-input-invocation-chip="keyword"][data-kg-chat-input-invocation-token="#frontmatter"]')
    const bindingChip = container.querySelector('[data-kg-chat-input-invocation-chip="binding"][data-kg-chat-input-invocation-token="@operator"]')
    if (overlay || slashChip || keywordChip || bindingChip) {
      throw new Error(`expected / # @ card textarea text to avoid chip projection and caret mutation, html=${container.innerHTML}`)
    }
    const assertNativeCaretForToken = async (token: string) => {
      const cursor = raw.indexOf(token) + token.length
      if (cursor < token.length) throw new Error(`expected raw test value to include ${token}`)
      await act(async () => {
        textarea.setSelectionRange(cursor, cursor)
        Simulate.select(textarea)
        await waitForFrames(dom.window, 2)
      })
      const projectedCaret = container.querySelector('[data-kg-textarea-invocation-projected-caret="1"]')
      if (projectedCaret) {
        throw new Error(`expected native caret inside ${token} without projected caret marker, html=${container.innerHTML}`)
      }
      if (textarea.selectionStart !== cursor || textarea.selectionEnd !== cursor) {
        throw new Error(`expected native selection to stay at ${cursor} for ${token}, got ${textarea.selectionStart}:${textarea.selectionEnd}`)
      }
    }
    await assertNativeCaretForToken('/prd-tad.create')
    await assertNativeCaretForToken('#frontmatter')
    await assertNativeCaretForToken('@operator')
    await act(async () => {
      textarea.value = textarea.value.replace('#frontmatter', '#runtime-ready')
      const cursor = textarea.value.indexOf('#runtime-ready') + '#runtime-ready'.length
      textarea.setSelectionRange(cursor, cursor)
      Simulate.change(textarea)
      await waitForFrames(dom.window, 2)
    })
    const updatedTextarea = container.querySelector('textarea[data-kg-card-inline-edit-input="1"]') as HTMLTextAreaElement | null
    if (!(updatedTextarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error(`expected edited card textarea to stay mounted, html=${container.innerHTML}`)
    }
    if (updatedTextarea.value !== raw.replace('#frontmatter', '#runtime-ready')) {
      throw new Error(`expected / # @ text edit to avoid display/raw remapping, got ${JSON.stringify(updatedTextarea.value)}`)
    }
    await act(async () => {
      Simulate.keyDown(updatedTextarea, { key: 'Enter', metaKey: true })
      await waitForFrames(dom.window, 4)
    })
    if (committedValues[0] !== raw.replace('#frontmatter', '#runtime-ready')) {
      throw new Error(`expected / # @ textarea commit to persist the literal edit, got ${JSON.stringify(committedValues)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorTextareaProjectsInlineMediaChip() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const raw = 'Imported ![Image: source brief](https://example.com/source-brief.png) document source unit.'
  const committedValues: string[] = []
  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: raw,
          ariaLabel: 'Strybldr card summary',
          placeholder: 'Summary',
          canEdit: true,
          editorSurface: 'control',
          editActivation: 'click',
          multiline: true,
          rows: 2,
          markdownPreview: 'auto',
          editorClassName: 'h-full min-h-[3rem] resize-none overflow-auto rounded border bg-[color:var(--kg-input-bg)] px-1.5 py-1 text-[10px] leading-4 text-[color:var(--kg-text-primary)]',
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await waitForFrames(dom.window, 8)
    })
    const display = container.querySelector('[data-kg-card-inline-edit="1"]') as HTMLElement | null
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error(`expected card inline text display, html=${container.innerHTML}`)
    }
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 6)
    })
    const textarea = container.querySelector('textarea[data-kg-card-inline-edit-input="1"]') as HTMLTextAreaElement | null
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error(`expected card textarea editor to mount for inline media projection, html=${container.innerHTML}`)
    }
    if (textarea.value.includes('![') || textarea.value.includes('https://example.com/source-brief.png') || !textarea.value.includes('@Image: source brief')) {
      throw new Error(`expected card textarea to show compact @ media chip text instead of raw markdown, got ${JSON.stringify(textarea.value)}`)
    }
    if (textarea.getAttribute('data-kg-card-inline-edit-media-overlay') !== '1') {
      throw new Error(`expected card textarea to expose media overlay activation, html=${container.innerHTML}`)
    }
    const mediaChip = container.querySelector('[data-kg-chat-input-media-chip="1"]') as HTMLElement | null
    const mediaMetric = container.querySelector('[data-kg-chat-input-media-metric="preserve"][data-kg-chat-input-media-token="@Image: source brief"]')
    const mediaThumbnail = mediaChip?.querySelector('[data-kg-inline-command-thumbnail="image"] img') as HTMLImageElement | null
    if (!mediaChip || !mediaMetric || !mediaThumbnail || mediaThumbnail.getAttribute('src') !== 'https://example.com/source-brief.png') {
      throw new Error(`expected card textarea to reuse FloatingPanel Chat @ media chip projection, html=${container.innerHTML}`)
    }
    await act(async () => {
      textarea.value = `${textarea.value} after`
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      Simulate.change(textarea)
      await waitForFrames(dom.window, 4)
    })
    await act(async () => {
      const updatedTextarea = container.querySelector('textarea[data-kg-card-inline-edit-input="1"]') as HTMLTextAreaElement | null
      if (!(updatedTextarea instanceof dom.window.HTMLTextAreaElement)) throw new Error(`expected projected media textarea to remain mounted before commit, html=${container.innerHTML}`)
      Simulate.keyDown(updatedTextarea, { key: 'Enter', metaKey: true })
      await waitForFrames(dom.window, 4)
    })
    const committed = committedValues[0] || ''
    if (!committed.includes('![Image: source brief](https://example.com/source-brief.png)') || !committed.endsWith(' after')) {
      throw new Error(`expected card textarea commit to preserve raw media markdown while accepting display edits, got ${JSON.stringify(committedValues)}`)
    }
    if (committed.includes('@Image: source brief')) {
      throw new Error(`expected card textarea commit to avoid persisting compact @ media label, got ${JSON.stringify(committed)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
