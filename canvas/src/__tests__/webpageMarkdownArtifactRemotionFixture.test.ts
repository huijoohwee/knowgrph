import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildWebpageMarkdownArtifactDoc } from '@/lib/websites/webpageMarkdownArtifact'

const sliceBetween = (text: string, start: string, end: string): string => {
  const a = text.indexOf(start)
  if (a < 0) return ''
  const b = text.indexOf(end, a + start.length)
  if (b < 0) return text.slice(a).trimEnd()
  return text.slice(a, b).trimEnd()
}

export const testWebpageMarkdownArtifactRemotionFixtureSections = () => {
  const self = fileURLToPath(import.meta.url)
  const dir = path.dirname(self)
  const upstreamPath = path.resolve(dir, './fixtures/remotion-dev.upstream-fixture.md')
  const upstream = fs.readFileSync(upstreamPath, 'utf-8')

  const actual = buildWebpageMarkdownArtifactDoc({
    markdown: upstream,
    url: 'https://example.com/',
    title: 'Remotion | Make videos programmatically',
    fidelityMaxLevel: 4,
  })

  if (!actual.includes('## 📋 TABLE OF CONTENTS')) throw new Error('missing toc')
  if (!actual.includes('## 🏗️ Page Structure Overview')) throw new Error('missing page structure overview')

  const overviewSlice = sliceBetween(actual, '## 🏗️ Page Structure Overview', '\n---\n')
  if (!overviewSlice) throw new Error('missing page structure overview slice')
  if (!overviewSlice.includes('NAVIGATION HEADER')) throw new Error('missing navigation header layout')
  if (!overviewSlice.includes('Docs')) throw new Error('missing Docs nav item in overview')
  if (!overviewSlice.includes('Discord')) throw new Error('missing Discord CTA in overview')
  if (!overviewSlice.includes('GitHub')) throw new Error('missing GitHub link in overview')
  if (!overviewSlice.includes('Prompt a video')) throw new Error('missing prompt CTA in overview')

  const actualTemplateGallery = sliceBetween(actual, '## 🖼️ Template / Gallery', '\n---\n')
  if (!actualTemplateGallery) throw new Error('missing template/gallery')
  if (!actualTemplateGallery.includes('┌─────────────────────────────────────────────────────────────────────────┐')) {
    throw new Error('missing template gallery ascii grid')
  }
  if (!actualTemplateGallery.includes('│ [Blank]│ Hello  │ Next.js │  Prompt to   │  React   │   Find a       │')) {
    throw new Error('template gallery grid does not match fixture layout')
  }
  if (!actualTemplateGallery.includes('│  [□]   │  [□]   │   [□]   │   Graphics   │   [□]    │')) {
    throw new Error('template gallery grid missing multi-row cells')
  }

  const actualHero = sliceBetween(actual, '## 🦸 Hero Section', '\n---\n')
  if (!actualHero) throw new Error('missing hero section')
  if (!actualHero.includes('$ npx create-video@latest')) throw new Error('missing hero command')
  if (!actualHero.includes('[GitHub')) throw new Error('missing hero CTAs')

  const actualPricing = sliceBetween(actual, '## 💰 Pricing', '\n---\n')
  if (!actualPricing) throw new Error('missing pricing section')
  if (!actualPricing.includes('Company License Options')) throw new Error('missing company license options')
  if (!actualPricing.includes('Pricing Details')) throw new Error('missing pricing details')
  if (!actualPricing.includes('**$75**')) throw new Error('missing $75 pricing row')
  if (!actualPricing.includes('Remotion for Creators')) throw new Error('missing creators block')
  if (!actualPricing.includes('Remotion for Automators')) throw new Error('missing automators block')
  if (!actualPricing.includes('| Method | Speed | Cost | Best For |')) throw new Error('missing rendering options table')
}
