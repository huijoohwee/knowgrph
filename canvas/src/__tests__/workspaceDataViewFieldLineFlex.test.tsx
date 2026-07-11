import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import {
  coerceWorkspaceDataViewConfig,
} from '@/features/markdown-workspace/main/viewer/workspaceDataViewConfig'
import {
  readStructuredSourceDataViewPresentation,
  readStructuredSourceFieldLineMode,
} from '@/features/markdown-workspace/main/viewer/workspaceStructuredSourceDataViewPresentation'
import {
  MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT,
  MarkdownDataViewTableView,
} from '@/features/markdown/ui/MarkdownDataViewTableView'
import type { MarkdownDataView } from '@/features/markdown/ui/markdownDataViewModel'
import {
  DATA_VIEW_FIELD_LINE_OPTIONS,
  coerceDataViewFieldLineMode,
  readDataViewFieldLineClassName,
  readDataViewFieldLineLabel,
  readDataViewMultiLineControlRows,
} from '@/lib/ui/dataViewDensity'
import { readMarkdownDataViewTableCellDisplayText } from '@/features/markdown/ui/markdownDataViewCellPreview'
import { CardInlineTextEditor } from '@/lib/cards/CardInlineTextEditor'
import { setWorkspaceDataViewFloatingDensity } from '@/features/markdown-workspace/main/viewer/workspaceDataViewFloatingStore'
import { initJsdomHarness } from '@/tests/lib/jsdomHarness'
import { waitForFrames } from '@/tests/lib/reactRootHarness'

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message)
}

const buildView = (value: string): MarkdownDataView => ({
  columns: [
    { id: 'title', name: 'Title', kind: 'text' },
    { id: 'summary', name: 'Summary', kind: 'text' },
  ],
  rows: [{ id: 'row-1', cells: ['Card', value] }],
  titleColumnId: 'title',
  groupByColumnId: null,
})

export function testWorkspaceDataViewFieldLineFlexSharedDensityModel() {
  const flexOption = DATA_VIEW_FIELD_LINE_OPTIONS.find(option => option.value === 'flex')
  assert(flexOption?.label === 'Flex', 'expected View density field-line options to expose Flex')
  assert(coerceDataViewFieldLineMode('flex') === 'flex', 'expected shared field-line coercer to preserve Flex')
  assert(readStructuredSourceFieldLineMode('flex') === 'flex', 'expected structured-source presentation to preserve Flex')
  assert(readDataViewFieldLineLabel('flex') === 'Flex', 'expected shared field-line label to render Flex')
  assert(readDataViewMultiLineControlRows('flex') === 0, 'expected Flex textareas to preserve layout-supplied rows')

  const className = readDataViewFieldLineClassName('flex')
  assert(className.includes('whitespace-pre-wrap') && className.includes('break-words'), `expected Flex class to wrap content, got ${className}`)
  assert(!className.includes('truncate') && !className.includes('line-clamp'), `expected Flex class to avoid clamp classes, got ${className}`)

  const longValue = `${'auto-sized preview '.repeat(8)}tail-marker`
  assert(longValue.length > MARKDOWN_DATA_VIEW_TABLE_CELL_PREVIEW_CHAR_LIMIT, 'expected long test value to exceed preview limit')
  assert(readMarkdownDataViewTableCellDisplayText(longValue, 'single') !== longValue, 'expected Single line table display to keep preview truncation')
  assert(readMarkdownDataViewTableCellDisplayText(longValue, 'flex') === longValue, 'expected Flex table display to keep full text')

  const viewConfig = coerceWorkspaceDataViewConfig({
    v: 2,
    id: 'v-flex',
    name: 'Flex',
    layout: 'table',
    groupByColumnId: null,
    visibleColumnIds: null,
    columnTypesById: null,
    filterGroups: [{ id: 'g0', rules: [] }],
    sortRules: [],
    rowHeightPreset: 'comfortable',
    fieldLineMode: 'flex',
  })
  assert(viewConfig, 'expected Flex view config to coerce')
  const presentation = readStructuredSourceDataViewPresentation(buildView('value'), viewConfig)
  assert(presentation.fieldLineMode === 'flex', 'expected structured-source presentation to carry Flex into renderer props')
}

export async function testWorkspaceDataViewFieldLineFlexTableRendersFullText() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const container = dom.window.document.getElementById('root')
  if (!container) throw new Error('missing root container')
  const root = createRoot(container)
  const longValue = `${'layout-sized content '.repeat(8)}tail-marker-flex`
  try {
    await act(async () => {
      root.render(
        <MarkdownDataViewTableView
          view={buildView(longValue)}
          canMutate={false}
          onUpdateCell={() => void 0}
          fieldLineMode="flex"
        />,
      )
      await waitForFrames(dom.window, 4)
    })
    const valueElement = container.querySelector('.kg-data-view-table-value')
    assert(valueElement instanceof dom.window.HTMLElement, 'expected rendered table value element')
    assert(String(container.textContent || '').includes('tail-marker-flex'), 'expected Flex table view to render full long text')
    assert(valueElement.className.includes('whitespace-pre-wrap') && valueElement.className.includes('break-words'), `expected Flex table value to wrap by layout, got ${valueElement.className}`)
    assert(!valueElement.className.includes('truncate') && !valueElement.className.includes('line-clamp'), `expected Flex table value to avoid line clamps, got ${valueElement.className}`)
  } finally {
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}

export async function testWorkspaceDataViewFieldLineFlexInlineEditorUsesLayoutRows() {
  const { restore, dom } = initJsdomHarness('<!doctype html><html><body><section id="root"></section></body></html>')
  const container = dom.window.document.getElementById('root')
  if (!container) throw new Error('missing root container')
  const root = createRoot(container)
  try {
    await act(async () => {
      setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'compact', fieldLineMode: 'flex' })
      root.render(
        <CardInlineTextEditor
          value="Review element cards, revise prompts, then send the approved sequence to video generation."
          ariaLabel="Action text"
          placeholder="Add action"
          canEdit
          editActivation="click"
          editorSurface="control"
          multiline
          rows={4}
          displayClassName="line-clamp-4 truncate whitespace-pre-wrap break-words"
          onCommit={() => void 0}
        />,
      )
      await waitForFrames(dom.window, 4)
    })
    const display = container.querySelector('[data-kg-card-inline-edit-activation="click"]')
    assert(display instanceof dom.window.HTMLElement, 'expected shared card editor display surface')
    assert(display.className.includes('whitespace-pre-wrap') && display.className.includes('break-words'), `expected Flex display surface to wrap, got ${display.className}`)
    assert(!display.className.includes('truncate') && !display.className.includes('line-clamp'), `expected Flex display surface to avoid line clamps, got ${display.className}`)

    await act(async () => {
      display.dispatchEvent(new dom.window.MouseEvent('click', { bubbles: true, cancelable: true }))
      await waitForFrames(dom.window, 4)
    })
    const textarea = container.querySelector('textarea[aria-label="Action text"]')
    assert(textarea instanceof dom.window.HTMLTextAreaElement, 'expected multiline action textarea')
    assert(textarea.rows === 4, `expected Flex textarea to keep layout rows, got ${textarea.rows}`)
    assert(textarea.className.includes('min-h-8') && textarea.className.includes('resize-y'), `expected Flex textarea to keep density chrome, got ${textarea.className}`)
  } finally {
    setWorkspaceDataViewFloatingDensity({ rowHeightPreset: 'comfortable', fieldLineMode: 'single' })
    await act(async () => {
      root.unmount()
    })
    restore()
  }
}
