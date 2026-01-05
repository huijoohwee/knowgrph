import type { ParserSpec } from '@/features/parsers/types'

export const formatParserSpecText = (spec: ParserSpec | null): string => {
  if (!spec) return '// Select a parser in Parser view to inspect its spec.'
  const plain: Record<string, unknown> = { ...spec }
  delete (plain as Partial<ParserSpec>).parse
  delete (plain as Partial<ParserSpec>).parseAsync
  try {
    return JSON.stringify(plain, null, 2)
  } catch {
    return '// Unable to format parser spec.'
  }
}

export const parserSpecTextFromList = (parsers: ParserSpec[], selectedId: string): string => {
  const spec = parsers.find(p => String(p.id) === selectedId) || null
  return formatParserSpecText(spec)
}
