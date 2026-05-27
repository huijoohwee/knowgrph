import { builtInParsers } from '@/features/parsers/default'
import { parseMarkdownFrontmatter, splitMarkdownLines } from '@/lib/markdown'

export function testMarkdownFrontmatterParseReportsYamlFailureWarnings() {
  const lines = splitMarkdownLines([
    '---',
    'title: "Broken',
    'flow:',
    '  direction: LR',
    '---',
    '',
    '# Body',
  ].join('\n'))

  const parsed = parseMarkdownFrontmatter(lines)
  if (parsed.startIndex !== 5) throw new Error(`expected frontmatter end index 5, got ${parsed.startIndex}`)
  if (Object.keys(parsed.meta).length !== 0) throw new Error('expected invalid frontmatter parse to fall back to empty meta')
  const warningBlob = parsed.warnings.join(' | ')
  if (!warningBlob.includes('Markdown frontmatter YAML parse failed and frontmatter was ignored:')) {
    throw new Error(`expected frontmatter parse failure warning, got: ${warningBlob}`)
  }
}

export async function testMarkdownParserCarriesFrontmatterParseWarningsThroughParserResult() {
  const markdownSpec = builtInParsers.find(spec => String(spec.id) === 'markdown')
  if (!markdownSpec || typeof markdownSpec.parseAsync !== 'function') {
    throw new Error('expected built-in markdown parser parseAsync to be available')
  }

  const text = [
    '---',
    'title: "Broken',
    'summary: still invalid',
    '---',
    '',
    '# Frontmatter Warning',
    '',
    'Body paragraph.',
  ].join('\n')

  const result = await markdownSpec.parseAsync('frontmatter-warning.md', text)
  const warnings = Array.isArray(result?.warnings) ? result.warnings : []
  const warningBlob = warnings.join(' | ')
  if (!warningBlob.includes('Markdown frontmatter YAML parse failed and frontmatter was ignored:')) {
    throw new Error(`expected markdown parser result to include frontmatter parse warning, got: ${warningBlob}`)
  }
  if (!result.graphData || String(result.graphData.type || '') !== 'Graph') {
    throw new Error('expected markdown parser to still produce graph data after frontmatter parse warning')
  }
}
