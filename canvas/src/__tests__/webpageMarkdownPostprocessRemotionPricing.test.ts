import fs from 'node:fs'
import path from 'node:path'
import { postprocessWebpageMarkdownSsot } from '@/lib/markdown/webpageMarkdownPostprocess'

const sliceBetween = (text: string, start: string, end: string): string => {
  const a = text.indexOf(start)
  if (a < 0) return ''
  const b = text.indexOf(end, a + start.length)
  if (b < 0) return text.slice(a).trimEnd()
  return text.slice(a, b).trimEnd()
}

export function testWebpageMarkdownPostprocessRemotionPricingToAsciiTable() {
  const fixturePath = path.resolve(process.cwd(), 'src', '__tests__', 'fixtures', 'remotion-dev.upstream-fixture.md')
  const upstream = fs.readFileSync(fixturePath, 'utf8')
  const out = postprocessWebpageMarkdownSsot(upstream)

  const pricing = sliceBetween(out, '## Pricing', '\n## Trusted by')
  if (!pricing) throw new Error('expected pricing section')
  if (!pricing.includes('```ascii')) throw new Error('expected pricing section to include ascii block')
  if (!pricing.includes('Free License')) throw new Error('expected Free License in ascii table')
  if (!pricing.includes('Company License')) throw new Error('expected Company License in ascii table')
  if (!pricing.includes('Enterprise License')) throw new Error('expected Enterprise License in ascii table')
  if (!pricing.includes('┌') || !pricing.includes('┬') || !pricing.includes('┐')) {
    throw new Error('expected pricing ascii table to include box-drawing borders')
  }
  if (/\n-\s+Create and automate/.test(pricing)) {
    throw new Error('expected old pricing bullet list to be replaced (no duplicates)')
  }
}

export function testWebpageMarkdownPostprocessHandlesCollapsedRemotionPricingBlob() {
  const input = [
    '# Remotion',
    '',
    '## Pricing',
    '',
    'For individuals and companies of up to 3 peopleFree LicenseCreate and automateCommercial use allowedUnlimited useMust upgrade when your team grows For collaborations and companies of 4+ peopleCompany LicenseCreate and automateCommercial use allowedPay according to usagePrioritized Support$250 Mux credits For advanced needsEnterprise LicenseEverything in Company LicensePrivate Slack or DiscordMonthly consulting sessionCustom terms, billing and pricingCompliance formsPrioritized feature requests Starting at $500 per month',
    '',
    '## Trusted by',
    '',
    'Trusted by',
    '',
  ].join('\n')

  const out = postprocessWebpageMarkdownSsot(input)
  const pricing = sliceBetween(out, '## Pricing', '\n## Trusted by')
  if (!pricing.includes('```ascii')) throw new Error('expected pricing to be converted into ascii fence')
  if (!pricing.includes('Free License')) throw new Error('expected Free License in table')
  if (!pricing.includes('Company License')) throw new Error('expected Company License in table')
  if (!pricing.includes('Enterprise License')) throw new Error('expected Enterprise License in table')
  if (!pricing.includes('┌') || !pricing.includes('┬') || !pricing.includes('┐')) throw new Error('expected box drawing borders')
  if (pricing.includes('peopleFree License')) throw new Error('expected collapsed blob to be removed (no duplicates)')
}
