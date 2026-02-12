import { __testkit } from '@/lib/websites/server/websiteImportCore'

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

export const testWebsiteImportWireframeBuilderIncludesHeadings = () => {
  const md = ['# Title', '', '## Section', '', '### Sub', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[H1] Title')) throw new Error('missing H1')
  if (!out.includes('[H2] Section')) throw new Error('missing H2')
  if (!out.includes('[H3] Sub')) throw new Error('missing H3')
}
