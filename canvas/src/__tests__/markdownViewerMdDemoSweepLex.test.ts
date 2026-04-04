import fs from 'node:fs'
import path from 'node:path'
import { lexMarkdown } from '@/features/markdown/ui/markdownPreviewLex'

export const testMarkdownViewerMdDemoSweepLexesAndHasLineRanges = () => {
  const demoPath = path.resolve(process.cwd(), '..', '..', 'sandbox', 'demo', 'md-demo-00.md')
  if (!fs.existsSync(demoPath)) {
    throw new Error(`missing demo markdown file: ${demoPath}`)
  }

  const text = fs.readFileSync(demoPath, { encoding: 'utf8' })
  const { tokens } = lexMarkdown(text)
  if (!Array.isArray(tokens) || tokens.length === 0) {
    throw new Error('expected md-demo-00.md to lex into non-empty tokens')
  }

  const types = new Set(tokens.map(t => String((t as unknown as { type?: unknown }).type || '')))
  for (const required of ['heading', 'paragraph', 'list', 'code', 'table', 'hr']) {
    if (!types.has(required)) {
      throw new Error(`expected md-demo-00.md tokens to include type: ${required}; got: ${Array.from(types).sort().join(', ')}`)
    }
  }
  if (!types.has('blockquote') && !types.has('callout')) {
    throw new Error(`expected md-demo-00.md tokens to include blockquote or callout; got: ${Array.from(types).sort().join(', ')}`)
  }

  for (const t of tokens) {
    const st = Number((t as unknown as { startLine?: unknown }).startLine)
    if (!Number.isFinite(st) || st < 1) {
      throw new Error(`expected finite 1-based startLine for token type ${(t as unknown as { type?: unknown }).type}`)
    }
  }
}
