import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import type { TokensTable } from '@/features/markdown/ui/MarkdownTokens'
import {
  appendMarkdownDataViewRow,
  buildMarkdownDataViewFromTableToken,
  deleteMarkdownDataViewColumn,
  duplicateMarkdownDataViewColumn,
  renameMarkdownDataViewColumn,
  updateMarkdownDataViewCell,
} from '@/features/markdown/ui/markdownDataViewModel'
import { serializeMarkdownDataViewToTableLines } from '@/features/markdown/ui/markdownDataViewSerialize'
import { duplicateMarkdownLineRange, replaceMarkdownLineRange } from 'grph-shared/markdown/lineEditing'

export function testMarkdownDataViewInfersGroupAndTitleColumns() {
  const markdown = [
    '| Status | Owner | Column | Tags |',
    '| --- | --- | --- | --- |',
    '| Try the Edgeless Canvas | Done |  | A,C |',
    '| Observe what AFFiNE can do | Doing |  | B |',
    '| Visit AFFiNE | Done |  | 1 |',
    '| Invite and collaborate | Todo |  | 2 |',
  ].join('\n')

  const { tokens } = lexMarkdown(markdown)
  const tableTok = tokens.find(t => t.type === 'table') as unknown as (TokensTable & { startLine: number; endLine: number }) | undefined
  if (!tableTok) throw new Error('expected a table token')

  const view = buildMarkdownDataViewFromTableToken(tableTok)
  if (!view) throw new Error('expected dataview to be inferred from table')
  if (view.groupByColumnId !== 'col_1') {
    throw new Error(`expected groupByColumnId=col_1, got ${String(view.groupByColumnId)}`)
  }
  if (view.titleColumnId !== 'col_0') {
    throw new Error(`expected titleColumnId=col_0, got ${String(view.titleColumnId)}`)
  }
}

export function testMarkdownDataViewEditsRoundTripToMarkdownTable() {
  const markdown = [
    '## Data-intensive blocks',
    '',
    '| Status | Owner | Column | Tags |',
    '| --- | --- | --- | --- |',
    '| Try the Edgeless Canvas | Done |  | A,C |',
    '| Observe what AFFiNE can do | Doing |  | B |',
    '| Visit AFFiNE | Done |  | 1 |',
    '| Invite and collaborate | Todo |  | 2 |',
    '',
    'Tail',
  ].join('\n')

  const { tokens } = lexMarkdown(markdown)
  const tableTok = tokens.find(t => t.type === 'table') as unknown as (TokensTable & { startLine: number; endLine: number }) | undefined
  if (!tableTok) throw new Error('expected a table token')

  const startLine = tableTok.startLine
  const endLine = tableTok.endLine
  const baseView = buildMarkdownDataViewFromTableToken(tableTok)
  if (!baseView) throw new Error('expected dataview to be inferred from table')

  const updated = updateMarkdownDataViewCell({
    view: baseView,
    rowId: 'row_3',
    columnId: baseView.groupByColumnId as string,
    nextValue: 'Done',
  })
  const withNewRow = appendMarkdownDataViewRow({ view: updated, seed: { [baseView.groupByColumnId as string]: 'Todo' } })

  const replacementLines = serializeMarkdownDataViewToTableLines(withNewRow)
  const next = replaceMarkdownLineRange({ markdownText: markdown, startLine, endLine, replacementLines })
  if (!next.includes('| Invite and collaborate | Done |')) {
    throw new Error('expected updated status written to markdown table')
  }
  if (!next.includes('|  | Todo |')) {
    throw new Error('expected new row appended to markdown table')
  }
}

export function testMarkdownDataViewColumnCrudRoundTripsToMarkdownTable() {
  const markdown = [
    '| Title | Status | Notes |',
    '| --- | --- | --- |',
    '| Cold Open | Draft | Merge overlapping requests before implementation. |',
    '| Reveal | Review | Same source stays in sync across surfaces. |',
  ].join('\n')

  const { tokens } = lexMarkdown(markdown)
  const tableTok = tokens.find(t => t.type === 'table') as unknown as (TokensTable & { startLine: number; endLine: number }) | undefined
  if (!tableTok) throw new Error('expected a table token')

  const baseView = buildMarkdownDataViewFromTableToken(tableTok)
  if (!baseView) throw new Error('expected dataview to be inferred from table')

  const duplicated = duplicateMarkdownDataViewColumn({
    view: baseView,
    columnId: 'col_2',
  })
  const duplicatedColumnId = duplicated.columns.find(column => !baseView.columns.some(existing => existing.id === column.id))?.id
  if (!duplicatedColumnId) {
    throw new Error('expected duplicate column id to be created')
  }

  const renamed = renameMarkdownDataViewColumn({
    view: duplicated,
    columnId: duplicatedColumnId,
    nextName: 'Storyboard Notes',
  })

  const deleted = deleteMarkdownDataViewColumn({
    view: renamed,
    columnId: 'col_1',
  })

  const replacementLines = serializeMarkdownDataViewToTableLines(deleted)
  const next = replaceMarkdownLineRange({
    markdownText: markdown,
    startLine: tableTok.startLine,
    endLine: tableTok.endLine,
    replacementLines,
  })

  if (!next.includes('| Title | Notes | Storyboard Notes |')) {
    throw new Error('expected renamed duplicate header written to markdown table')
  }
  if (next.includes('| Title | Status |')) {
    throw new Error('expected deleted column to be removed from markdown table output')
  }
  if (!next.includes('| Cold Open | Merge overlapping requests before implementation. | Merge overlapping requests before implementation. |')) {
    throw new Error('expected duplicated text values to persist in markdown table output')
  }
}

export function testDuplicateMarkdownLineRangeKeepsBlockSeparation() {
  const markdown = [
    '# Title',
    '',
    'Alpha paragraph.',
    '',
    'Tail paragraph.',
  ].join('\n')
  const duplicated = duplicateMarkdownLineRange({
    markdownText: markdown,
    startLine: 3,
    endLine: 3,
  })
  if (!duplicated.markdownText.includes('Alpha paragraph.\n\nAlpha paragraph.\n\nTail paragraph.')) {
    throw new Error(`expected duplicated markdown block to remain separated by blank lines, got ${JSON.stringify(duplicated.markdownText)}`)
  }
  if (duplicated.duplicatedStartLine !== 5 || duplicated.duplicatedEndLine !== 5) {
    throw new Error(`expected duplicated range to resolve to line 5, got ${duplicated.duplicatedStartLine}-${duplicated.duplicatedEndLine}`)
  }
}
