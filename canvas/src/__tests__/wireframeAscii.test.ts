import {
  extractWireframeAsciiFromMarkdownDoc,
  extractWireframeMockupAsciiFromMarkdownDoc,
  upsertWireframeAsciiIntoMarkdownDoc,
} from '@/lib/markdown/wireframeAscii'

export const testWireframeAsciiExtractsTextFence = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "wireframe"',
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

  const ascii = extractWireframeAsciiFromMarkdownDoc(doc)
  if (!ascii.includes('|   HEADER')) throw new Error('expected ascii extracted')
  if (!ascii.endsWith('\n')) throw new Error('expected trailing newline')
}

export const testWireframeAsciiExtractsMockupBeforeLegend = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "wireframe"',
    '---',
    '',
    '```text',
    'MOCKUP',
    'Legend:',
    '  [PAGE] page frame',
    '```',
    '',
  ].join('\n')
  const mockup = extractWireframeMockupAsciiFromMarkdownDoc(doc)
  if (mockup.trimEnd() !== 'MOCKUP') throw new Error('expected mockup-only extraction')
}

export const testWireframeAsciiUpsertPreservesBodyOutsideFence = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "wireframe"',
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

  const nextAscii = 'new\nwireframe'
  const nextDoc = upsertWireframeAsciiIntoMarkdownDoc(doc, nextAscii)
  if (!nextDoc.includes('kgWebpageView: "wireframe"')) throw new Error('expected frontmatter preserved')
  if (!nextDoc.includes('before fence')) throw new Error('expected body prefix preserved')
  if (!nextDoc.includes('after fence')) throw new Error('expected body suffix preserved')
  if (!nextDoc.includes('new\nwireframe')) throw new Error('expected fence content replaced')

  const extracted = extractWireframeAsciiFromMarkdownDoc(nextDoc)
  if (extracted.trimEnd() !== nextAscii) throw new Error('expected extract to match inserted ascii')
}

export const testWireframeAsciiUpsertPreservesLegendTail = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "wireframe"',
    '---',
    '',
    '```text',
    'MOCKUP',
    'Legend:',
    '  [PAGE] page frame',
    '```',
    '',
  ].join('\n')

  const nextDoc = upsertWireframeAsciiIntoMarkdownDoc(doc, 'NEW')
  const extracted = extractWireframeAsciiFromMarkdownDoc(nextDoc)
  if (!extracted.includes('NEW')) throw new Error('expected updated mockup present')
  if (!extracted.includes('Legend:')) throw new Error('expected legend preserved')
  if (!extracted.includes('[PAGE] page frame')) throw new Error('expected legend content preserved')
}

export const testWireframeAsciiUpsertCreatesFenceWhenMissing = () => {
  const doc = [
    '---',
    'kgWebpageUrl: "https://localhost/"',
    'kgWebpageView: "wireframe"',
    '---',
    '',
    '# Notes',
    '',
    'no fence yet',
    '',
  ].join('\n')

  const nextDoc = upsertWireframeAsciiIntoMarkdownDoc(doc, 'hello')
  if (!nextDoc.includes('```text')) throw new Error('expected fence inserted')
  if (!nextDoc.includes('kg-wireframe')) throw new Error('expected kg-wireframe fence')
  if (!nextDoc.includes('no fence yet')) throw new Error('expected existing body preserved')
  const extracted = extractWireframeAsciiFromMarkdownDoc(nextDoc)
  if (extracted.trimEnd() !== 'hello') throw new Error('expected inserted ascii extracted')
}
