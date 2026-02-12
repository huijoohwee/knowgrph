import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'

export const testSanitizeImportedMarkdownRemovesBase64FenceLines = () => {
  const input = ['# Doc', '', '```', 'iVBORw0KGgo' + 'A'.repeat(400), '```', ''].join('\n')
  const out = sanitizeImportedMarkdownText(input)
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('<omitted>')) throw new Error('expected <omitted>')
}

export const testSanitizeImportedMarkdownRemovesDataImageBase64 = () => {
  const input = '![x](data:image/png;base64,' + 'A'.repeat(2048) + ')'
  const out = sanitizeImportedMarkdownText(input)
  if (!out.changed) throw new Error('expected changed')
  if (!out.text.includes('data:,')) throw new Error('expected data:,')
}

