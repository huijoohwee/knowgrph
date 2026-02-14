import { isFrontmatterOnlyDoc, parseWebpageFrontmatterMeta, upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'

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

export const testWebpageFrontmatterUpsertPreservesOtherKeys = () => {
  const existing = [
    '---',
    'kgWebpageUrl: "https://localhost/a"',
    'kgWebpageView: "markdown"',
    'kgWebsiteImportId: "import-1"',
    'kgWebsiteNodeId: "node-1"',
    'kgWebsiteOutputDirRel: ".knowgrph-workspace/website-imports"',
    '---',
    '',
    '# Doc',
    '',
  ].join('\n')
  const next = upsertWebpageFrontmatterMeta(existing, { url: 'https://localhost/a', view: 'html' })
  if (!next.includes('kgWebsiteImportId: "import-1"')) throw new Error('expected kgWebsiteImportId preserved')
  if (!next.includes('kgWebsiteNodeId: "node-1"')) throw new Error('expected kgWebsiteNodeId preserved')
  if (!next.includes('kgWebsiteOutputDirRel: ".knowgrph-workspace/website-imports"')) throw new Error('expected kgWebsiteOutputDirRel preserved')
}

export const testWebpageFrontmatterSupportsJsonView = () => {
  const input = '# Title\n\nHello\n'
  const withMeta = upsertWebpageFrontmatterMeta(input, { url: 'https://localhost/path', view: 'json' })
  const parsed = parseWebpageFrontmatterMeta(withMeta)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://localhost/path') throw new Error('url mismatch')
  if (parsed.view !== 'json') throw new Error('view mismatch')
}

export const testWebpageFrontmatterSupportsMarkdownView = () => {
  const input = '# Title\n\nHello\n'
  const withMeta = upsertWebpageFrontmatterMeta(input, { url: 'https://localhost/path', view: 'markdown' })
  const parsed = parseWebpageFrontmatterMeta(withMeta)
  if (!parsed) throw new Error('expected meta')
  if (parsed.url !== 'https://localhost/path') throw new Error('url mismatch')
  if (parsed.view !== 'markdown') throw new Error('view mismatch')
}

export const testFrontmatterOnlyDocDetection = () => {
  const stub = ['---', 'kgWebpageUrl: "https://localhost/"', 'kgWebpageView: "markdown"', '---', '', ''].join('\n')
  if (!isFrontmatterOnlyDoc(stub)) throw new Error('expected stub to be frontmatter-only')
  const withBody = `${stub}# Notes\n\nHello\n`
  if (isFrontmatterOnlyDoc(withBody)) throw new Error('expected body doc to not be frontmatter-only')
}
