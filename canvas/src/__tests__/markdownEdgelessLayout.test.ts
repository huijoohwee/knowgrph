import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'
import { deriveMarkdownDesignLayout } from '@/features/markdown-edgeless/markdownDesignLayout'

export function testMarkdownEdgelessLayoutDerivesBlocksWithStableIds() {
  const markdown = [
    '# Getting Started',
    '',
    'Hello world',
    '',
    '- [ ] First task',
    '- [x] Second task',
    '',
    '```ts',
    'const x = 1',
    '```',
    '',
    '> quoted line one',
    '> quoted line two',
    '',
    '| Status | Owner |',
    '| --- | --- |',
    '| Todo | Alice |',
  ].join('\n')

  const { tokens } = lexMarkdown(markdown)
  const layout = deriveMarkdownDesignLayout({
    activeDocumentPath: 'mem://doc.md',
    markdownTokensKey: 'k',
    tokens,
  })

  if (!layout.blocks.length) throw new Error('expected blocks to be derived')
  const ids = new Set(layout.blocks.map(b => b.id))
  if (ids.size !== layout.blocks.length) throw new Error('expected block ids to be unique')

  const hasTable = layout.blocks.some(b => b.type === 'table' && b.title === 'Table')
  if (!hasTable) throw new Error('expected table block to be present with title "Table"')

  const list = layout.blocks.find(b => b.type === 'list')
  if (!list) throw new Error('expected list block to be present')
  if (list.preview.kind !== 'list') throw new Error('expected list preview kind')
  const items = list.preview.listItems || []
  if (items.length < 2) throw new Error('expected list preview items')
  if (!items[0]?.task) throw new Error('expected first list item to be task')

  const code = layout.blocks.find(b => b.type === 'code')
  if (!code) throw new Error('expected code block to be present')
  if (code.preview.kind !== 'code') throw new Error('expected code preview kind')
  const lang = code.preview.code?.lang || ''
  if (lang !== 'ts') throw new Error(`expected code lang=ts, got ${lang}`)

  const quote = layout.blocks.find(b => b.type === 'blockquote')
  if (!quote) throw new Error('expected blockquote block to be present')
  if (quote.preview.kind !== 'blockquote') throw new Error('expected blockquote preview kind')
  const qLines = quote.preview.blockquote?.lines || []
  if (qLines.length < 2) throw new Error('expected blockquote preview lines')
}
