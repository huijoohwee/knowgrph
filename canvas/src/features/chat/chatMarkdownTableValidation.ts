import { containsMarkdownPipeTable } from '@/features/markdown/ui/markdownDataViewSerialize'

export const validateNoAuthoredHtmlTables = (md: string): { ruleId: 'V-10'; message: string } | null => {
  const lines = String(md || '').replace(/\r\n/g, '\n').split('\n')
  let fence: { marker: '`' | '~'; length: number } | null = null
  const authoredLines: string[] = []
  for (const line of lines) {
    const fenceMatch = /^\s*(`{3,}|~{3,})/.exec(line)
    if (fenceMatch) {
      const token = String(fenceMatch[1] || '')
      const marker = token[0] === '~' ? '~' : '`'
      if (!fence) { fence = { marker, length: token.length }; continue }
      if (fence.marker === marker && token.length >= fence.length) { fence = null; continue }
    }
    if (fence) continue
    authoredLines.push(line)
    if (/<table\b/i.test(line)) return { ruleId: 'V-10', message: 'Generated tables must persist as YAML block-scalar GitHub-flavored Markdown pipe tables; authored <table> HTML is not allowed outside fenced code.' }
  }
  const authoredText = authoredLines.join('\n')
  if (containsMarkdownPipeTable(authoredText) && /<br\s*\/?>/i.test(authoredText)) return { ruleId: 'V-10', message: 'Generated Markdown pipe tables must use plain Markdown cell text; authored <br> table-cell HTML is not allowed.' }
  if (containsMarkdownPipeTable(authoredText) && /^\s*(?:outputSrcDoc|srcDoc)\s*:/mi.test(authoredText)) return { ruleId: 'V-10', message: 'Markdown pipe tables must use a YAML block-scalar Markdown output as their single persisted authority; srcDoc/outputSrcDoc companions are not allowed.' }
  return null
}
