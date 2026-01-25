import { coerceMediaUrl } from '@/lib/url'
import { normalizeImportName } from '@/features/toolbar/ingestUtils'

export const testCoerceMediaUrlAcceptsSafeRelative = () => {
  const cases = ['assets/x.png', './assets/x.png', '../assets/x.png', 'images/x.svg', 'video/x.mp4']
  for (const raw of cases) {
    const out = coerceMediaUrl(raw)
    if (out !== raw) throw new Error(`expected coerceMediaUrl to accept relative url: ${raw}`)
  }
}

export const testCoerceMediaUrlRejectsExplicitScheme = () => {
  const cases = ['javascript:alert(1)', 'file:///etc/passwd', 'data:text/html,hi', 'mailto:test@example.com']
  for (const raw of cases) {
    const out = coerceMediaUrl(raw)
    if (out != null) throw new Error(`expected coerceMediaUrl to reject scheme url: ${raw}`)
  }
}

export const testNormalizeImportNameDerivesJsonNameFromUrlAndFormat = () => {
  const a = normalizeImportName('https://example.com/data.json?x=1', 'remote.json', 'json', 'json')
  if (a !== 'data.json') throw new Error(`expected data.json, got ${a}`)

  const b = normalizeImportName('https://example.com/data.json?x=1', 'remote.jsonld', 'json', 'jsonld')
  if (b !== 'data.jsonld') throw new Error(`expected data.jsonld, got ${b}`)

  const c = normalizeImportName('not a url', 'remote.json', 'json', 'json')
  if (c !== 'remote.json') throw new Error(`expected fallback name, got ${c}`)
}
