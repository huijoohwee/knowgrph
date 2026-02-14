import { parsePlainTextToMarkdown } from '@/features/parsers/html-parser'

export async function testPlainTextToMarkdownPreservesParagraphs() {
  const input = 'Line one\nLine two\n\nPara two line\nNext\n\n\nPara three'
  const md = parsePlainTextToMarkdown(input, 'Title')
  if (!md.startsWith('# Title')) throw new Error('expected title')
  if (!md.includes('Line one Line two')) throw new Error('expected line breaks flattened within paragraph')
  if (!md.includes('\n\nPara two line Next\n\n')) throw new Error('expected paragraph breaks preserved')
  if (!md.includes('Para three')) throw new Error('expected final paragraph')
}

