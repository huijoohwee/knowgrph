import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import type { TokensTable } from '@/features/markdown/ui/MarkdownTokens'
import {
  appendMarkdownDataViewRow,
  buildMarkdownDataViewFromTableToken,
  updateMarkdownDataViewCell,
} from '@/features/markdown/ui/markdownDataViewModel'
import { serializeMarkdownDataViewToTableLines } from '@/features/markdown/ui/markdownDataViewSerialize'
import { replaceMarkdownLineRange } from 'grph-shared/markdown/lineEditing'

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

