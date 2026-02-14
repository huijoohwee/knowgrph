import { __testkit } from '@/lib/websites/server/websiteImportCore'
import { buildWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'
import { websiteImportArtifactKindForWebpageView } from '@/lib/websites/websiteImportArtifactKind'

export const testWebsiteImportSitemapExtractsLocs = () => {
  const xml = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset>', '<url><loc>https://localhost/</loc></url>', '<url><loc>https://localhost/a</loc></url>', '</urlset>'].join('\n')
  const locs = __testkit.extractXmlLocs(xml)
  if (locs.length !== 2) throw new Error('expected 2 locs')
  if (locs[0] !== 'https://localhost/') throw new Error('loc[0] mismatch')
  if (locs[1] !== 'https://localhost/a') throw new Error('loc[1] mismatch')
}

export const testWebsiteImportSitemapDetectsIndex = () => {
  const xml = ['<?xml version="1.0"?>', '<sitemapindex>', '<sitemap><loc>https://localhost/sitemap-1.xml</loc></sitemap>', '</sitemapindex>'].join('\n')
  if (!__testkit.looksLikeSitemapIndex(xml)) throw new Error('expected sitemapindex detected')
}

export const testWebpageMarkdownArtifactDocIncludesFrontmatter = () => {
  const md = ['# Title', '', 'Hello', ''].join('\n')
  const out = buildWebpageMarkdownArtifactDoc({ markdown: md, url: 'https://localhost/' })
  if (!out.includes('kgWebpageUrl: "https://localhost/"')) throw new Error('missing kgWebpageUrl frontmatter')
  if (!out.includes('kgWebpageView: "markdown"')) throw new Error('missing kgWebpageView frontmatter')
}

export const testWebpageMarkdownArtifactDocIncludesLayoutStructure = () => {
  const md = ['# Title', '', '[Docs](https://example.com/docs)', '', '[Get started](https://example.com/start)', ''].join('\n')
  const out = buildWebpageMarkdownArtifactDoc({ markdown: md, url: 'https://localhost/' })
  if (!out.includes('## 🏗️ Page Structure Overview')) throw new Error('missing Page Structure Overview section')
  if (!out.includes('NAVIGATION HEADER')) throw new Error('missing Navigation Header frame')
}

export const testWebsiteImportArtifactKindForWebpageView = () => {
  if (websiteImportArtifactKindForWebpageView('markdown') !== 'markdown') throw new Error('markdown mapping')
  if (websiteImportArtifactKindForWebpageView('json') !== 'conversionJson') throw new Error('json mapping')
  if (websiteImportArtifactKindForWebpageView('html') !== 'rawHtml') throw new Error('html mapping')
}
