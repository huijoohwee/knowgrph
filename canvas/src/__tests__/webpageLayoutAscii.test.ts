import {
  extractWebpageLayoutAsciiFromMarkdownDoc,
  extractWebpageLayoutMockupAsciiFromMarkdownDoc,
  upsertWebpageLayoutAsciiIntoMarkdownDoc,
} from '@/lib/markdown/webpageLayoutAscii'

export const testWebpageLayoutAsciiExtractsTextFence = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "markdown"',
    '---',
    '',
    '# Notes',
    '',
    '```text',
    '+----------------+',
    '|   HEADER       |',
    '+----------------+',
    '```',
    '',
  ].join('\n')

  const ascii = extractWebpageLayoutAsciiFromMarkdownDoc(doc)
  if (!ascii.includes('|   HEADER')) throw new Error('expected ascii extracted')
  if (!ascii.endsWith('\n')) throw new Error('expected trailing newline')
}

export const testWebpageLayoutAsciiExtractsMockupBeforeLegend = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "markdown"',
    '---',
    '',
    '```text',
    'MOCKUP',
    'Legend:',
    '  [PAGE] page frame',
    '```',
    '',
  ].join('\n')
  const mockup = extractWebpageLayoutMockupAsciiFromMarkdownDoc(doc)
  if (mockup.trimEnd() !== 'MOCKUP') throw new Error('expected mockup-only extraction')
}

export const testWebpageLayoutAsciiUpsertPreservesBodyOutsideFence = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "markdown"',
    '---',
    '',
    '# Notes',
    '',
    'before fence',
    '',
    '```text',
    'old',
    '```',
    '',
    'after fence',
    '',
  ].join('\n')

  const nextAscii = 'new\nlayout'
  const nextDoc = upsertWebpageLayoutAsciiIntoMarkdownDoc(doc, nextAscii)
  if (!nextDoc.includes('kgWebpageView: "markdown"')) throw new Error('expected frontmatter preserved')
  if (!nextDoc.includes('before fence')) throw new Error('expected body prefix preserved')
  if (!nextDoc.includes('after fence')) throw new Error('expected body suffix preserved')
  if (!nextDoc.includes('new\nlayout')) throw new Error('expected fence content replaced')

  const extracted = extractWebpageLayoutAsciiFromMarkdownDoc(nextDoc)
  if (extracted.trimEnd() !== nextAscii) throw new Error('expected extract to match inserted ascii')
}

export const testWebpageLayoutAsciiUpsertPreservesLegendTail = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "markdown"',
    '---',
    '',
    '```text',
    'MOCKUP',
    'Legend:',
    '  [PAGE] page frame',
    '```',
    '',
  ].join('\n')

  const nextDoc = upsertWebpageLayoutAsciiIntoMarkdownDoc(doc, 'NEW')
  const extracted = extractWebpageLayoutAsciiFromMarkdownDoc(nextDoc)
  if (!extracted.includes('NEW')) throw new Error('expected updated mockup present')
  if (!extracted.includes('Legend:')) throw new Error('expected legend preserved')
  if (!extracted.includes('[PAGE] page frame')) throw new Error('expected legend content preserved')
}

export const testWebpageLayoutAsciiUpsertCreatesFenceWhenMissing = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "markdown"',
    '---',
    '',
    '# Notes',
    '',
    'no fence yet',
    '',
  ].join('\n')

  const nextDoc = upsertWebpageLayoutAsciiIntoMarkdownDoc(doc, 'hello')
  if (!nextDoc.includes('```text')) throw new Error('expected fence inserted')
  if (!nextDoc.includes('kg-webpage-layout')) throw new Error('expected kg-webpage-layout fence')
  if (!nextDoc.includes('no fence yet')) throw new Error('expected existing body preserved')
  const extracted = extractWebpageLayoutAsciiFromMarkdownDoc(nextDoc)
  if (extracted.trimEnd() !== 'hello') throw new Error('expected inserted ascii extracted')
}
