import fs from 'node:fs'
import path from 'node:path'
import { buildWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'

const sliceBetween = (text: string, start: string, end: string): string => {
  const a = text.indexOf(start)
  if (a < 0) return ''
  const b = text.indexOf(end, a + start.length)
  if (b < 0) return text.slice(a).trimEnd()
  return text.slice(a, b).trimEnd()
}

export const testWebpageMarkdownArtifactRemotionPricingRendersAsciiTierTableAndNoTemplateDupes = () => {
  const fixturePath = path.resolve(process.cwd(), 'src', '__tests__', 'fixtures', 'remotion-dev.upstream-fixture.md')
  const upstream = fs.readFileSync(fixturePath, 'utf8')
  const out = buildWebpageMarkdownArtifactDoc({
    markdown: upstream,
    url: 'https://www.remotion.dev/',
    title: 'Remotion',
    fidelityMaxLevel: 4,
  })

  if (!out.includes('## Template Gallery')) throw new Error('expected template gallery section')
  if (out.includes('## Template Showcase')) throw new Error('expected template showcase to be omitted')

  const pricingSlice = sliceBetween(out, '## Pricing', '\n---\n')
  if (!pricingSlice) throw new Error('expected pricing section slice')
  if (!pricingSlice.includes('```ascii')) throw new Error('expected pricing section to include ascii blocks')
  if (!pricingSlice.includes('Free License')) throw new Error('expected Free License in pricing ascii tier table')
  if (!pricingSlice.includes('Company License')) throw new Error('expected Company License in pricing ascii tier table')
  if (!pricingSlice.includes('Enterprise License')) throw new Error('expected Enterprise License in pricing ascii tier table')
  if (!pricingSlice.includes('┌') || !pricingSlice.includes('┬') || !pricingSlice.includes('┐')) {
    throw new Error('expected pricing tier table to include box-drawing borders')
  }
}

