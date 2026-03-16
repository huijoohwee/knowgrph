import { postprocessWebpageMarkdownSsot } from '@/lib/markdown/webpageMarkdownPostprocess'

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
  const src = String(html || '').replace(/\r/g, '')
  const stripTags = (s: string) => decodeHtmlEntitiesBasic(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()

  let out = src
  out = out.replace(/<script\b[\s\S]*?<\/script>/gi, '')
  out = out.replace(/<style\b[\s\S]*?<\/style>/gi, '')
  out = out.replace(/<!--[\s\S]*?-->/g, '')
  out = out.replace(/<br\s*\/?>/gi, '\n')
  out = out.replace(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi, (_, inner) => `\n# ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_, inner) => `\n## ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, (_, inner) => `\n### ${stripTags(String(inner || ''))}\n`)
  out = out.replace(/<p\b[^>]*>([\s\S]*?)<\/p>/gi, (_, inner) => `\n\n${stripTags(String(inner || ''))}\n\n`)
  out = decodeHtmlEntitiesBasic(out.replace(/<[^>]+>/g, ''))
  out = out.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return out
}

export function normalizeWebpageCardAndListBlocks(markdown: string): string {
  try {
    return postprocessWebpageMarkdownSsot(String(markdown || ''))
  } catch {
    return String(markdown || '')
  }
}

