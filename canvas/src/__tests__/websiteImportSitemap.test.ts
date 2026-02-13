import { __testkit } from '@/lib/websites/server/websiteImportCore'
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

export const testWebsiteImportWireframeBuilderIncludesHeadings = () => {
  const md = ['# Title', '', '## Section', '', '### Sub', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[H1] Title')) throw new Error('missing H1')
  if (!out.includes('[H2] Section')) throw new Error('missing H2')
  if (!out.includes('[H3] Sub')) throw new Error('missing H3')
}

export const testWebsiteImportWireframeDetectsEmbeds = () => {
  const md = ['# Title', '', '<iframe src="https://example.com"></iframe>', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[EMBED] iframe')) throw new Error('missing iframe embed')
}

export const testWebsiteImportWireframeClassifiesNavAndCtaLinks = () => {
  const md = ['# Title', '', '[Docs](https://example.com/docs)', '', '[Get started](https://example.com/start)', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[NAV] Docs')) throw new Error('missing nav classification')
  if (!out.includes('[CTA] Get started')) throw new Error('missing cta classification')
}

export const testWebsiteImportWireframeDetectsPriceTokens = () => {
  const md = ['# Title', '', '- Plan A: $100/mo', '- Plan A: $100/mo', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[PRICE] $100/mo x2')) throw new Error('missing deduped price token count')
}

export const testWebsiteImportWireframeDetectsTimecodes = () => {
  const md = ['# Title', '', '0:00', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[TIME] 0:00')) throw new Error('missing timecode')
}

export const testWebsiteImportWireframeMockupIncludesCategorizedTokens = () => {
  const md = [
    '# Title',
    '',
    '[Docs](https://example.com/docs)',
    '',
    '[Get started](https://example.com/start)',
    '',
    'Price: $100/mo',
    '',
    '0:00',
    '',
  ].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost', { detailLevel: 'standard' })
  if (!out.includes('[MOCKUP]')) throw new Error('missing mockup')
  if (!out.includes('[NAV] Docs')) throw new Error('mockup missing nav token')
  if (!out.includes('[CTA] Get started')) throw new Error('mockup missing cta token')
  if (!out.includes('[PRICE] $100/mo')) throw new Error('mockup missing price token')
  if (!out.includes('[TIME] 0:00')) throw new Error('mockup missing time token')
}

export const testWebsiteImportWireframeMockupIncludesFlowAndStoryboardFrames = () => {
  const md = [
    '# Title',
    '',
    '[Docs](https://example.com/docs)',
    '',
    '[Get started](https://example.com/start)',
    '',
    '0:00',
    '',
    'Price: $100/mo',
    '',
    '## Section A',
    '',
    'Some text',
    '',
  ].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost', { detailLevel: 'standard' })
  if (!out.includes('│ FLOWS')) throw new Error('missing FLOWS frame')
  if (!out.includes('│ STORYBOARD')) throw new Error('missing STORYBOARD frame')
  if (!out.includes('│ RICH MEDIA & MOTION')) throw new Error('missing RICH MEDIA & MOTION frame')
}

export const testWebsiteImportWireframeClassifiesMediaAndAnimTags = () => {
  const md = ['# Title', '', '<video></video>', '', '<canvas></canvas>', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[MEDIA] video')) throw new Error('missing media tag')
  if (!out.includes('[ANIM] canvas')) throw new Error('missing anim tag')
}

export const testWebsiteImportWireframeDetectsFxTokens = () => {
  const md = ['# Title', '', '<div style="animation: spin 1s linear infinite">x</div>', '', 'Uses lottie animations', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[MOCKUP]')) throw new Error('missing mockup header')
  if (!out.includes('┌') || !out.includes('┘')) throw new Error('expected box drawing chars')
  if (!out.includes('[FX] css motion')) throw new Error('missing css motion fx')
  if (!out.includes('[FX] lottie')) throw new Error('missing lottie fx')
}

export const testWebsiteImportWireframeRendersPageLevelNavDetails = () => {
  const md = ['[Docs](https://example.com/docs)', '', '# Title', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost')
  if (!out.includes('[NAV] Docs')) throw new Error('missing page-level nav detail')
}

export const testWebsiteImportWireframeDetailLevelCapsSectionDetails = () => {
  const md = [
    '# Title',
    '',
    '- Item 1',
    '- Item 2',
    '- Item 3',
    '- Item 4',
    '- Item 5',
    '- Item 6',
    '- Item 7',
    '- Item 8',
    '- Item 9',
    '- Item 10',
    '',
  ].join('\n')

  const compact = __testkit.buildWireframeMarkdown(md, 'https://localhost', { detailLevel: 'compact' })
  if (!compact.includes('Detail: compact')) throw new Error('missing compact detail header')
  if (!compact.includes('[LI] Item 3')) throw new Error('expected compact to include item 3')
  if (compact.includes('[LI] Item 4')) throw new Error('expected compact to cap before item 4')

  const standard = __testkit.buildWireframeMarkdown(md, 'https://localhost', { detailLevel: 'standard' })
  if (!standard.includes('Detail: standard')) throw new Error('missing standard detail header')
  if (!standard.includes('[LI] Item 6')) throw new Error('expected standard to include item 6')
  if (standard.includes('[LI] Item 7')) throw new Error('expected standard to cap before item 7')

  const detailed = __testkit.buildWireframeMarkdown(md, 'https://localhost', { detailLevel: 'detailed' })
  if (!detailed.includes('Detail: detailed')) throw new Error('missing detailed detail header')
  if (!detailed.includes('[LI] Item 10')) throw new Error('expected detailed to include item 10')
}

export const testWebsiteImportWireframeRendersSiblingHeadingsInRow = () => {
  const md = ['# Title', '', '## A', '', '### A1', '', '### A2', '', '## B', '', '### B1', ''].join('\n')
  const out = __testkit.buildWireframeMarkdown(md, 'https://localhost', { detailLevel: 'detailed' })
  const lines = out.split(/\r?\n/)
  const rowLine = lines.find(l => l.includes('[H3] A1') && l.includes('[H3] A2'))
  if (!rowLine) throw new Error('expected sibling headings row layout')
}

export const testWebsiteImportArtifactKindForWebpageView = () => {
  if (websiteImportArtifactKindForWebpageView('markdown') !== 'markdown') throw new Error('markdown mapping')
  if (websiteImportArtifactKindForWebpageView('json') !== 'conversionJson') throw new Error('json mapping')
  if (websiteImportArtifactKindForWebpageView('wireframe') !== 'wireframeMarkdown') throw new Error('wireframe mapping')
  if (websiteImportArtifactKindForWebpageView('wireframe-enhanced') !== 'wireframeEnhancedMarkdown') throw new Error('wireframe-enhanced mapping')
  if (websiteImportArtifactKindForWebpageView('html') !== 'rawHtml') throw new Error('html mapping')
}
