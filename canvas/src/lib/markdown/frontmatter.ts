export type YamlFrontmatterBlock = {
  rawBlock: string
  yamlText: string
  bodyText: string
}

export function extractYamlFrontmatterBlock(rawText: string): YamlFrontmatterBlock | null {
  const text = String(rawText || '')
  if (!text.startsWith('---')) return null
  const end = text.indexOf('\n---')
  if (end < 0) return null
  const rawBlock = text.slice(0, end + 4)
  const yamlText = rawBlock.replace(/^---\s*\n?/, '').replace(/\n---\s*$/, '')
  const bodyText = text.slice(end + 4).replace(/^\s*\n/, '')
  return { rawBlock, yamlText, bodyText }
}

export function readYamlFrontmatterValue(fmBlock: string, key: string): string {
  const fm = String(fmBlock || '')
  const k = String(key || '').trim()
  if (!fm || !k) return ''
  const m = fm.match(new RegExp(`^${k}:\\s*(.+)\\s*$`, 'm'))
  const v = m ? String(m[1] || '').trim() : ''
  if (!v) return ''
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) return v.slice(1, -1)
  return v
}

export type WebpageViewMode = 'markdown' | 'json' | 'html'
export type WebpageFrontmatterMeta = { url: string; view: WebpageViewMode }

export function parseWebpageFrontmatterMeta(rawText: string): WebpageFrontmatterMeta | null {
  const block = extractYamlFrontmatterBlock(rawText)
  if (!block) return null
  const url = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageUrl')
  const viewRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageView')
  const view: WebpageViewMode = viewRaw === 'html' ? 'html' : viewRaw === 'json' ? 'json' : 'markdown'
  if (!url) return null
  return { url, view }
}

export function upsertWebpageFrontmatterMeta(rawText: string, meta: WebpageFrontmatterMeta): string {
  const text = String(rawText || '')
  const url = String(meta?.url || '').trim()
  const view: WebpageViewMode = meta?.view === 'html' ? 'html' : meta?.view === 'json' ? 'json' : 'markdown'
  const block = extractYamlFrontmatterBlock(text)
  const bodyText = block ? block.bodyText : text.replace(/^---[\s\S]*?\n---\s*\n?/, '')
  const lines: string[] = []
  lines.push('---')
  lines.push(`kgWebpageUrl: "${url}"`)
  lines.push(`kgWebpageView: "${view}"`)
  lines.push('---')
  lines.push('')
  return `${lines.join('\n')}${bodyText}`
}
