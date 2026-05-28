import { postprocessWebpageMarkdownSsot } from '@/lib/markdown/webpageMarkdownPostprocess'
import { restoreWebpageMarkdownSyntaxFidelity } from '@/lib/markdown/webpageMarkdownSyntaxFidelity'

function decodeHtmlEntitiesBasic(text: string): string {
  const src = String(text || '')
  if (!src.includes('&')) return src
  return src
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
}

export function htmlFallbackToMarkdownAllText(html: string): string {
  const normalizeBrokenHeadingTags = (input: string): string => {
    let s = String(input || '')
    s = s.replace(/<\s*\/\s*h\s*([1-6])\b/gi, '</h$1')
    s = s.replace(/<\s*h\s*([1-6])\b/gi, '<h$1')
    return s
  }

  const readAttr = (tag: string, name: string): string => {
    const n = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const attrPattern = "\\b" + n + "\\s*=\\s*(?:\"([^\"]*)\"|'([^']*)'|([^\\s\"'=<>`]+))"
    const m = String(tag || '').match(new RegExp(attrPattern, 'i'))
    return decodeHtmlEntitiesBasic(String(m?.[1] || m?.[2] || m?.[3] || '')).trim()
  }

  const src = normalizeBrokenHeadingTags(String(html || '').replace(/\r/g, ''))
  const stripTags = (s: string) => decodeHtmlEntitiesBasic(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

  let out = src
  out = out.replace(/<svg\b[\s\S]*?<\/svg\s*>/gi, '')
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<style\b[\s\S]*?<\/style>/gi, '')
  out = out.replace(/<!--[\s\S]*?-->/g, '')
  out = out.replace(/<img\b[^>]*>/gi, tag => {
    const srcAttr = readAttr(String(tag || ''), 'src') || readAttr(String(tag || ''), 'data-src')
    if (!srcAttr) return ''
    const alt = stripTags(readAttr(String(tag || ''), 'alt') || readAttr(String(tag || ''), 'title'))
    return `\n![${alt}](${srcAttr})\n`
  })
  out = out.replace(/<a\b[^>]*\bhref\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)[^>]*>([\s\S]*?)<\/a\s*>/gi, (match, inner) => {
    const href = readAttr(String(match || ''), 'href')
    const label = stripTags(String(inner || '')) || href
    if (!href) return label
    return `[${label}](${href})`
  })
  out = out.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, inner) => `\n- ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => `\n# ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => `\n## ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `\n### ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, (_, inner) => `\n#### ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h5\b[^>]*>([\s\S]*?)<\/h5>/gi, (_, inner) => `\n##### ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h6\b[^>]*>([\s\S]*?)<\/h6>/gi, (_, inner) => `\n###### ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => `\n\n${stripTags(String(inner || ''))}\n\n`)
  out = decodeHtmlEntitiesBasic(out.replace(/<[^>]+>/g, ''))
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return out
}

export function normalizeWebpageCardAndListBlocks(markdown: string): string {
  try {
    return restoreWebpageMarkdownSyntaxFidelity(postprocessWebpageMarkdownSsot(String(markdown || '')))
  } catch {
    return restoreWebpageMarkdownSyntaxFidelity(String(markdown || ''))
  }
}
