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

export async function testCardInlineTextEditorViewerSurfaceRendersInvocationAndMediaChips() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  const leakedAttachmentToken = '@strybldr-s.tarter-source-017d1e965528642f.png'
  const attachmentLabel = 'strybldr-starter-source-017d1e965528642f.png'
  const longAttachmentLabel = 'knowgrph-agentic-video-canvas-demo-image-source-consistent-keyframes-7fa233b6799880b4.png'
  const longAttachmentToken = `@${longAttachmentLabel}`
  const sourceText = [
    `I can ...#storyboard ${leakedAttachmentToken} ${longAttachmentToken} ../source.normalize#media @canvas, is it better in#storyboard`,
    '![Strybldr starter source](https://airvio.co/api/storage/media/airvio/runs/storyboard/source.png)',
  ].join(' ')
  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: sourceText,
          displayValue: `I can ... #storyboard ${leakedAttachmentToken} ${longAttachmentToken} .. /source.normalize #media @canvas`,
          ariaLabel: 'Summary for workspace-source',
          placeholder: 'Add summary',
          canEdit: true,
          editActivation: 'click',
          editorSurface: 'viewer',
          inlineChipDensity: 'compact',
          multiline: true,
          markdownPreview: 'auto',
          displayClassName: 'm-0 h-full min-h-0 select-none overflow-auto whitespace-pre-wrap break-words text-[10px] font-medium leading-4 text-[color:var(--kg-text-secondary)] [scrollbar-gutter:stable]',
          editorClassName: 'h-full min-h-[3rem] overflow-auto text-[10px] font-medium leading-4 text-[color:var(--kg-text-primary)] [scrollbar-gutter:stable]',
          projectedMediaAttachments: [
            {
              mediaKind: 'image',
              label: attachmentLabel,
              sourceUrl: 'https://airvio.co/api/storage/media/airvio/runs/storyboard/attached.png',
              thumbnailUrl: 'https://airvio.co/api/storage/media/airvio/runs/storyboard/attached-thumb.png',
            },
            {
              mediaKind: 'image',
              label: longAttachmentLabel,
              sourceUrl: 'https://airvio.co/api/storage/media/airvio/runs/storyboard/long-attached.png',
              thumbnailUrl: 'https://airvio.co/api/storage/media/airvio/runs/storyboard/long-attached-thumb.png',
            },
          ],
          rows: 2,
          onCommit: value => committedValues.push(value),
        }),
      )
      await waitForFrames(dom.window, 8)
    })
    const display = container.querySelector('[aria-label="Summary for workspace-source"][data-kg-card-inline-edit="1"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected card summary display surface')
    if (display.getAttribute('data-kg-card-inline-chip-density') !== 'compact') {
      throw new Error(`expected compact Storyboard card display to keep inline chips on surrounding text metrics, html=${display.outerHTML}`)
    }
    const readMediaChip = display.querySelector('[data-kg-card-inline-display-media-chip="1"]') as HTMLElement | null
    if (!(readMediaChip instanceof dom.window.HTMLElement) || readMediaChip.textContent !== `@${attachmentLabel}`) {
      throw new Error(`expected read-mode Card textarea to render source-authored @ media in-place, html=${display.innerHTML}`)
    }
    const longReadMediaChip = Array.from(display.querySelectorAll('[data-kg-card-inline-display-media-chip="1"]') as NodeListOf<HTMLElement>)
      .find(node => node.textContent === longAttachmentToken)
    if (!(longReadMediaChip instanceof dom.window.HTMLElement)) {
      throw new Error(`expected read-mode Card textarea to keep a generated long-form @ media reference visible as a chip before editing, html=${display.innerHTML}`)
    }
    const readDisplayText = String(display.textContent || '')
    const readStoryboardIndex = readDisplayText.indexOf('#storyboard')
    const readMediaIndex = readDisplayText.indexOf(`@${attachmentLabel}`)
    const readSlashIndex = readDisplayText.indexOf('/source.normalize')
    if (!(readStoryboardIndex >= 0 && readMediaIndex > readStoryboardIndex && readSlashIndex > readMediaIndex)) {
      throw new Error(`expected read-mode source-authored @ media chip to stay between #storyboard and /source.normalize, text=${JSON.stringify(readDisplayText)}`)
    }
    if (display.querySelector('[data-kg-card-inline-display-media-projection="1"]')) {
      throw new Error(`expected Card textarea not to append attachment-only media projection after authored text, html=${display.innerHTML}`)
    }
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 8)
    })
    const viewerEditor = container.querySelector('[data-kg-card-inline-viewer-edit-surface="1"][contenteditable="true"]')
    if (!(viewerEditor instanceof dom.window.HTMLElement)) {
      throw new Error(`expected card summary edit mode to mount the Viewer WYSIWYG contenteditable surface, html=${container.innerHTML}`)
    }
    if (viewerEditor.getAttribute('data-kg-card-inline-chip-density') !== 'compact') {
      throw new Error(`expected compact Storyboard card Viewer editor to keep inline chips on surrounding text metrics, html=${viewerEditor.outerHTML}`)
    }
    const viewerEditorClassName = viewerEditor.getAttribute('class') || ''
    if (!viewerEditorClassName.includes('bg-transparent') || viewerEditorClassName.includes('bg-[color:var(--kg-input-bg)]') || viewerEditorClassName.includes('rounded border')) {
      throw new Error(`expected Viewer card edit mode to reuse transparent Workspace Viewer edit chrome, got ${viewerEditorClassName}`)
    }
    for (const expectedClass of ['text-[10px]', 'leading-4', 'overflow-auto']) {
      if (!viewerEditorClassName.includes(expectedClass)) {
        throw new Error(`expected compact Viewer card edit mode to preserve caller-owned ${expectedClass}, got ${viewerEditorClassName}`)
      }
    }
    for (const staleClass of ['px-2', 'px-3', 'py-1', 'py-1.5', 'text-xs', 'min-h-8']) {
      if (viewerEditorClassName.includes(staleClass)) {
        throw new Error(`expected compact Viewer card edit mode not to append DataView control class ${staleClass}, got ${viewerEditorClassName}`)
      }
    }
    const visibleTextarea = container.querySelector('textarea[aria-label="Summary for workspace-source"]')
    if (visibleTextarea) {
      throw new Error('expected Viewer card edit mode to avoid reopening the legacy visible textarea surface')
    }
    const commandProxy = container.querySelector('[data-kg-card-inline-viewer-edit-command-proxy="1"]')
    if (!(commandProxy instanceof dom.window.HTMLTextAreaElement)) {
      throw new Error('expected Viewer card edit mode to keep a hidden command proxy')
    }
    if (!commandProxy.value.includes(leakedAttachmentToken)) {
      throw new Error(`expected Viewer card edit draft proxy to preserve source-authored @ media token position, got ${JSON.stringify(commandProxy.value)}`)
    }
    if (!commandProxy.value.includes('I can ...#storyboard')) {
      throw new Error(`expected Viewer card edit draft proxy to preserve read-view raw spacing before commit, got ${JSON.stringify(commandProxy.value)}`)
    }
    if (!commandProxy.value.includes('/source.normalize#media')) {
      throw new Error(`expected Viewer card edit draft proxy to preserve compact adjacent token source before commit, got ${JSON.stringify(commandProxy.value)}`)
    }
    if (!commandProxy.value.includes('in#storyboard')) {
      throw new Error(`expected Viewer card edit draft proxy to preserve compact word-keyword source before commit, got ${JSON.stringify(commandProxy.value)}`)
    }
    const invocationChips = Array.from(viewerEditor.querySelectorAll('[data-kg-inline-invocation-edit-token="1"]')) as HTMLElement[]
    for (const token of ['#storyboard', '/source.normalize', '#media', '@canvas']) {
      const chip = invocationChips.find(node => node.textContent === token)
      if (!chip) {
        throw new Error(`expected Viewer WYSIWYG card editor to render ${token} as a shared inline edit chip, html=${viewerEditor.innerHTML}`)
      }
      if (!chip.className.includes('kg-inline-chip-shell-15ch') || !chip.querySelector('.kg-inline-chip-label-15ch')) {
        throw new Error(`expected Viewer WYSIWYG ${token} edit chip to reuse the same 15ch label shell as read mode, html=${chip.outerHTML}`)
      }
    }
    const storyboardChipCount = invocationChips.filter(node => node.textContent === '#storyboard').length
    if (storyboardChipCount < 2) {
      throw new Error(`expected Viewer WYSIWYG card editor to chip both compact #storyboard occurrences, got ${storyboardChipCount}, html=${viewerEditor.innerHTML}`)
    }
    const leakedChip = Array.from(viewerEditor.querySelectorAll('[data-kg-inline-invocation-edit-token="1"]') as NodeListOf<HTMLElement>)
      .find(node => node.textContent === leakedAttachmentToken)
    if (leakedChip) {
      throw new Error(`expected projected attached-media display token not to mutate into an authored invocation chip, html=${viewerEditor.innerHTML}`)
    }
    if (!viewerEditor.querySelector('[data-kg-inline-media-edit-token="1"]')) {
      throw new Error(`expected markdown media to render as a Viewer inline media edit chip, html=${viewerEditor.innerHTML}`)
    }
    if (!viewerEditor.querySelector('[data-kg-card-inline-wysiwyg-virtual-media-chip="1"]')) {
      throw new Error(`expected projected attached media to render as a display-only Viewer edit chip, html=${viewerEditor.innerHTML}`)
    }
    const longEditorMediaChip = Array.from(viewerEditor.querySelectorAll('[data-kg-card-inline-wysiwyg-virtual-media-chip="1"]') as NodeListOf<HTMLElement>)
      .find(node => node.getAttribute('data-kg-card-inline-wysiwyg-media-markdown') === longAttachmentToken)
    if (!(longEditorMediaChip instanceof dom.window.HTMLElement)) {
      throw new Error(`expected the same generated long-form @ media chip to remain visible after entering edit mode, html=${viewerEditor.innerHTML}`)
    }
    const virtualMediaChip = viewerEditor.querySelector('[data-kg-card-inline-wysiwyg-virtual-media-chip="1"]') as HTMLElement | null
    if (!(virtualMediaChip instanceof dom.window.HTMLElement)) throw new Error(`expected projected media chip element, html=${viewerEditor.innerHTML}`)
    const editorDisplayText = String(viewerEditor.textContent || '')
    const storyboardDisplayIndex = editorDisplayText.indexOf('#storyboard')
    const mediaDisplayIndex = editorDisplayText.indexOf('@strybldr-starter-source-017d1e965528642f.png')
    const slashDisplayIndex = editorDisplayText.indexOf('/source.normalize')
    if (!(storyboardDisplayIndex >= 0 && mediaDisplayIndex > storyboardDisplayIndex && slashDisplayIndex > mediaDisplayIndex)) {
      throw new Error(`expected source-authored @ media chip to stay between #storyboard and /source.normalize instead of jumping to the end, text=${JSON.stringify(editorDisplayText)}`)
    }
    if (virtualMediaChip.getAttribute('data-kg-card-inline-wysiwyg-media-markdown') !== leakedAttachmentToken) {
      throw new Error(`expected source-authored @ media chip to serialize back to its token instead of becoming zero-length, html=${virtualMediaChip.outerHTML}`)
    }
    if (virtualMediaChip.getAttribute('data-kg-inline-markdown-zero-length-token') === '1') {
      throw new Error(`expected source-authored @ media chip to preserve text position, not become a display-only zero-length token, html=${virtualMediaChip.outerHTML}`)
    }
    const virtualMediaThumbnail = virtualMediaChip.querySelector('[data-kg-card-inline-wysiwyg-media-thumbnail="1"]') as HTMLElement | null
    if (!(virtualMediaThumbnail instanceof dom.window.HTMLElement) || virtualMediaThumbnail.hasAttribute('aria-hidden') || !virtualMediaThumbnail.getAttribute('aria-label')) {
      throw new Error(`expected Viewer edit projected @ media chip thumbnail to stay visible to selection tooling, html=${virtualMediaChip.outerHTML}`)
    }
    if (!virtualMediaChip.className.includes('inline-flex bg-[color:var(--kg-panel-bg)]') || !virtualMediaChip.className.includes('kg-inline-chip-shell-15ch')) {
      throw new Error(`expected Viewer edit projected @ media chip to reuse the read-view inline media chip shell, got ${virtualMediaChip.className}`)
    }
    if (virtualMediaChip.className.includes('ml-1')) {
      throw new Error(`expected Viewer edit projected @ media chip to avoid wider-than-view left margin, got ${virtualMediaChip.className}`)
    }
    await act(async () => {
      viewerEditor.append(dom.window.document.createTextNode(' updated'))
      Simulate.input(viewerEditor)
      await waitForFrames(dom.window, 4)
      Simulate.blur(viewerEditor)
      await waitForFrames(dom.window, 4)
    })
    const latest = committedValues.at(-1) || ''
    if (!latest.endsWith(' updated')) {
      throw new Error(`expected Viewer WYSIWYG card edit to commit text edits, got ${JSON.stringify(latest)}`)
    }
    if (!latest.includes('![Strybldr starter source](https://airvio.co/api/storage/media/airvio/runs/storyboard/source.png)')) {
      throw new Error(`expected Viewer WYSIWYG card edit to commit from raw source value, not the read-view display projection, got ${JSON.stringify(latest)}`)
    }
    if (!latest.includes('/source.normalize#media') || latest.includes('/source.normalize #media')) {
      throw new Error(`expected Viewer WYSIWYG card edit to preserve compact adjacent invocation spacing, got ${JSON.stringify(latest)}`)
    }
    if (!latest.includes('I can ...#storyboard') || !latest.includes('../source.normalize#media') || latest.includes('I can ... #storyboard') || latest.includes('.. /source.normalize')) {
      throw new Error(`expected Viewer WYSIWYG card edit to preserve authored punctuation-to-token spacing, got ${JSON.stringify(latest)}`)
    }
    if (!latest.includes('in#storyboard') || latest.includes('in #storyboard')) {
      throw new Error(`expected Viewer WYSIWYG card edit to preserve authored word-keyword spacing, got ${JSON.stringify(latest)}`)
    }
    if (!latest.includes(leakedAttachmentToken)) {
      throw new Error(`expected source-authored attached-media @ token to stay at its authored position after edit, got ${JSON.stringify(latest)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorViewerSurfaceKeepsChipCaretOffsetsStable() {
  const { dom, restore } = initJsdomHarness()
  const {
    MarkdownInlineTextEditSurface,
    focusMarkdownInlineTextSelectionSoon,
    buildMarkdownInlineTextEditHtml,
    deleteMarkdownInlineTextAtomicMediaToken,
  } = await import('@/lib/markdown-core/ui/MarkdownInlineTextEditSurface')
  const {
    INLINE_MARKDOWN_ZERO_LENGTH_TOKEN_ATTR,
    getInlineMediaEditorMarkdownSelectionOffsets,
  } = await import('@/lib/markdown-core/ui/markdownBlockContainerCore.inlineMediaEditHtml')
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const directProbe = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(directProbe)
  const root = createRoot(container)
  const editorRef = React.createRef<HTMLElement>()
  const proxyRef = React.createRef<HTMLTextAreaElement>()
  const committedValues: string[] = []
  const mediaAttachments = [{
    mediaKind: 'image' as const,
    label: 'strybldr-starter-source-017d1e965528642f.png',
    sourceUrl: 'https://airvio.co/api/storage/media/airvio/runs/storyboard/attached.png',
    thumbnailUrl: 'https://airvio.co/api/storage/media/airvio/runs/storyboard/attached-thumb.png',
  }]
  const initialValue = 'I and\n![buddydrone.jpg](https://airvio.co/api/storage/media/airvio/runs/storyboard/buddydrone.jpg)\ncan see that #storyboard is as interesting as /cost.audit'
  const nextValue = 'I can ... #storyboard /soul.load ..'
  const nextCursor = nextValue.indexOf('/soul.load') + '/soul.load'.length
  let setHarnessValue: ((next: string) => void) | null = null
  function Harness() {
    const [value, setValue] = React.useState(initialValue)
    setHarnessValue = setValue
    return React.createElement(MarkdownInlineTextEditSurface, {
      value,
      ariaLabel: 'Summary for workspace-source',
      placeholder: 'Add summary',
      commandMode: null,
      editorRef,
      inputProxyRef: proxyRef,
      inlineChipDensity: 'compact',
      projectedMediaAttachments: mediaAttachments,
      isCommandMenuTarget: () => false,
      onCancel: () => void 0,
      onCommit: value => committedValues.push(value),
      onDraftChange: setValue,
      onFocus: () => void 0,
      onOpenCommandMenuForSigilAtSelection: () => void 0,
      readCommandSigilFromKeyEvent: () => null,
      readCommandSigilFromInsertedText: () => null,
      cardInlineEditInputAttribute: 'data-test-card-inline-input',
    })
  }
  try {
    await act(async () => {
      root.render(React.createElement(Harness))
      await waitForFrames(dom.window, 8)
    })
    const editor = editorRef.current
    if (!editor) throw new Error('expected Viewer edit surface')
    if (editor.querySelector('[data-kg-card-inline-wysiwyg-virtual-media-chip="1"]')) {
      throw new Error(`expected attachment-only media not to be appended into Viewer edit text without an authored @ token, html=${editor.innerHTML}`)
    }
    if (editor.querySelector('br')) {
      throw new Error(`expected compact Viewer edit surface to flatten media-adjacent source line breaks, html=${editor.innerHTML}`)
    }
    await act(async () => {
      Simulate.blur(editor, { relatedTarget: null })
      await waitForFrames(dom.window, 4)
    })
    if (committedValues.at(-1) !== initialValue) {
      throw new Error(`expected no-op compact Viewer blur to preserve raw source line breaks, got ${JSON.stringify(committedValues)}`)
    }
    await act(async () => {
      focusMarkdownInlineTextSelectionSoon(editorRef, nextCursor, nextCursor)
      setHarnessValue?.(nextValue)
    })
    await act(async () => {
      await waitForFrames(dom.window, 10)
    })
    const offsets = getInlineMediaEditorMarkdownSelectionOffsets(editorRef.current)
    if (!offsets || offsets.startOffset !== nextCursor || offsets.endOffset !== nextCursor) {
      throw new Error(`expected /, #, @ chip re-render to preserve command caret at ${nextCursor}, got ${JSON.stringify(offsets)}`)
    }
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: nextValue,
      projectedMediaAttachments: mediaAttachments,
    })
    const directText = String(directProbe.textContent || '').replace(/\s+/g, ' ').trim()
    if (directText.includes('@strybldr-starter-source-017d1e965528642f.png')) {
      throw new Error(`expected attachment-only @ media chip not to be appended into card edit text, text=${JSON.stringify(directText)}`)
    }
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: 'I and\n![buddydrone.jpg](https://airvio.co/api/storage/media/airvio/runs/storyboard/buddydrone.jpg)\ncan see that #storyboard is as interesting as /cost.audit\n',
      inlineChipDensity: 'compact',
      projectedMediaAttachments: mediaAttachments,
    })
    if (directProbe.querySelector('br')) {
      throw new Error(`expected compact Viewer card edit HTML to flatten media-adjacent soft line breaks, html=${directProbe.innerHTML}`)
    }
    if (String(directProbe.textContent || '').replace(/\s+/g, ' ').trim() !== 'I and buddydrone.jpg can see that #storyboard is as interesting as /cost.audit') {
      throw new Error(`expected compact Viewer card edit text to keep media, /, and # inline, html=${directProbe.innerHTML}`)
    }
    const authoredMediaValue = `I can ... #storyboard @strybldr-starter-source-017d1e965528642f.png /soul.load ..`
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: authoredMediaValue,
      projectedMediaAttachments: mediaAttachments,
    })
    const authoredMediaChip = directProbe.querySelector('[data-kg-card-inline-wysiwyg-virtual-media-chip="1"]') as HTMLElement | null
    if (!(authoredMediaChip instanceof dom.window.HTMLElement)) {
      throw new Error(`expected authored @ media token to render as in-place Viewer media chip, html=${directProbe.innerHTML}`)
    }
    if (authoredMediaChip.getAttribute('data-kg-card-inline-wysiwyg-media-markdown') !== '@strybldr-starter-source-017d1e965528642f.png') {
      throw new Error(`expected authored @ media chip to serialize as its source token, html=${authoredMediaChip.outerHTML}`)
    }
    if (authoredMediaChip.getAttribute(INLINE_MARKDOWN_ZERO_LENGTH_TOKEN_ATTR) === '1') {
      throw new Error(`expected authored @ media chip not to be zero-length, html=${authoredMediaChip.outerHTML}`)
    }
    const authoredMediaThumbnail = authoredMediaChip.querySelector('[data-kg-card-inline-wysiwyg-media-thumbnail="1"]') as HTMLElement | null
    if (!(authoredMediaThumbnail instanceof dom.window.HTMLElement) || authoredMediaThumbnail.hasAttribute('aria-hidden') || !authoredMediaThumbnail.getAttribute('aria-label')) {
      throw new Error(`expected authored @ media chip thumbnail to stay visible to selection tooling, html=${authoredMediaChip.outerHTML}`)
    }
    const secondaryAlbumToken = '@secondary-album-frame.png'
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: `Generate a text response for the active request. ${secondaryAlbumToken}`,
      projectedMediaAttachments: [
        ...mediaAttachments,
        {
          mediaKind: 'image',
          label: 'secondary-album-frame.png',
          sourceUrl: 'https://airvio.co/api/storage/media/airvio/runs/storyboard/secondary-album-frame.png',
          thumbnailUrl: 'https://airvio.co/api/storage/media/airvio/runs/storyboard/secondary-album-frame.png',
        },
      ],
    })
    const secondaryAlbumChip = directProbe.querySelector('[data-kg-card-inline-wysiwyg-virtual-media-chip="1"]') as HTMLElement | null
    if (!(secondaryAlbumChip instanceof dom.window.HTMLElement) || secondaryAlbumChip.getAttribute('data-kg-card-inline-wysiwyg-media-markdown') !== secondaryAlbumToken) {
      throw new Error(`expected a non-primary album @ token to remain a visible media chip after opening the editor, html=${directProbe.innerHTML}`)
    }
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: authoredMediaValue,
      projectedMediaAttachments: mediaAttachments,
    })
    const authoredMediaToken = '@strybldr-starter-source-017d1e965528642f.png'
    const authoredMediaTokenStart = authoredMediaValue.indexOf(authoredMediaToken)
    const authoredMediaTokenEnd = authoredMediaTokenStart + authoredMediaToken.length
    const forwardDeletion = deleteMarkdownInlineTextAtomicMediaToken({
      root: directProbe,
      value: authoredMediaValue,
      selection: { start: authoredMediaTokenStart, end: authoredMediaTokenStart },
      direction: 'forward',
    })
    if (forwardDeletion?.value !== authoredMediaValue.replace(authoredMediaToken, '')) {
      throw new Error(`expected Delete before an authored @ media chip to remove the complete token, got ${JSON.stringify(forwardDeletion)}`)
    }
    const trailingMediaValue = `Generate a text response for the active request. ${authoredMediaToken}`
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: trailingMediaValue,
      projectedMediaAttachments: mediaAttachments,
    })
    const trailingBackspaceDeletion = deleteMarkdownInlineTextAtomicMediaToken({
      root: directProbe,
      value: trailingMediaValue,
      selection: { start: trailingMediaValue.indexOf(authoredMediaToken) - 1, end: trailingMediaValue.indexOf(authoredMediaToken) - 1 },
      direction: 'backward',
    })
    if (trailingBackspaceDeletion?.value !== 'Generate a text response for the active request.') {
      throw new Error(`expected browser End boundary before a trailing @ media chip to delete the chip atomically, got ${JSON.stringify(trailingBackspaceDeletion)}`)
    }
    await act(async () => {
      setHarnessValue?.(authoredMediaValue)
      await waitForFrames(dom.window, 8)
    })
    await act(async () => {
      focusMarkdownInlineTextSelectionSoon(editorRef, authoredMediaTokenEnd)
      await waitForFrames(dom.window, 4)
    })
    await act(async () => {
      Simulate.keyDown(editor, { key: 'Backspace' })
      await waitForFrames(dom.window, 8)
    })
    const expectedValueAfterMediaDelete = authoredMediaValue.replace(authoredMediaToken, '')
    if (proxyRef.current?.value !== expectedValueAfterMediaDelete) {
      throw new Error(`expected Backspace after an authored @ media chip to publish its removal, got ${JSON.stringify(proxyRef.current?.value)}`)
    }
    if (editor.querySelector('[data-kg-card-inline-wysiwyg-virtual-media-chip="1"]')) {
      throw new Error(`expected removed @ media chip not to be projected back into the editor, html=${editor.innerHTML}`)
    }
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: 'Generate a text response for the active request.\n@空武.jpg',
      inlineChipDensity: 'compact',
      projectedMediaAttachments: [{
        mediaKind: 'image',
        label: '空武.jpg',
        sourceUrl: 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg',
        thumbnailUrl: 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg',
      }],
    })
    if (directProbe.querySelector('br')) {
      throw new Error(`expected compact Viewer edit surface to flatten Unicode @ media soft line breaks, html=${directProbe.innerHTML}`)
    }
    const unicodeAuthoredMediaChip = directProbe.querySelector('[data-kg-card-inline-wysiwyg-virtual-media-chip="1"]') as HTMLElement | null
    if (!(unicodeAuthoredMediaChip instanceof dom.window.HTMLElement) || unicodeAuthoredMediaChip.getAttribute('data-kg-card-inline-wysiwyg-media-markdown') !== '@空武.jpg') {
      throw new Error(`expected Unicode @ media token to render and serialize as authored Viewer media chip, html=${directProbe.innerHTML}`)
    }
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: 'Generate a text response for the active request.\n\n@空武.jpg',
      inlineChipDensity: 'compact',
      projectedMediaAttachments: [{
        mediaKind: 'image',
        label: '空武.jpg',
        sourceUrl: 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg',
        thumbnailUrl: 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg',
      }],
    })
    if (directProbe.querySelector('br')) {
      throw new Error(`expected compact Viewer edit surface to flatten blank-line Unicode @ media soft breaks, html=${directProbe.innerHTML}`)
    }
    directProbe.innerHTML = buildMarkdownInlineTextEditHtml({
      value: 'Generate a text response for the active request.\n\n![空武.jpg](https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg)',
      inlineChipDensity: 'compact',
      projectedMediaAttachments: [{
        mediaKind: 'image',
        label: '空武.jpg',
        sourceUrl: 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg',
        thumbnailUrl: 'https://airvio.co/api/storage/media/airvio/runs/upload-demo/image/%E7%A9%BA%E6%AD%A6.jpg',
      }],
    })
    if (directProbe.querySelector('br')) {
      throw new Error(`expected compact Viewer edit surface to flatten blank-line markdown media soft breaks, html=${directProbe.innerHTML}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorViewerSurfaceKeepsFocusedDomWhenRenderedDraftMatches() {
  const { dom, restore } = initJsdomHarness()
  const {
    MarkdownInlineTextEditSurface,
    buildMarkdownInlineTextEditHtml,
  } = await import('@/lib/markdown-core/ui/MarkdownInlineTextEditSurface')
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const editorRef = React.createRef<HTMLElement>()
  const proxyRef = React.createRef<HTMLTextAreaElement>()
  const committedValues: string[] = []
  const initialValue = 'can see #storyboard'
  const nextValue = 'can 123 see #storyboard'
  function Harness() {
    const [value, setValue] = React.useState(initialValue)
    return React.createElement(MarkdownInlineTextEditSurface, {
      value,
      ariaLabel: 'Summary for workspace-runtime',
      placeholder: 'Add summary',
      commandMode: null,
      editorRef,
      inputProxyRef: proxyRef,
      inlineChipDensity: 'compact',
      projectedMediaAttachments: null,
      isCommandMenuTarget: () => false,
      onCancel: () => void 0,
      onCommit: value => committedValues.push(value),
      onDraftChange: setValue,
      onFocus: () => void 0,
      onOpenCommandMenuForSigilAtSelection: () => void 0,
      readCommandSigilFromKeyEvent: () => null,
      readCommandSigilFromInsertedText: () => null,
      cardInlineEditInputAttribute: 'data-test-card-inline-input',
    })
  }
  const findFirstTextNode = (root: HTMLElement): Text | null => {
    const walker = root.ownerDocument.createTreeWalker(root, dom.window.NodeFilter.SHOW_TEXT)
    let node = walker.nextNode()
    while (node) {
      if (String(node.nodeValue || '').includes('can')) return node as Text
      node = walker.nextNode()
    }
    return null
  }
  try {
    await act(async () => {
      root.render(React.createElement(Harness))
      await waitForFrames(dom.window, 8)
    })
    const editor = editorRef.current
    if (!editor) throw new Error('expected Viewer edit surface')
    const firstTextNode = findFirstTextNode(editor)
    if (!firstTextNode) throw new Error(`expected editable text node before invocation chip, html=${editor.innerHTML}`)
    firstTextNode.nodeValue = 'can 123 see '
    const expectedHtml = buildMarkdownInlineTextEditHtml({ value: nextValue, inlineChipDensity: 'compact' })
    if (editor.innerHTML !== expectedHtml) {
      throw new Error(`expected browser DOM edit to match the rendered draft without needing a DOM rewrite, got ${editor.innerHTML}`)
    }
    await act(async () => {
      Simulate.input(editor)
      await waitForFrames(dom.window, 8)
    })
    if (findFirstTextNode(editor) !== firstTextNode) {
      throw new Error(`expected focused Viewer input render to keep the existing DOM text node when HTML already matches, html=${editor.innerHTML}`)
    }
    await act(async () => {
      Simulate.blur(editor, { relatedTarget: null })
      await waitForFrames(dom.window, 4)
    })
    if (committedValues.at(-1) !== nextValue) {
      throw new Error(`expected blur commit to preserve the latest typed draft, got ${JSON.stringify(committedValues)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testCardInlineTextEditorViewerSurfaceEditsSingleLineTitles() {
  const { dom, restore } = initJsdomHarness()
  const container = dom.window.document.createElement('section')
  dom.window.document.body.appendChild(container)
  const root = createRoot(container)
  const committedValues: string[] = []
  try {
    await act(async () => {
      root.render(
        React.createElement(CardInlineTextEditor, {
          value: 'Runtime Gate',
          ariaLabel: 'Storyboard title for workspace-runtime',
          placeholder: 'Add title',
          canEdit: true,
          editActivation: 'click',
          editorSurface: 'viewer',
          inlineChipDensity: 'compact',
          displayClassName: 'min-w-0 flex-1 truncate text-[12px] font-semibold leading-4 text-[color:var(--kg-text-primary)]',
          editorClassName: 'min-w-0 flex-1 truncate text-[12px] font-semibold leading-4 text-[color:var(--kg-text-primary)]',
          onCommit: value => committedValues.push(value),
        }),
      )
      await waitForFrames(dom.window, 4)
    })
    const display = container.querySelector('[aria-label="Storyboard title for workspace-runtime"][data-kg-card-inline-edit="1"]')
    if (!(display instanceof dom.window.HTMLElement)) throw new Error('expected Storyboard title display to use the shared card inline display surface')
    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }))
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }))
      await waitForFrames(dom.window, 8)
    })
    const viewerEditor = container.querySelector('[data-kg-card-inline-viewer-edit-surface="1"][contenteditable="true"]')
    if (!(viewerEditor instanceof dom.window.HTMLElement)) throw new Error(`expected title edit to open the shared Viewer contenteditable surface, html=${container.innerHTML}`)
    if (viewerEditor.getAttribute('aria-multiline') !== 'false') {
      throw new Error(`expected title Viewer edit surface to stay single-line, html=${viewerEditor.outerHTML}`)
    }
    if (container.querySelector('input[aria-label="Storyboard title for workspace-runtime"]')) {
      throw new Error('expected title edit not to reopen the legacy PanelTextInput surface')
    }
    const hiddenProxy = container.querySelector('[data-kg-card-inline-viewer-edit-command-proxy="1"]')
    if (!(hiddenProxy instanceof dom.window.HTMLTextAreaElement)) throw new Error('expected single-line Viewer title edit to keep the hidden command proxy')
    await act(async () => {
      viewerEditor.textContent = 'Runtime Gateway'
      Simulate.input(viewerEditor)
      Simulate.keyDown(viewerEditor, { key: 'Enter' })
      await waitForFrames(dom.window, 4)
    })
    if (committedValues.at(-1) !== 'Runtime Gateway') {
      throw new Error(`expected Enter to commit single-line Viewer title edits, got ${JSON.stringify(committedValues)}`)
    }
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
