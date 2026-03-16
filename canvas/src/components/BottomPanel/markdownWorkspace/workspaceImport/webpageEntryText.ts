import { sanitizeImportedMarkdownText } from '@/lib/markdown/sanitizeImportedMarkdown'
import { upsertWebpageFrontmatterMeta } from '@/lib/markdown/frontmatter'
import { normalizeWebpageCardAndListBlocks } from './htmlTextFallback'
import { yamlBlockScalar, yamlQuote } from './yaml'

export function buildWebpageWorkspaceEntryTextFromUpstreamMarkdown(args: {
  upstreamMarkdown: string
  url: string
  view: 'markdown' | 'json' | 'html'
  title?: string
  diag?: string
  scriptPolicy?: 'strip' | 'allow'
  fidelityLevel?: 1 | 2 | 3 | 4
  includeImages?: boolean
  websiteImportMeta?: { importId: string; nodeId: string; outputDirRel?: string } | null
}): string {
  const url = String(args.url || '').trim()
  const view = args.view === 'html' ? 'html' : args.view === 'json' ? 'json' : 'markdown'
  const scriptPolicy = args.scriptPolicy === 'allow' ? 'allow' : args.scriptPolicy === 'strip' ? 'strip' : ''
  const fidelityLevel =
    args.fidelityLevel === 1 || args.fidelityLevel === 2 || args.fidelityLevel === 3 || args.fidelityLevel === 4
      ? args.fidelityLevel
      : 0
  const includeImages = args.includeImages === true ? true : args.includeImages === false ? false : null
  const upstreamSanitized = sanitizeImportedMarkdownText(String(args.upstreamMarkdown || ''), { sourceUrl: url }).text
  const strippedUpstream = (() => {
    const t = String(upstreamSanitized || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()

  const urlLine = `kgWebpageUrl: ${yamlQuote(url)}`
  const viewLine = `kgWebpageView: ${yamlQuote(view)}`
  const fmLines = ['---', urlLine, viewLine]
  if (scriptPolicy) fmLines.push(`kgWebpageScriptPolicy: ${yamlQuote(scriptPolicy)}`)
  if (fidelityLevel) fmLines.push(`kgWebpageFidelityLevel: ${yamlQuote(String(fidelityLevel))}`)
  if (includeImages != null) fmLines.push(`kgWebpageIncludeImages: ${yamlQuote(includeImages ? 'true' : 'false')}`)

  const importId = String(args.websiteImportMeta?.importId || '').trim()
  const nodeId = String(args.websiteImportMeta?.nodeId || '').trim()
  const outputDirRel = String(args.websiteImportMeta?.outputDirRel || '').trim()
  if (importId) fmLines.push(`kgWebsiteImportId: ${yamlQuote(importId)}`)
  if (nodeId) fmLines.push(`kgWebsiteNodeId: ${yamlQuote(nodeId)}`)
  if (outputDirRel) fmLines.push(`kgWebsiteOutputDirRel: ${yamlQuote(outputDirRel)}`)

  const withView = upsertWebpageFrontmatterMeta(strippedUpstream, { url, view })
  const body = (() => {
    const t = String(withView || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()
  const normalizedBody = normalizeWebpageCardAndListBlocks(body)
  const title = String(args.title || '').replace(/\s+/g, ' ').trim()
  const diag = String(args.diag || '').trim()
  const bodyText = String(normalizedBody || '').trim()
  const sourceLinkLine = url ? `[](${url})` : ''
  const bodyWithSourceLink = sourceLinkLine
    ? bodyText.includes(url)
      ? bodyText
      : [sourceLinkLine, '', bodyText].join('\n').trim()
    : bodyText

  const normalizeLocalProxyUrls = (text: string): string => {
    let next = String(text || '')
    if (!next) return next
    next = next.replace(/\\&/g, '&')
    next = next.replace(
      /https?:\/\/[^\s)]+(\/__(?:webpage_asset_path|webpage_asset_proxy|webpage_proxy|fetch_remote)[^\s)]*)/gi,
      '$1',
    )
    return next
  }

  const normalizeAutolinksToCards = (text: string): string => {
    let next = String(text || '')
    if (!next) return next
    const labelForUrl = (rawUrl: string): string => {
      const uRaw = String(rawUrl || '').trim()
      if (!uRaw) return 'link'
      try {
        const u = new URL(uRaw)
        const host = u.hostname.toLowerCase()
        if (host === 'mp.weixin.qq.com' || host.endsWith('.mp.weixin.qq.com')) return 'WeChat'
        const compact = uRaw.length <= 72 ? uRaw : u.hostname
        return compact || 'link'
      } catch {
        return uRaw.length <= 72 ? uRaw : 'link'
      }
    }

    next = next.replace(/(^|[\s(])!\s*<\s*(https?:\/\/[^>\s]+)\s*>(?=$|[\s)])/g, '$1![]($2)')
    next = next.replace(/(^|[\s(])!\s*(https?:\/\/[^\s)]+)(?=$|[\s)])/g, '$1![]($2)')
    next = next.replace(/<\s*(https?:\/\/[^>\s]+)\s*>/gi, (_m, u: string) => `[${labelForUrl(u)}](${u})`)
    next = next.replace(/\*\*\s*\[\]\((https?:\/\/[^)\s]+)\)/g, (_m, u: string) => `[${labelForUrl(u)}](${u})`)
    next = next.replace(/\[\]\((https?:\/\/[^)\s]+)\)/g, (_m, u: string) => `[${labelForUrl(u)}](${u})`)
    return next
  }

  const finalBody = normalizeLocalProxyUrls(normalizeAutolinksToCards(bodyWithSourceLink))
  if (diag && bodyWithSourceLink && bodyWithSourceLink.length <= 140 && (!title || bodyWithSourceLink.replace(/\s+/g, ' ').trim() === title)) {
    fmLines.push(...yamlBlockScalar('kgWebpageDiagnostics', diag))
  }
  fmLines.push('---', '')
  return [...fmLines, finalBody].join('\n').trimEnd() + '\n'
}

export function buildWebsiteImportWebpageDocFromUpstreamMarkdown(args: {
  upstreamMarkdown: string
  url: string
  view: 'markdown' | 'json' | 'html'
  websiteImportMeta: { importId: string; nodeId: string; outputDirRel?: string }
}): string {
  const url = String(args.url || '').trim()
  const view = args.view === 'html' ? 'html' : args.view === 'json' ? 'json' : 'markdown'
  const upstreamSanitized = sanitizeImportedMarkdownText(String(args.upstreamMarkdown || ''), { sourceUrl: url }).text
  const strippedUpstream = (() => {
    const t = String(upstreamSanitized || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()

  const importId = String(args.websiteImportMeta.importId || '').trim()
  const nodeId = String(args.websiteImportMeta.nodeId || '').trim()
  const outputDirRel = String(args.websiteImportMeta.outputDirRel || '').trim()

  const fmLines = [
    '---',
    `kgWebpageUrl: ${yamlQuote(url)}`,
    `kgWebpageView: ${yamlQuote(view)}`,
    `kgWebsiteImportId: ${yamlQuote(importId)}`,
    `kgWebsiteNodeId: ${yamlQuote(nodeId)}`,
  ]
  if (outputDirRel) fmLines.push(`kgWebsiteOutputDirRel: ${yamlQuote(outputDirRel)}`)
  fmLines.push('---', '')

  const withView = upsertWebpageFrontmatterMeta(strippedUpstream, { url, view })
  const body = (() => {
    const t = String(withView || '')
    if (!t.startsWith('---')) return t
    const end = t.indexOf('\n---')
    if (end < 0) return t
    return t.slice(end + 4).replace(/^\s*\n/, '')
  })()
  const normalizedBody = normalizeWebpageCardAndListBlocks(body)
  return [...fmLines, String(normalizedBody || '').trim()].join('\n').trimEnd() + '\n'
}

