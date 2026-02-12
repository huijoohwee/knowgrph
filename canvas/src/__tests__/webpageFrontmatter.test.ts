import { parseWebpageFrontmatterMeta, upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'

export const testWebpageFrontmatterRoundtrip = () => {
  const input = '# Title\n\nHello\n'
  const withMeta = upsertWebpageFrontmatterMeta(input, { url: 'https://example.com/path', view: 'html' })
  const parsed = parseWebpageFrontmatterMeta(withMeta)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://example.com/path') throw new Error('url mismatch')
  if (parsed.view !== 'html') throw new Error('view mismatch')
  if (!withMeta.includes(input.trim())) throw new Error('expected body preserved')
}

export const testWebpageFrontmatterUpsertUpdatesExisting = () => {
  const existing = [
    '---',
    'kgWebpageUrl: "https://a.example/"',
    'kgWebpageView: "markdown"',
    '---',
    '',
    '# Doc',
    '',
  ].join('\n')
  const next = upsertWebpageFrontmatterMeta(existing, { url: 'https://b.example/x', view: 'html' })
  const parsed = parseWebpageFrontmatterMeta(next)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://b.example/x') throw new Error('url mismatch')
  if (parsed.view !== 'html') throw new Error('view mismatch')
  if (!next.includes('# Doc')) throw new Error('expected body preserved')
}

export const testWebpageFrontmatterSupportsJsonView = () => {
  const input = '# Title\n\nHello\n'
  const withMeta = upsertWebpageFrontmatterMeta(input, { url: 'https://example.com/path', view: 'json' })
  const parsed = parseWebpageFrontmatterMeta(withMeta)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://example.com/path') throw new Error('url mismatch')
  if (parsed.view !== 'json') throw new Error('view mismatch')
}
