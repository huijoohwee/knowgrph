import { buildWebsiteSitemapMarkdown } from '@/lib/websites/websiteSitemapMarkdown'

export const testWebsiteSitemapMarkdownBuildsTreeAndTable = () => {
  const md = buildWebsiteSitemapMarkdown({
    rootUrl: 'https://example.com/',
    importId: 'import-1',
    outputDirRel: '.tmp',
    nodes: [
      { nodeId: 'a', url: 'https://example.com/', path: '', title: 'Home' },
      { nodeId: 'b', url: 'https://example.com/docs', path: 'docs', title: 'Docs' },
      { nodeId: 'c', url: 'https://example.com/docs/getting-started', path: 'docs/getting-started', title: 'Getting Started' },
    ],
  })

  if (!md.includes('# Website Sitemap:')) throw new Error('missing title')
  if (!md.includes('## https://example.com/')) throw new Error('missing rootUrl')
  if (!md.includes('## 🗂️ Tree')) throw new Error('missing tree section')
  if (!md.includes('## 🧭 Pages')) throw new Error('missing pages section')
  if (!md.includes('| Path | Title | URL |')) throw new Error('missing pages table header')
  if (!md.includes('`/(root)`') && !md.includes('`(root)`')) {
    throw new Error('missing root row')
  }
  if (!md.includes('`/docs`')) throw new Error('missing docs row')
}

