import React, { act } from 'react'
import { readFileSync } from 'node:fs'
import { createRoot } from 'react-dom/client'
import { Simulate } from 'react-dom/test-utils'
import { FlowEditorInlineValueEditor } from '@/components/FlowEditor/FlowEditorInlineValueEditor'
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
  DATA_VIEW_CHIP_ROW_CLASSNAME,
  DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME,
  resolveDataViewChipClass,
} from '@/features/markdown/ui/dataViewChipStyles'
import { renderSafeHtmlBlock } from '@/features/markdown/ui/markdownPreviewLinks'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'

const readUtf8 = (relativePath: string) => {
  return readFileSync(new URL(relativePath, import.meta.url), 'utf8')
}

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

export function testPlainTextInputEditorUsesReactChangeContract() {
  const plainTextInput = readUtf8('../components/ui/PlainTextInputEditor.tsx')
  if (plainTextInput.includes('onInput=')) {
    throw new Error('expected PlainTextInputEditor to avoid native onInput handlers and reuse the shared React change contract')
  }
  const changeHandlerCount = (plainTextInput.match(/onChange=\{ev => onChange\?\.\(ev\.currentTarget\.value\)\}/g) || []).length
  if (changeHandlerCount < 2) {
    throw new Error(`expected PlainTextInputEditor to publish the React change contract for both input variants, got ${changeHandlerCount}`)
  }
  for (const snippet of ['value={value}', 'value={value}\n        defaultValue={defaultValue}', 'value={value}\n      defaultValue={defaultValue}']) {
    if (!plainTextInput.includes(snippet)) {
      throw new Error(`expected PlainTextInputEditor to keep controlled value ownership for shared editors: ${snippet}`)
    }
  }
}

export function testCardInlineTextEditorPreservesSharedMultilineCommitContract() {
  const cardInlineEditor = readUtf8('../lib/cards/CardInlineTextEditor.tsx')
  const flowEditorOverlayProxy = readUtf8('../lib/canvas/flow-editor-overlay-proxy.ts')
  for (const snippet of [
    '<PanelTextarea',
    '<PanelTextInput',
    'value: draft',
    'setDraft(event.currentTarget.value)',
    'rowHeightPreset={editorDensity.rowHeightPreset}',
    'fieldLineMode={editorDensity.fieldLineMode}',
    'density={editorDensity.rowHeightPreset}',
    "editActivation = 'doubleClick'",
    'data-kg-card-inline-edit-activation={editActivation}',
    'onPointerDown={event => {',
    'shouldOpenMarkdownViewerInlineEditorFromReadClick',
    'onBlur: (event: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {',
    'commit()',
    "if (multiline && event.key === 'Enter' && (event.metaKey || event.ctrlKey))",
    'onCommit?.(next)',
  ]) {
    if (!cardInlineEditor.includes(snippet)) {
      throw new Error(`expected CardInlineTextEditor to preserve the shared multiline commit contract: ${snippet}`)
    }
  }
  if (!flowEditorOverlayProxy.includes('[data-kg-card-inline-edit="1"]')) {
    throw new Error('expected Flow Editor overlay pointer routing to treat shared card inline editors as interactive controls')
  }
}

export async function testWorkspaceDataViewFloatingDensityResyncsSameRegistrationViewConfig() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const snapshots: string[] = []

  function DensityProbe() {
    const density = useWorkspaceDataViewFloatingDensity()
    snapshots.push(`${density.rowHeightPreset}:${density.fieldLineMode}`)
    return React.createElement('span', { 'data-density': `${density.rowHeightPreset}:${density.fieldLineMode}` })
  }

  try {
    await act(async () => {
      root.render(React.createElement(DensityProbe))
      await waitForFrames(dom.window, 4)
    })

    await act(async () => {
      setWorkspaceDataViewFloatingBinding(buildFloatingBinding(buildViewConfig({
        rowHeightPreset: 'comfortable',
        fieldLineMode: 'single',
      })))
      await waitForFrames(dom.window, 4)
    })

    await act(async () => {
      setWorkspaceDataViewFloatingBinding(buildFloatingBinding(buildViewConfig({
        rowHeightPreset: 'comfortable',
        fieldLineMode: 'double',
      })))
      await waitForFrames(dom.window, 4)
    })

    const latestDensity = container.querySelector('[data-density]')?.getAttribute('data-density')
    if (latestDensity !== 'comfortable:double') {
      throw new Error(`expected same-registration binding update to resync persisted density after refresh, got ${String(latestDensity)} snapshots=${snapshots.join(',')}`)
    }
  } finally {
    clearWorkspaceDataViewFloatingBinding('storybook-refresh-density')
    setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'comfortable', fieldLineMode: 'single' })
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export function testInlineKeywordCommandsReuseCompleteDashboardKeywordContext() {
  const dashboardKeywords = Array.from({ length: 36 }, (_, index) => `#Reusabletype${String(index).padStart(2, '0')}`)
  const candidates = collectInlineKeywordCommandCandidates({
    draftText: [
      ...dashboardKeywords,
      '#Strybldrimagesource',
      '#Storyboardframe',
      '#Storyboardelement',
      '#Fork',
      '#Review',
      '#Publish',
      'Review element cards, revise prompts, then send the approved sequence to video generation.',
    ].join('\n'),
  })
  const labels = new Set(candidates.map(candidate => candidate.label))
  for (const expectedLabel of ['Strybldrimagesource', 'Storyboardframe', 'Storyboardelement', 'Fork', 'Review', 'Publish']) {
    if (!labels.has(expectedLabel)) {
      throw new Error(`expected inline # command menu to include Dashboard keyword ${expectedLabel}, got ${JSON.stringify(candidates.map(candidate => candidate.label))}`)
    }
  }
}

export function testCardInlineTextEditorAvoidsRuntimeFocusPolyfill() {
  const cardInlineEditor = readUtf8('../lib/cards/CardInlineTextEditor.tsx')
  for (const fragment of ['attach' + 'Event', 'detach' + 'Event']) {
    if (cardInlineEditor.includes(fragment)) {
      throw new Error(`expected CardInlineTextEditor to avoid runtime focus polyfill fragment: ${fragment}`)
    }
  }
}

export async function testCardInlineTextEditorAllowsSharedClickActivation() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Revenue card',
          ariaLabel: 'Card title',
          placeholder: 'Add title',
          canEdit: true,
          editActivation: 'click',
          onCommit: () => void 0,
        }),
      )
      await waitForFrames(dom.window, 8)
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected shared card inline editor to expose the click activation marker')
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const input = container.querySelector('input[aria-label="Card title"]')
    if (!(input instanceof dom.window.HTMLInputElement)) {
      throw new Error('expected shared card inline editor click activation to open the editable input')
    }
    if (input.value !== 'Revenue card') {
      throw new Error(`expected click activation to preserve current card value, got ${JSON.stringify(input.value)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorExternalMediaInvokeTargetsActiveField() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Review source evidence.',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          multiline: true,
          rows: 3,
          onCommit: value => committedValues.push(value),
        }),
      )
      await waitForFrames(dom.window, 8)
    })

    const display = container.querySelector('[data-kg-card-inline-edit="1"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected card inline display to expose the external invoke target')
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 2)
    })

    const inserted = insertMediaIntoActiveCardInlineTextEditor({
      kind: 'image',
      url: 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/demo.jpg?kg_media_token=token',
      label: 'airvio_.JPEG',
      sourceKey: 'sha256:demo',
    })
    if (!inserted) throw new Error('expected FloatingPanel Media invoke to insert into the active card field')

    const latest = committedValues.at(-1) || ''
    if (!latest.includes('Review source evidence.\n![airvio_.JPEG](https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/demo.jpg?kg_media_token=token)')) {
      throw new Error(`expected external Media invoke to append image markdown to Action field, got ${latest}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCommandMenuMediaPanelActionInvokesActiveCardField() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(React.Fragment, null,
          React.createElement(CardInlineTextEditor, {
            value: 'Review source evidence.',
            ariaLabel: 'Action text',
            placeholder: 'Add action',
            canEdit: true,
            multiline: true,
            rows: 3,
            onCommit: value => committedValues.push(value),
          }),
          React.createElement(CommandMenuCatalogPanel),
        ),
      )
      await waitForFrames(dom.window, 8)
    })

    const display = container.querySelector('[data-kg-card-inline-edit="1"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected active card display field')

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true }))
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 4)
    })

    const imageAction = container.querySelector('[data-kg-command-menu-media-action="insert-image"]')
    if (!(imageAction instanceof dom.window.HTMLElement)) throw new Error('expected FloatingPanel Media image action row')

    await act(async () => {
      imageAction.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 2)
    })

    const latest = committedValues.at(-1) || ''
    if (!latest.includes('Review source evidence.\n![Image](image-url)')) {
      throw new Error(`expected FloatingPanel Media image action to insert into active Action field, got ${latest}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCommandMenuMediaPanelPointerDownInvokesBeforeBlurClick() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(React.Fragment, null,
          React.createElement(CardInlineTextEditor, {
            value: 'Review source evidence.',
            ariaLabel: 'Action text',
            placeholder: 'Add action',
            canEdit: true,
            multiline: true,
            rows: 3,
            onCommit: value => committedValues.push(value),
          }),
          React.createElement(CommandMenuCatalogPanel),
        ),
      )
      await waitForFrames(dom.window, 8)
    })

    const display = container.querySelector('[data-kg-card-inline-edit="1"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected active card display field')

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 1)
    })

    const imageAction = container.querySelector('[data-kg-command-menu-media-action="insert-image"]')
    if (!(imageAction instanceof dom.window.HTMLElement)) throw new Error('expected FloatingPanel Media image action row')

    await act(async () => {
      imageAction.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 2)
    })

    const latest = committedValues.at(-1) || ''
    if (!latest.includes('Review source evidence.\n![Image](image-url)')) {
      throw new Error(`expected FloatingPanel Media pointer-down invoke to insert before blur/click cleanup, got ${latest}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCommandMenuMediaPanelUploadedNameInvokesActiveCardField() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  const storageKey = 'knowgrph:floating-panel-media:uploaded-cloudflare-items:v1'
  const mediaUrl = 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg'

  try {
    dom.window.localStorage.setItem(storageKey, JSON.stringify([{
      id: 'cloudflare-media:sha256:uploaded-demo',
      name: 'airvio-demo.jpg',
      kind: 'image',
      localUrl: '',
      linkUrl: mediaUrl,
      contentType: 'image/jpeg',
      sizeBytes: 1024,
      status: 'synced',
      storage: {
        workspaceId: 'airvio',
        runId: 'upload-demo',
        stageId: 'image',
        shotId: 'airvio-demo',
        objectKey: 'airvio/runs/upload-demo/image/airvio-demo.jpg',
        publicPath: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
        publicUrl: mediaUrl,
        accessUrl: `${mediaUrl}?kg_media_token=test`,
        contentHash: 'sha256:uploaded-demo',
        contentType: 'image/jpeg',
        provenance: { fileName: 'airvio-demo.jpg', sizeBytes: 1024 },
        response: {
          ok: true,
          apiVersion: 'knowgrph.storage.v1',
          workspaceId: 'airvio',
          artifactId: 'upload-demo:image:airvio-demo',
          objectKey: 'airvio/runs/upload-demo/image/airvio-demo.jpg',
          publicPath: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
          durableR2Url: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
          contentHash: 'sha256:uploaded-demo',
          storage: { r2: 'confirmed', d1: 'persisted', kv: 'skipped', durableObject: 'skipped' },
          access: { cacheKey: null, expiresAtMs: null, url: `${mediaUrl}?kg_media_token=test` },
        },
      },
      error: null,
    }]))

    await act(async () => {
      root.render(
        React.createElement(React.Fragment, null,
          React.createElement(CardInlineTextEditor, {
            value: 'Review source evidence.',
            ariaLabel: 'Action text',
            placeholder: 'Add action',
            canEdit: true,
            multiline: true,
            rows: 3,
            onCommit: value => committedValues.push(value),
          }),
          React.createElement(CommandMenuCatalogPanel),
        ),
      )
      await waitForFrames(dom.window, 8)
    })

    const display = container.querySelector('[data-kg-card-inline-edit="1"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected active card display field')

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 1)
    })

    const mediaName = container.querySelector('[data-kg-media-upload-name-text="cloudflare-media:sha256:uploaded-demo"]')
    if (!(mediaName instanceof dom.window.HTMLElement)) throw new Error('expected uploaded media name text to be the primary insert target')
    const renameButton = container.querySelector('[data-kg-media-upload-rename="cloudflare-media:sha256:uploaded-demo"]')
    if (!(renameButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected uploaded media rename to stay an explicit row control')

    await act(async () => {
      mediaName.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 2)
    })

    const latest = committedValues.at(-1) || ''
    if (!latest.includes('Review source evidence.\n![airvio-demo.jpg](https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg?kg_media_token=')) {
      throw new Error(`expected uploaded Media name click to insert Cloudflare image into active Action field, got ${latest}`)
    }
  } finally {
    dom.window.localStorage.removeItem(storageKey)
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorSelectionOverridesStaleMediaTarget() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const actionValues: string[] = []
  const dialogueValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(React.Fragment, null,
          React.createElement(CardInlineTextEditor, {
            value: 'Review the source evidence into editable storyboard elements.',
            ariaLabel: 'Action',
            placeholder: 'Add action',
            canEdit: true,
            editActivation: 'click',
            multiline: true,
            rows: 3,
            onCommit: value => actionValues.push(value),
          }),
          React.createElement(CardInlineTextEditor, {
            value: 'Existing dialogue',
            ariaLabel: 'Dialogue',
            placeholder: 'Add dialogue',
            canEdit: true,
            editActivation: 'click',
            multiline: true,
            rows: 3,
            onCommit: value => dialogueValues.push(value),
          }),
        ),
      )
      await waitForFrames(dom.window, 8)
    })

    const actionDisplay = container.querySelector('[aria-label="Action"][data-kg-card-inline-edit="1"]')
    const dialogueDisplay = container.querySelector('[aria-label="Dialogue"][data-kg-card-inline-edit="1"]')
    if (!(actionDisplay instanceof dom.window.HTMLElement)) throw new Error('expected Action display field')
    if (!(dialogueDisplay instanceof dom.window.HTMLElement)) throw new Error('expected Dialogue display field')

    await act(async () => {
      dialogueDisplay.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      dialogueDisplay.dispatchEvent(new dom.window.MouseEvent('pointerup', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 1)
    })

    const range = dom.window.document.createRange()
    range.selectNodeContents(actionDisplay)
    const selection = dom.window.document.getSelection()
    if (!selection) throw new Error('expected browser selection')
    selection.removeAllRanges()
    selection.addRange(range)

    const inserted = insertMediaIntoActiveCardInlineTextEditor({
      kind: 'image',
      url: 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/action-target.jpg?kg_media_token=token',
      label: 'action-target.jpg',
      sourceKey: 'sha256:action-target',
    })
    if (!inserted) throw new Error('expected selected Action display field to accept Media insertion')

    const latestAction = actionValues.at(-1) || ''
    if (!latestAction.includes('Review the source evidence into editable storyboard elements.\n![action-target.jpg](https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/action-target.jpg?kg_media_token=token)')) {
      throw new Error(`expected selected Action field to receive media insertion, got ${latestAction}`)
    }
    if (dialogueValues.length !== 0) {
      throw new Error(`expected stale Dialogue target not to receive selected Action media insertion, got ${JSON.stringify(dialogueValues)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorMultilineRowsFollowViewDensity() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  const readOpenedTextareaRows = async (fieldLineMode: 'single' | 'double') => {
    await act(async () => {
      setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'compact', fieldLineMode })
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Review element cards, revise prompts, then send the approved sequence to video generation.',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          rows: 3,
          onCommit: () => void 0,
        }),
      )
      await waitForFrames(dom.window, 4)
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected shared card editor display surface')

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 4)
    })

    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected multiline action textarea')
    const rows = textarea.rows
    const className = textarea.className

    await act(async () => {
      textarea.dispatchEvent(new dom.window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 4)
    })

    return { rows, className }
  }

  try {
    const single = await readOpenedTextareaRows('single')
    if (single.rows !== 1 || !single.className.includes('min-h-8')) {
      throw new Error(`expected single-line View density to open card textarea with one row, got rows=${single.rows} class=${single.className}`)
    }

    const double = await readOpenedTextareaRows('double')
    if (double.rows !== 2 || !double.className.includes('min-h-12') || !double.className.includes('resize-y')) {
      throw new Error(`expected two-line View density to open card textarea with two rows, got rows=${double.rows} class=${double.className}`)
    }
    if (double.className.split(/\s+/).includes('resize')) {
      throw new Error(`expected card textarea resizing to keep width fixed with resize-y, got class=${double.className}`)
    }
  } finally {
    setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'comfortable', fieldLineMode: 'single' })
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorDisplaySurfaceFollowsViewDensity() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  const readDisplayClassName = async (fieldLineMode: 'single' | 'double') => {
    await act(async () => {
      setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'compact', fieldLineMode })
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Review element cards, revise prompts, then send the approved sequence to video generation.',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          rows: 3,
          displayClassName: 'm-0 mt-1 text-xs leading-5 whitespace-pre-wrap break-words',
          onCommit: () => void 0,
        }),
      )
      await waitForFrames(dom.window, 4)
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected shared card editor display surface')
    return display.className
  }

  try {
    const singleClassName = await readDisplayClassName('single')
    if (!singleClassName.includes('truncate')) {
      throw new Error(`expected single-line View density to clamp card display surface to one line, got class=${singleClassName}`)
    }

    const doubleClassName = await readDisplayClassName('double')
    if (!doubleClassName.includes('line-clamp-2')) {
      throw new Error(`expected two-line View density to clamp card display surface to two lines, got class=${doubleClassName}`)
    }
    if (doubleClassName.split(/\s+/).includes('block')) {
      throw new Error(`expected two-line card display surface to avoid block display overriding line-clamp-2, got class=${doubleClassName}`)
    }
  } finally {
    setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'comfortable', fieldLineMode: 'single' })
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testFlowEditorInlineValueEditorReusesDensityAwareCardSurfaceAndTextarea() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'compact', fieldLineMode: 'double' })
      root.render(
        React.createElement(FlowEditorInlineValueEditor, {
          id: 'flow-widget-value',
          value: 'Widget output should reuse the shared card surface and textarea density controls.',
          active: true,
          ariaLabel: 'Widget value',
          multiline: true,
          rows: 6,
          className: 'h-6 whitespace-pre-wrap break-words',
          onCommit: () => void 0,
        }),
      )
      await waitForFrames(dom.window, 4)
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected Flow Editor widget value display to reuse CardInlineTextEditor')
    if (!display.className.includes('line-clamp-2')) {
      throw new Error(`expected Flow Editor widget display surface to reuse two-line field density, got class=${display.className}`)
    }
    if (display.className.split(/\s+/).includes('block')) {
      throw new Error(`expected Flow Editor widget display surface to avoid block overriding line-clamp-2, got class=${display.className}`)
    }
    if (display.className.includes('h-6')) {
      throw new Error(`expected Flow Editor widget display surface to ignore single-line/editor sizing classes, got class=${display.className}`)
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 4)
    })

    const textarea = container.querySelector('textarea[aria-label="Widget value"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected Flow Editor widget value to open a shared textarea')
    if (textarea.rows !== 2 || !textarea.className.includes('min-h-12') || !textarea.className.includes('resize-y')) {
      throw new Error(`expected Flow Editor widget textarea to use two-line panel density instead of caller rows, got rows=${textarea.rows} class=${textarea.className}`)
    }
    if (textarea.className.split(/\s+/).includes('resize')) {
      throw new Error(`expected Flow Editor widget textarea resizing to keep width fixed with resize-y, got class=${textarea.className}`)
    }
  } finally {
    setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'comfortable', fieldLineMode: 'single' })
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorCanPropagateActivationClick() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let parentClicks = 0

  try {
    await act(async () => {
      root.render(
        React.createElement('section', {
          onClick: () => {
            parentClicks += 1
          },
        }, React.createElement(CardInlineTextEditor, {
          value: 'Metric target',
          ariaLabel: 'Metric target',
          placeholder: 'Add target',
          canEdit: true,
          editActivation: 'click',
          stopActivationPropagation: false,
          onCommit: () => void 0,
        })),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected shared card inline editor to expose the click activation marker')
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (parentClicks !== 1) {
      throw new Error(`expected shared inline editor to allow activation click propagation when requested, got ${parentClicks}`)
    }
    const input = container.querySelector('input[aria-label="Metric target"]')
    if (!(input instanceof dom.window.HTMLInputElement)) {
      throw new Error('expected propagated activation click to still open the editable input')
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorMarkdownCommandMenusApplySlashAndVariableActions() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Widget panel text',
          ariaLabel: 'Widget text',
          placeholder: 'Add text',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          markdownCommandContextText: [
            'imageUrl: "https://media.example.test/poster.jpg"',
            'videoUrl: "https://www.youtube.com/watch?v=demoVideoId"',
          ].join('\n'),
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected shared card editor display surface')
    }
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Widget text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected multiline card editor textarea')
    }
    const slashButton = container.querySelector('button[title="Slash commands"]')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    const keywordButton = container.querySelector('button[title="Keyword commands"]')
    if (!(slashButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected slash command launcher')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')
    if (!(keywordButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected keyword command launcher')

    await act(async () => {
      slashButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      slashButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const slashInput = dom.window.document.querySelector('input[placeholder="Type a command"]')
    if (!(slashInput instanceof dom.window.HTMLInputElement)) throw new Error('expected slash command search input')
    const checklistButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card slash commands"] button')) as HTMLButtonElement[]).find(
      el => String(el.textContent || '').includes('Checklist'),
    )
    if (!(checklistButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected Checklist slash command')
    await act(async () => {
      checklistButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      checklistButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!textarea.value.includes('- [ ] Widget panel text')) {
      throw new Error(`expected slash command to transform widget panel text into a checklist item, got ${JSON.stringify(textarea.value)}`)
    }

    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const variableInput = dom.window.document.querySelector('input[placeholder="Find variable or action"]')
    if (!(variableInput instanceof dom.window.HTMLInputElement)) throw new Error('expected variable command search input')
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
    if (!setter) throw new Error('expected input value setter')
    await act(async () => {
      setter.call(variableInput, 'venue')
      Simulate.change(variableInput)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const insertReferenceButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[]).find(
      el => String(el.textContent || '').includes('Insert reference'),
    )
    if (!(insertReferenceButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected Insert reference variable command')
    await act(async () => {
      insertReferenceButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      insertReferenceButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!textarea.value.includes('{{venue}}')) {
      throw new Error(`expected variable command to insert markdown variable token, got ${JSON.stringify(textarea.value)}`)
    }
    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      keywordButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      keywordButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const keywordInput = dom.window.document.querySelector('input[placeholder="Find keyword"]')
    if (!(keywordInput instanceof dom.window.HTMLInputElement)) throw new Error('expected keyword command search input')
    await act(async () => {
      setter.call(keywordInput, 'story')
      Simulate.change(keywordInput)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const storyboardKeywordButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card keyword commands"] button')) as HTMLButtonElement[]).find(
      el => String(el.textContent || '').includes('Storyboard'),
    )
    if (!(storyboardKeywordButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected Storyboard keyword command')
    await act(async () => {
      storyboardKeywordButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      storyboardKeywordButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!textarea.value.includes('#storyboard')) {
      throw new Error(`expected keyword command to insert #storyboard token, got ${JSON.stringify(textarea.value)}`)
    }
    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const imageInsertButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[]).find(
      el => String(el.textContent || '').includes('Image: imageUrl') && String(el.textContent || '').includes('https://media.example.test/poster.jpg'),
    )
    if (!(imageInsertButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected Image @ media insertion command with resolved URL')
    const imageThumbnail = imageInsertButton.querySelector('[data-kg-inline-command-thumbnail="image"] img')
    if (!(imageThumbnail instanceof dom.window.HTMLImageElement)) throw new Error('expected Image @ media insertion command to show a thumbnail')
    if (imageThumbnail.getAttribute('src') !== 'https://media.example.test/poster.jpg') {
      throw new Error(`expected Image @ media thumbnail to use the resolved image URL, got ${JSON.stringify(imageThumbnail.getAttribute('src'))}`)
    }
    await act(async () => {
      imageInsertButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      imageInsertButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!textarea.value.includes('](https://media.example.test/poster.jpg)')) {
      throw new Error(`expected @ Image command to insert resolved image embed, got ${JSON.stringify(textarea.value)}`)
    }
    if (!committedValues.some(value => value.includes('](https://media.example.test/poster.jpg)'))) {
      throw new Error(`expected @ Image command to persist the resolved image embed immediately, got ${JSON.stringify(committedValues)}`)
    }
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const activeTextareaAfterImageInsert = container.querySelector('textarea[aria-label="Widget text"]')
    if (activeTextareaAfterImageInsert) {
      throw new Error('expected persisted @ Image insertion to close the editor so the saved thumbnail preview can render')
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorVideoCommandPersistsPosterThumbnail() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Send approved sequence to video generation.',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          markdownCommandContextText: 'videoUrl: "https://www.youtube.com/watch?v=demoVideoId"',
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected shared card editor display surface')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected multiline action textarea')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')

    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const videoInsertButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[]).find(
      el => el.id === 'Card variable commands-insert-video' && String(el.textContent || '').includes('https://www.youtube.com/watch?v=demoVideoId'),
    )
    if (!(videoInsertButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected generic Video @ media insertion command to resolve the contextual URL')
    const videoThumbnail = videoInsertButton.querySelector('[data-kg-inline-command-thumbnail="video"] img')
    if (!(videoThumbnail instanceof dom.window.HTMLImageElement)) throw new Error('expected Video @ media insertion command to show a thumbnail')
    if (videoThumbnail.getAttribute('src') !== 'https://i.ytimg.com/vi/demoVideoId/hqdefault.jpg') {
      throw new Error(`expected Video @ media thumbnail to use derived poster URL, got ${JSON.stringify(videoThumbnail.getAttribute('src'))}`)
    }

    await act(async () => {
      Simulate.blur(textarea, { relatedTarget: null })
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    if (!dom.window.document.querySelector('#Card\\ variable\\ commands-insert-video')) {
      throw new Error('expected @ Video command menu to stay open across null relatedTarget blur')
    }

    await act(async () => {
      videoInsertButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      videoInsertButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const persisted = committedValues.find(value => value.includes('<video'))
    if (!persisted) throw new Error(`expected @ Video command to persist a video embed, got ${JSON.stringify(committedValues)}`)
    if (!persisted.includes('poster="https://i.ytimg.com/vi/demoVideoId/hqdefault.jpg"')) {
      throw new Error(`expected persisted @ Video embed to include a poster thumbnail, got ${JSON.stringify(persisted)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorGenericMediaPlaceholderStaysEditable() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Inline media placeholder',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          onCommit: () => {},
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected shared card editor display surface')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected multiline action textarea')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')

    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const imageInsertButton = dom.window.document.querySelector('#Card\\ variable\\ commands-insert-image')
    if (!(imageInsertButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected generic Image @ media insertion command')

    await act(async () => {
      imageInsertButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      imageInsertButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const activeTextarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(activeTextarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected unresolved @ Image insertion to stay in the inline text box')
    }
    if (!activeTextarea.value.includes('![Image alt](image-url)')) {
      throw new Error(`expected unresolved @ Image insertion to add an editable markdown placeholder, got ${JSON.stringify(activeTextarea.value)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorAtCommandInsertsUploadedMedia() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  const publicUrl = 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg'
  const accessUrl = `${publicUrl}?kg_media_token=token`
  const storage = {
    workspaceId: 'airvio',
    runId: 'upload-demo',
    stageId: 'image',
    shotId: 'airvio-demo',
    objectKey: 'airvio/runs/upload-demo/image/airvio-demo.jpg',
    publicPath: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
    publicUrl,
    accessUrl,
    contentHash: 'sha256:uploaded-at-command-demo',
    contentType: 'image/jpeg',
    provenance: {
      fileName: 'airvio_.JPEG',
      sizeBytes: 1234,
    },
    response: {
      ok: true,
      apiVersion: 1,
      workspaceId: 'airvio',
      artifactId: 'upload-demo:image:airvio-demo',
      objectKey: 'airvio/runs/upload-demo/image/airvio-demo.jpg',
      publicPath: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
      durableR2Url: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
      contentHash: 'sha256:uploaded-at-command-demo',
      storage: { r2: 'confirmed', d1: 'persisted', kv: 'skipped', durableObject: 'skipped' },
      access: { cacheKey: null, expiresAtMs: null, url: accessUrl },
    },
  }

  try {
    dom.window.localStorage.setItem(UPLOADED_MEDIA_PANEL_STORAGE_KEY, JSON.stringify([{
      id: 'cloudflare-media:sha256:uploaded-at-command-demo',
      name: 'airvio_.JPEG',
      kind: 'image',
      localUrl: '',
      linkUrl: accessUrl,
      contentType: 'image/jpeg',
      sizeBytes: 1234,
      status: 'synced',
      storage,
      error: null,
    }]))

    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Review the source evidence into editable storyboard elements.',
          ariaLabel: 'Action',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await waitForFrames(dom.window, 4)
    })

    const display = container.querySelector('[aria-label="Action"][data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected Action display field')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 1)
    })

    const textarea = container.querySelector('textarea[aria-label="Action"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected active Action textarea')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')

    await act(async () => {
      textarea.setSelectionRange(0, 0)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await waitForFrames(dom.window, 4)
    })

    const mediaButtons = Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[]
    const uploadMediaButton = mediaButtons.find(button => String(button.textContent || '').includes('Upload Media') && String(button.textContent || '').includes('Upload image, audio, or video through the shared Media storage flow'))
    if (!(uploadMediaButton instanceof dom.window.HTMLButtonElement)) {
      const buttonText = mediaButtons.map(button => String(button.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')
      throw new Error(`expected @ command menu to include shared Upload Media action, got ${buttonText}`)
    }
    const uploadedMediaButton = mediaButtons.find(button => String(button.textContent || '').includes('airvio_.JPEG') && String(button.textContent || '').includes('Uploaded media from Cloudflare storage'))
    if (!(uploadedMediaButton instanceof dom.window.HTMLButtonElement)) {
      const buttonText = mediaButtons.map(button => String(button.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')
      throw new Error(`expected @ command menu to include uploaded FloatingPanel Media item, got ${buttonText}`)
    }

    await act(async () => {
      uploadedMediaButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      uploadedMediaButton.click()
      await waitForFrames(dom.window, 2)
    })

    const latest = committedValues.at(-1) || ''
    if (!latest.startsWith('![airvio_.JPEG](https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg?kg_media_token=')) {
      throw new Error(`expected @ command media insertion to commit uploaded image into Action field, got ${JSON.stringify(committedValues)}`)
    }
    if (!latest.includes(')\n\nReview the source evidence into editable storyboard elements.')) {
      throw new Error(`expected @ command media insertion to keep media as its own block before existing Action text, got ${JSON.stringify(latest)}`)
    }
  } finally {
    dom.window.localStorage.removeItem(UPLOADED_MEDIA_PANEL_STORAGE_KEY)
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorAtCommandSkipsDuplicateUploadedMedia() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  const publicUrl = 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg'
  const accessUrl = `${publicUrl}?kg_media_token=token`
  const initialValue = [
    `![airvio_.JPEG](${accessUrl})`,
    '',
    'Review the source evidence into editable storyboard elements.',
  ].join('\n')

  try {
    dom.window.localStorage.setItem(UPLOADED_MEDIA_PANEL_STORAGE_KEY, JSON.stringify([{
      id: 'cloudflare-media:sha256:uploaded-at-command-demo',
      name: 'airvio_.JPEG',
      kind: 'image',
      localUrl: '',
      linkUrl: accessUrl,
      contentType: 'image/jpeg',
      sizeBytes: 1234,
      status: 'synced',
      storage: {
        workspaceId: 'airvio',
        runId: 'upload-demo',
        stageId: 'image',
        shotId: 'airvio-demo',
        objectKey: 'airvio/runs/upload-demo/image/airvio-demo.jpg',
        publicPath: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
        publicUrl,
        accessUrl,
        contentHash: 'sha256:uploaded-at-command-demo',
        contentType: 'image/jpeg',
        provenance: { fileName: 'airvio_.JPEG', sizeBytes: 1234 },
        response: {
          ok: true,
          apiVersion: 1,
          workspaceId: 'airvio',
          artifactId: 'upload-demo:image:airvio-demo',
          objectKey: 'airvio/runs/upload-demo/image/airvio-demo.jpg',
          publicPath: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
          durableR2Url: '/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg',
          contentHash: 'sha256:uploaded-at-command-demo',
          storage: { r2: 'confirmed', d1: 'persisted', kv: 'skipped', durableObject: 'skipped' },
          access: { cacheKey: null, expiresAtMs: null, url: accessUrl },
        },
      },
      error: null,
    }]))

    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: initialValue,
          ariaLabel: 'Action',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await waitForFrames(dom.window, 4)
    })

    const display = container.querySelector('[aria-label="Action"][data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected Action display field')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 1)
    })

    const textarea = container.querySelector('textarea[aria-label="Action"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected active Action textarea')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')

    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await waitForFrames(dom.window, 4)
    })

    const uploadedMediaButton = (Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[])
      .find(button => String(button.textContent || '').includes('airvio_.JPEG'))
    if (!(uploadedMediaButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected uploaded Media item in @ command menu')

    await act(async () => {
      uploadedMediaButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      uploadedMediaButton.click()
      await waitForFrames(dom.window, 2)
    })

    if (committedValues.length !== 0) {
      throw new Error(`expected duplicate @ media insertion to no-op without mutating Action text, got ${JSON.stringify(committedValues)}`)
    }
  } finally {
    dom.window.localStorage.removeItem(UPLOADED_MEDIA_PANEL_STORAGE_KEY)
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorMediaCommandsUseSharedCommandMenuRenameDraft() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const renamedUrl = 'https://www.youtube.com/watch?v=commandMenuRenameDraft'
  const committedValues: string[] = []

  try {
    writeCommandMenuMediaNameDraft(renamedUrl, 'sd1')
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Review storyboard media',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          markdownPreview: 'auto',
          markdownCommandContextText: `videoUrl: "${renamedUrl}"`,
          onCommit: next => {
            committedValues.push(next)
          },
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected shared card editor display surface')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected multiline action textarea')
    const variableButton = container.querySelector('button[title="Variable commands"]')
    if (!(variableButton instanceof dom.window.HTMLButtonElement)) throw new Error('expected variable command launcher')

    await act(async () => {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length)
      variableButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      variableButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const mediaButtons = Array.from(dom.window.document.querySelectorAll('section[aria-label="Card variable commands"] button')) as HTMLButtonElement[]
    const renamedMediaButton = mediaButtons.find(button => String(button.textContent || '').includes('sd1') && String(button.textContent || '').includes(renamedUrl))
    if (!(renamedMediaButton instanceof dom.window.HTMLButtonElement)) {
      const buttonText = mediaButtons.map(button => String(button.textContent || '').replace(/\s+/g, ' ').trim()).join(' | ')
      throw new Error(`expected @ media dropdown to use shared Command Menu rename draft, got ${buttonText}`)
    }
    await act(async () => {
      renamedMediaButton.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true }))
      renamedMediaButton.click()
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    const persisted = committedValues.find(value => value.includes('<video'))
    if (!persisted || !persisted.includes('title="sd1"')) {
      throw new Error(`expected @ media insertion to persist the shared media name as the video label, got ${JSON.stringify(committedValues)}`)
    }
  } finally {
    writeCommandMenuMediaNameDraft(renamedUrl, '')
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardMarkdownPreviewInlineVideoChipKeepsParagraphFlow() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(React.Fragment, null, renderSafeHtmlBlock(
          'Review source <video src="https://example.com/demo.mp4" title="sd123" controls></video> evidence into editable storyboard elements.',
          {
            activeDocumentPath: 'workspace:/card.md',
            uiPanelTextFontClass: 'font-sans',
            uiPanelMonospaceTextClass: 'font-mono',
            markdownPresentationMode: false,
            markdownCardPreviewMode: true,
            renderNodeText: (text, key) => React.createElement(React.Fragment, { key }, text),
            fragmentOptions: null,
          },
        )),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const chip = container.querySelector('[data-kg-card-inline-media-pill="1"]')
    if (!(chip instanceof dom.window.HTMLElement)) {
      throw new Error(`expected inline video chip in card preview, html=${container.innerHTML}`)
    }
    if (!chip.className.includes('mr-1') || !chip.className.includes('items-center') || !chip.className.includes('align-middle') || !chip.className.includes('text-[11px]')) {
      throw new Error(`expected inline video chip to use centered spacing classes, got ${chip.className}`)
    }
    const stackWrapper = chip.closest('.space-y-1')
    if (stackWrapper) {
      throw new Error(`expected inline media chip to avoid vertical stack wrapper inside card paragraph, html=${container.innerHTML}`)
    }
    const text = String(container.textContent || '').replace(/\s+/g, ' ').trim()
    if (text !== 'Review source sd123 evidence into editable storyboard elements.') {
      throw new Error(`expected inline media chip to remain spaced inside paragraph text flow, got ${JSON.stringify(text)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardMarkdownPreviewStandaloneMediaDoesNotMutateProse() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardMarkdownPreview, {
          markdownText: [
            'Review the source evidence into editable storyboard elements.',
            '',
            '![airvio_.JPEG](https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg?kg_media_token=token)',
          ].join('\n'),
          activeDocumentPath: '/__card_inline_text_editor/preview.md',
        }),
      )
      await waitForFrames(dom.window, 8)
    })

    const previewRoot = container.querySelector('[data-kg-card-markdown-preview="1"]')
    if (!(previewRoot instanceof dom.window.HTMLElement)) throw new Error(`expected card markdown preview root, html=${container.innerHTML}`)
    const attachments = previewRoot.querySelector('[data-kg-card-markdown-preview-attachments="1"]')
    if (attachments) throw new Error(`expected standalone media to remain inline, not render in a separate attachment strip, html=${container.innerHTML}`)
    const inlineChip = previewRoot.querySelector('[data-kg-card-inline-media-pill="1"]')
    if (!(inlineChip instanceof dom.window.HTMLElement)) throw new Error(`expected uploaded media chip inline in the card text run, html=${container.innerHTML}`)
    if (!String(inlineChip.textContent || '').includes('airvio_.JPEG')) {
      throw new Error(`expected inline media chip to preserve media label, got ${JSON.stringify(inlineChip.textContent)}`)
    }
    const rootText = String(previewRoot.textContent || '').replace(/\s+/g, ' ').trim()
    const chipText = String(inlineChip.textContent || '').replace(/\s+/g, ' ').trim()
    const proseText = rootText.replace(chipText, '').replace(/\s+/g, ' ').trim()
    if (proseText !== 'Review the source evidence into editable storyboard elements.') {
      throw new Error(`expected card prose preview to keep text typography separate from media label, got ${JSON.stringify({ rootText, chipText, proseText })}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardMarkdownPreviewBoundaryMediaDoesNotMutateProseTypography() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardMarkdownPreview, {
          markdownText: '![airvio_.JPEG](https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg?kg_media_token=token) Review the source evidence into editable storyboard elements.',
          activeDocumentPath: '/__card_inline_text_editor/preview.md',
          className: 'm-0 mt-1 text-xs leading-5 text-[color:var(--kg-text-secondary)]',
        }),
      )
      await waitForFrames(dom.window, 8)
    })

    const previewRoot = container.querySelector('[data-kg-card-markdown-preview="1"]')
    if (!(previewRoot instanceof dom.window.HTMLElement)) throw new Error(`expected card markdown preview root, html=${container.innerHTML}`)
    const attachments = previewRoot.querySelector('[data-kg-card-markdown-preview-attachments="1"]')
    if (attachments) throw new Error(`expected boundary media to remain inline, not render in a separate attachment strip, html=${container.innerHTML}`)
    const inlineChip = previewRoot.querySelector('[data-kg-card-inline-media-pill="1"]')
    if (!(inlineChip instanceof dom.window.HTMLElement)) throw new Error(`expected boundary media to render as an inline chip, html=${container.innerHTML}`)
    const proseText = String(previewRoot.textContent || '')
      .replace(String(inlineChip.textContent || ''), '')
      .replace(/\s+/g, ' ')
      .trim()
    if (proseText !== 'Review the source evidence into editable storyboard elements.') {
      throw new Error(`expected boundary media to leave prose text unchanged, got ${JSON.stringify(proseText)}`)
    }
    const markdownParagraph = previewRoot.querySelector('article p, .prose p')
    if (markdownParagraph) {
      throw new Error(`expected boundary-media prose to avoid markdown paragraph typography, html=${container.innerHTML}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardMarkdownPreviewInlineImageDoesNotMutateProseTypography() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardMarkdownPreview, {
          markdownText: 'Review the ![airvio_.JPEG](https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/airvio-demo.jpg?kg_media_token=token) #image source evidence into editable storyboard elements.',
          activeDocumentPath: '/__card_inline_text_editor/preview.md',
          className: 'm-0 mt-1 text-xs leading-5 text-[color:var(--kg-text-secondary)]',
        }),
      )
      await waitForFrames(dom.window, 8)
    })

    const previewRoot = container.querySelector('[data-kg-card-markdown-preview="1"]')
    if (!(previewRoot instanceof dom.window.HTMLElement)) throw new Error(`expected card markdown preview root, html=${container.innerHTML}`)
    const attachments = previewRoot.querySelector('[data-kg-card-markdown-preview-attachments="1"]')
    if (attachments) throw new Error(`expected inline image media to remain inline, not render in a separate attachment strip, html=${container.innerHTML}`)
    const inlineChip = previewRoot.querySelector('[data-kg-card-inline-media-pill="1"]')
    if (!(inlineChip instanceof dom.window.HTMLElement)) throw new Error(`expected inline image media to render as an inline chip, html=${container.innerHTML}`)
    if (!inlineChip.className.includes('[font-size:inherit]') || !inlineChip.className.includes('[line-height:inherit]')) {
      throw new Error(`expected inline image media chip to inherit surrounding card preview text metrics, got ${inlineChip.className}`)
    }
    for (const staleClass of ['text-[11px]', 'leading-4', 'align-middle', 'gap-1', 'px-2']) {
      if (inlineChip.className.includes(staleClass)) {
        throw new Error(`expected inline image media chip to avoid stale card preview spacing or text metrics ${staleClass}, got ${inlineChip.className}`)
      }
    }
    for (const expectedClass of ['align-baseline', 'gap-0.5', 'pl-1', 'pr-1.5', 'py-0']) {
      if (!inlineChip.className.includes(expectedClass)) {
        throw new Error(`expected inline image media chip to keep compact baseline-aligned spacing ${expectedClass}, got ${inlineChip.className}`)
      }
    }
    const keywordChip = previewRoot.querySelector('[data-kg-card-inline-keyword-pill="1"]')
    if (!(keywordChip instanceof dom.window.HTMLElement)) throw new Error(`expected #keyword token to reuse the shared inline chip renderer in card preview text, html=${container.innerHTML}`)
    if (String(keywordChip.textContent || '').trim() !== 'image') {
      throw new Error(`expected #image chip to preserve readable keyword text, got ${JSON.stringify(keywordChip.textContent)}`)
    }
    for (const expectedClass of DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME.split(' ')) {
      if (expectedClass && !keywordChip.className.includes(expectedClass)) {
        throw new Error(`expected card preview #keyword chip to reuse DataView inline-text chip class ${expectedClass}, got ${keywordChip.className}`)
      }
    }
    if (keywordChip.className.includes('text-[10px]') || keywordChip.className.includes('leading-[15px]')) {
      throw new Error(`expected card preview #keyword chip to inherit surrounding text metrics, got ${keywordChip.className}`)
    }
    const proseText = String(previewRoot.textContent || '')
      .replace(String(inlineChip.textContent || ''), '')
      .replace(String(keywordChip.textContent || ''), '')
      .replace(/\s+/g, ' ')
      .trim()
    if (proseText !== 'Review the source evidence into editable storyboard elements.') {
      throw new Error(`expected inline image media to leave prose typography text unchanged, got ${JSON.stringify(proseText)}`)
    }
    const markdownParagraph = previewRoot.querySelector('article p, .prose p')
    if (markdownParagraph) {
      throw new Error(`expected inline image media to avoid markdown paragraph typography, html=${container.innerHTML}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorKeywordTokenUsesInlineChipDisplay() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: '#storyboard #180kb',
          ariaLabel: 'Output text',
          placeholder: 'Add output',
          canEdit: true,
          editActivation: 'click',
          multiline: true,
          markdownPreview: 'auto',
          onCommit: () => void 0,
        }),
      )
      await waitForFrames(dom.window, 8)
    })

    const chips = Array.from(container.querySelectorAll<HTMLElement>('[data-kg-card-inline-keyword-pill="1"]'))
    const chip = chips[0]
    if (!(chip instanceof dom.window.HTMLElement)) {
      throw new Error(`expected #keyword token to render as inline chip on the shared card display path, html=${container.innerHTML}`)
    }
    const numericChip = chips.find(candidate => String(candidate.textContent || '').trim() === '180kb')
    if (!(numericChip instanceof dom.window.HTMLElement)) {
      throw new Error(`expected numeric-leading #keyword token to render as the same inline chip path, html=${container.innerHTML}`)
    }
    for (const expectedClass of DATA_VIEW_CHIP_ROW_CLASSNAME.split(' ')) {
      if (expectedClass && !chip.className.includes(expectedClass)) {
        throw new Error(`expected inline keyword chip to reuse DataView chip class ${expectedClass}, got ${chip.className}`)
      }
    }
    if (!DATA_VIEW_CHIP_ROW_CLASSNAME.includes('leading-[15px]')) {
      throw new Error(`expected shared DataView chip utility to own fixed # tag line-height, got ${DATA_VIEW_CHIP_ROW_CLASSNAME}`)
    }
    for (const expectedClass of resolveDataViewChipClass('storyboard').split(' ')) {
      if (expectedClass && !chip.className.includes(expectedClass)) {
        throw new Error(`expected inline keyword chip to reuse storyboard chip tone class ${expectedClass}, got ${chip.className}`)
      }
    }
    if (chip.className.includes('rounded-full')) {
      throw new Error(`expected inline keyword chip to restore rectangular chip radius, got ${chip.className}`)
    }
    const text = String(container.textContent || '').replace(/\s+/g, ' ').trim()
    if (text !== 'storyboard 180kb') {
      throw new Error(`expected inline keyword chip preview to preserve token text, got ${JSON.stringify(text)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorMarkdownPreviewOneClickReopensDefaultEditor() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)

  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Review evidence 123 ![image](https://media.example.test/poster.jpg)',
          ariaLabel: 'Action text',
          placeholder: 'Add action',
          canEdit: true,
          multiline: true,
          markdownPreview: 'auto',
          onCommit: () => {},
        }),
      )
      await new Promise(resolve => setTimeout(resolve, 0))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="doubleClick"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected shared card editor display surface to preserve default double-click activation')
    }
    const previewRoot = container.querySelector('[data-kg-card-markdown-preview="1"]')
    if (!(previewRoot instanceof dom.window.HTMLElement)) {
      throw new Error('expected markdown preview read surface to render inside the shared card editor display')
    }
    const previewImage = previewRoot.querySelector('img[data-kg-media-thumbnail="1"]')
    if (!(previewImage instanceof dom.window.HTMLImageElement)) {
      throw new Error('expected markdown preview media thumbnail to render inside the shared card editor display')
    }

    await act(async () => {
      previewRoot.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, detail: 1 }))
      previewRoot.dispatchEvent(new dom.window.MouseEvent('mousedown', { bubbles: true, cancelable: true, detail: 1 }))
      previewRoot.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    if (!(textarea instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected one click on the markdown preview read surface to reopen the default shared inline editor')
    }
    if (!textarea.value.includes('![image](https://media.example.test/poster.jpg)')) {
      throw new Error(`expected reopened editor to preserve the inserted image markdown, got ${JSON.stringify(textarea.value)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testFlowEditorInlineValueEditorFirstInactiveClickCommits() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  let committed = ''
  let parentClicks = 0
  let parentPointerDowns = 0

  function Harness() {
    const [active, setActive] = React.useState(false)
    return React.createElement('section', {
      onPointerDown: () => {
        parentPointerDowns += 1
      },
      onClick: () => {
        parentClicks += 1
        setActive(true)
      },
    }, React.createElement(FlowEditorInlineValueEditor, {
      id: 'flow-editor-first-click-value',
      value: '50',
      active,
      ariaLabel: 'Metric target',
      onCommit: next => {
        committed = next
      },
    }))
  }

  try {
    await act(async () => {
      root.render(React.createElement(Harness))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    if (!(display instanceof dom.window.HTMLElement)) {
      throw new Error('expected Flow Editor Value cell to render the shared click-activated inline editor')
    }

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await new Promise(resolve => setTimeout(resolve, 0))
    })

    if (parentPointerDowns !== 0) {
      throw new Error(`expected first inactive Flow Editor value pointer-down to stay local and avoid workspace/indexing activation, got ${parentPointerDowns}`)
    }
    if (parentClicks !== 0) {
      throw new Error(`expected first inactive Flow Editor value click to stay local and avoid workspace/indexing activation, got ${parentClicks}`)
    }

    const input = container.querySelector('input[aria-label="Metric target"]')
    if (!(input instanceof dom.window.HTMLInputElement)) {
      throw new Error('expected first inactive Flow Editor value click to open the shared editable input')
    }
    const setter = Object.getOwnPropertyDescriptor(dom.window.HTMLInputElement.prototype, 'value')?.set
    if (!setter) throw new Error('expected input value setter')

    await act(async () => {
      setter.call(input, '77')
      Simulate.change(input)
      await new Promise(resolve => setTimeout(resolve, 0))
    })
    await act(async () => {
      Simulate.keyDown(input, { key: 'Enter' })
    })

    if (committed !== '77') {
      throw new Error(`expected first Flow Editor inline edit value to commit without requiring a second click, got ${JSON.stringify(committed)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
