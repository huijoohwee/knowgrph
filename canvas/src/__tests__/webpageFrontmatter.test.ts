import { parseWebpageFrontmatterMeta, upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'

export const testWebpageFrontmatterRoundtrip = () => {
  const input = '# Title\n\nHello\n'
  const withMeta = upsertWebpageFrontmatterMeta(input, { url: 'https://localhost/path', view: 'html' })
  const parsed = parseWebpageFrontmatterMeta(withMeta)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://localhost/path') throw new Error('url mismatch')
  if (parsed.view !== 'html') throw new Error('view mismatch')
  if (!withMeta.includes(input.trim())) throw new Error('expected body preserved')
}

export const testWebpageFrontmatterUpsertUpdatesExisting = () => {
  const existing = [
    '---',
    'kgWebpageUrl: "https://localhost/a"',
    'kgWebpageView: "markdown"',
    '---',
    '',
    '# Doc',
    '',
  ].join('\n')
  const next = upsertWebpageFrontmatterMeta(existing, { url: 'https://localhost/b', view: 'html' })
  const parsed = parseWebpageFrontmatterMeta(next)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://localhost/b') throw new Error('url mismatch')
  if (parsed.view !== 'html') throw new Error('view mismatch')
  if (!next.includes('# Doc')) throw new Error('expected body preserved')
}

export const testWebpageFrontmatterSupportsJsonView = () => {
  const input = '# Title\n\nHello\n'
  const withMeta = upsertWebpageFrontmatterMeta(input, { url: 'https://localhost/path', view: 'json' })
  const parsed = parseWebpageFrontmatterMeta(withMeta)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://localhost/path') throw new Error('url mismatch')
  if (parsed.view !== 'json') throw new Error('view mismatch')
}

export const testWebpageFrontmatterSupportsWireframeView = () => {
  const input = '# Title\n\nHello\n'
  const withMeta = upsertWebpageFrontmatterMeta(input, { url: 'https://localhost/path', view: 'wireframe' })
  const parsed = parseWebpageFrontmatterMeta(withMeta)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://localhost/path') throw new Error('url mismatch')
  if (parsed.view !== 'wireframe') throw new Error('view mismatch')
}

export const testWebpageFrontmatterSupportsWireframeEnhancedView = () => {
  const input = '# Title\n\nHello\n'
  const withMeta = upsertWebpageFrontmatterMeta(input, { url: 'https://localhost/path', view: 'wireframe-enhanced' })
  const parsed = parseWebpageFrontmatterMeta(withMeta)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://localhost/path') throw new Error('url mismatch')
  if (parsed.view !== 'wireframe-enhanced') throw new Error('view mismatch')
}
