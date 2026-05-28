import { __testkit } from '@/lib/websites/server/websiteImportCore'
import { buildAutoWebsiteImportOptions } from '@/lib/toolbar/importUrlWebsiteMode'
import { buildWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'
import { websiteImportArtifactKindForWebpageView } from '@/lib/websites/websiteImportArtifactKind'
import { buildWebsiteSemanticSnapshotFromHtml } from '@/lib/websites/websiteSemanticSnapshot'

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
  if (!out.includes('## Page Structure Overview')) throw new Error('missing Page Structure Overview section')
  if (!out.includes('NAVIGATION HEADER')) throw new Error('missing Navigation Header frame')
}

export const testWebsiteImportArtifactKindForWebpageView = () => {
  if (websiteImportArtifactKindForWebpageView('markdown') !== 'markdown') throw new Error('markdown mapping')
  if (websiteImportArtifactKindForWebpageView('json') !== 'conversionJson') throw new Error('json mapping')
  if (websiteImportArtifactKindForWebpageView('html') !== 'rawHtml') throw new Error('html mapping')
}

export const testWebsiteImportExtractsSpaRouteLinksWithinWebsiteScope = () => {
  const root = 'https://example.invalid/collection/root'
  const html = [
    '<a href="/collection/page-a">Page A</a>',
    '<script>',
    '{"next":"\\/collection\\/page-b","abs":"https:\\/\\/example.invalid\\/collection\\/unit\\/page-c"}',
    '{"outside":"\\/other\\/page","asset":"\\/collection\\/assets\\/bundle.js"}',
    '</script>',
  ].join('\n')
  const links = __testkit.extractInternalUrlCandidatesFromHtml(html, root, root)
  if (!links.includes('https://example.invalid/collection/page-a')) throw new Error('missing anchor page')
  if (!links.includes('https://example.invalid/collection/page-b')) throw new Error('missing escaped route')
  if (!links.includes('https://example.invalid/collection/unit/page-c')) throw new Error('missing escaped absolute route')
  if (links.some(link => link.includes('/other/'))) throw new Error('expected path-scope filtering')
  if (links.some(link => link.endsWith('/bundle.js'))) throw new Error('expected asset filtering')
}

export const testLaunchWebsiteImportButtonUsesEnhancedOptions = () => {
  const opts = buildAutoWebsiteImportOptions()
  if (opts.generateArtifactDocs !== true) throw new Error('expected explicit website import to materialize content docs')
  if (opts.browserEnhance !== true) throw new Error('expected explicit website import to prefer browser-enhanced webpage fidelity')
  if (!opts.minPages || opts.minPages < 100) throw new Error('expected explicit website import to cover multi-page websites')
}

export const testWebsiteSemanticSnapshotIndexesQueryablePageData = () => {
  const html = [
    '<main>',
    '<h1>Course Overview</h1>',
    '<a href="/collection/page-a">Page A</a>',
    '<button aria-label="Continue">Go</button>',
    '<img src="/hero.png" alt="Hero">',
    '<table><tr><th>Name</th><td>Value</td></tr></table>',
    '<ul><li>First item</li><li>Second item</li></ul>',
    '</main>',
  ].join('')
  const snapshot = buildWebsiteSemanticSnapshotFromHtml({ html, url: 'https://example.invalid/collection/root' })
  if (snapshot.summary.headings !== 1) throw new Error('expected heading query data')
  if (snapshot.queryData.links[0]?.href !== 'https://example.invalid/collection/page-a') throw new Error('expected resolved link data')
  if (snapshot.summary.controls !== 1) throw new Error('expected control query data')
  if (snapshot.summary.media !== 1) throw new Error('expected media query data')
  if (snapshot.summary.tables !== 1) throw new Error('expected table query data')
  if (snapshot.summary.lists !== 1) throw new Error('expected list query data')
  if (!snapshot.queryData.textBlocks.some(block => block.text === 'First item')) throw new Error('expected text block data')
}
