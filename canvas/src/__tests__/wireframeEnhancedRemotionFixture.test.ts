import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWireframeEnhancedMarkdownFromMarkdown } from '@/lib/websites/wireframeEnhanced'

const sliceBetween = (text: string, start: string, end: string): string => {
  const a = text.indexOf(start)
  if (a < 0) return ''
  const b = text.indexOf(end, a + start.length)
  if (b < 0) return text.slice(a).trimEnd()
  return text.slice(a, b).trimEnd()
}

export const testWireframeEnhancedRemotionFixtureSections = () => {
  const self = fileURLToPath(import.meta.url)
  const dir = path.dirname(self)
  const upstreamPath = path.resolve(dir, './fixtures/remotion-dev.upstream-fixture.md')
  const upstream = fs.readFileSync(upstreamPath, 'utf-8')

  const actual = buildWireframeEnhancedMarkdownFromMarkdown({
    markdown: upstream,
    url: 'https://example.com/',
    title: 'Remotion | Make videos programmatically',
  })

  if (actual.includes('## Document Structure')) throw new Error('document structure section should be merged into layout structure')

  const layoutSlice = sliceBetween(actual, '## 📐 Layout Structure', '\n---\n')
  if (!layoutSlice) throw new Error('missing layout structure section')
  if (/^\+/m.test(layoutSlice)) throw new Error('layout structure should not include +--- style frames')
  const legendCount = (layoutSlice.match(/\bLegend:/g) || []).length
  if (legendCount !== 0) throw new Error('layout structure should not include legend block')
  if (!layoutSlice.includes('GLOBAL NAVIGATION')) throw new Error('missing global navigation layout')
  if (!layoutSlice.includes('Docs')) throw new Error('missing Docs nav item in merged global navigation')
  if (!layoutSlice.includes('Discord')) throw new Error('missing Discord CTA in merged global navigation')
  if (!layoutSlice.includes('GitHub')) throw new Error('missing GitHub link in merged global navigation')
  if (!layoutSlice.includes('Prompt a video')) throw new Error('missing prompt CTA in merged global navigation')

  const actualTemplateGallery = sliceBetween(actual, '## 📑 Template Showcase', '### Available Templates')
  if (!actualTemplateGallery) throw new Error('missing template showcase')
  if (!actualTemplateGallery.includes('┌─────────────────────────────────────────────────────────────────────────┐')) {
    throw new Error('missing template gallery ascii grid')
  }
  if (!actualTemplateGallery.includes('│ [Blank]│ Hello  │ Next.js │  Prompt to   │  React   │   Find a       │')) {
    throw new Error('template gallery grid does not match fixture layout')
  }
  if (!actualTemplateGallery.includes('│  [□]   │  [□]   │   [□]   │   Graphics   │   [□]    │')) {
    throw new Error('template gallery grid missing multi-row cells')
  }
  const actualHero = sliceBetween(actual, '## 🎯 Hero Section', '## 📑 Template Showcase')
  if (!actualHero) throw new Error('missing hero section')
  if (!actualHero.includes('$ npx create-video@latest')) throw new Error('missing hero command')
  if (!actualHero.includes('[GitHub')) throw new Error('missing hero CTAs')

  const actualPricing = sliceBetween(actual, '## 💰 Pricing Section', '## 🤝 Trust & Support Section')
  if (!actualPricing) throw new Error('missing pricing section')
  if (!actualPricing.includes('### Company License Options')) throw new Error('missing company license options')
  if (!actualPricing.includes('### Pricing Details')) throw new Error('missing pricing details')
  if (!actualPricing.includes('**$75**')) throw new Error('missing $75 pricing row')
  if (!actualPricing.includes('**Remotion for Creators**')) throw new Error('missing creators block')
  if (!actualPricing.includes('**Remotion for Automators**')) throw new Error('missing automators block')

  const actualRendering = sliceBetween(actual, '### Rendering Options', '---')
  if (!actualRendering) throw new Error('missing rendering options section')
  if (!actualRendering.includes('| Method | Speed | Cost | Best For |')) throw new Error('missing rendering options table')
}
