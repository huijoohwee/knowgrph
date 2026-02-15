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

export function isFrontmatterOnlyDoc(rawText: string): boolean {
  const block = extractYamlFrontmatterBlock(rawText)
  if (!block) return false
  return String(block.bodyText || '').trim().length === 0
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
export type WebpageFrontmatterMeta = { url: string; view: WebpageViewMode; siteRootRel?: string }

export function parseWebpageFrontmatterMeta(rawText: string): WebpageFrontmatterMeta | null {
  const block = extractYamlFrontmatterBlock(rawText)
  if (!block) return null
  const url = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageUrl')
  const viewRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageView')
  const view: WebpageViewMode = viewRaw === 'html' ? 'html' : viewRaw === 'json' ? 'json' : 'markdown'
  if (!url) return null
  const siteRootRelRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageSiteRootRel')
  const siteRootRel = siteRootRelRaw && siteRootRelRaw.trim() ? siteRootRelRaw.trim() : undefined
  return { url, view, siteRootRel }
}

export function upsertWebpageFrontmatterMeta(rawText: string, meta: WebpageFrontmatterMeta): string {
  const text = String(rawText || '')
  const url = String(meta?.url || '').trim()
  const view: WebpageViewMode = meta?.view === 'html' ? 'html' : meta?.view === 'json' ? 'json' : 'markdown'
  const siteRootRel = String(meta?.siteRootRel || '').trim()
  const block = extractYamlFrontmatterBlock(text)
  if (!block) {
    const lines: string[] = []
    lines.push('---')
    lines.push(`kgWebpageUrl: "${url}"`)
    lines.push(`kgWebpageView: "${view}"`)
    if (siteRootRel) lines.push(`kgWebpageSiteRootRel: "${siteRootRel}"`)
    lines.push('---')
    lines.push('')
    return `${lines.join('\n')}${text}`
  }

  const lines = block.rawBlock.split('\n')
  let urlReplaced = false
  let viewReplaced = false
  let siteRootRelReplaced = false
  const nextLines = lines.map(line => {
    if (/^\s*kgWebpageUrl\s*:/.test(line)) {
      urlReplaced = true
      return `kgWebpageUrl: "${url}"`
    }
    if (/^\s*kgWebpageView\s*:/.test(line)) {
      viewReplaced = true
      return `kgWebpageView: "${view}"`
    }
    if (/^\s*kgWebpageSiteRootRel\s*:/.test(line)) {
      siteRootRelReplaced = true
      return siteRootRel ? `kgWebpageSiteRootRel: "${siteRootRel}"` : ''
    }
    return line
  })

  const endIdx = nextLines.lastIndexOf('---')
  if (endIdx > 0) {
    if (!urlReplaced) nextLines.splice(endIdx, 0, `kgWebpageUrl: "${url}"`)
    if (!viewReplaced) nextLines.splice(endIdx, 0, `kgWebpageView: "${view}"`)
    if (siteRootRel && !siteRootRelReplaced) nextLines.splice(endIdx, 0, `kgWebpageSiteRootRel: "${siteRootRel}"`)
  }

  const cleaned = nextLines.filter(l => l.trim() !== '')
  const nextBlock = cleaned.join('\n')
  const suffix = text.slice(block.rawBlock.length)
  return `${nextBlock}${suffix}`

}

export function normalizeWebpageFrontmatterView(rawText: string, view: WebpageViewMode = 'markdown'): string {
  const text = String(rawText || '')
  const block = extractYamlFrontmatterBlock(text)
  if (!block) return text
  const url = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageUrl')
  if (!url) return text

  const nextView: WebpageViewMode = view === 'html' ? 'html' : view === 'json' ? 'json' : 'markdown'
  const lines = block.rawBlock.split('\n')
  let replaced = false
  const nextLines = lines.map(line => {
    if (/^\s*kgWebpageView\s*:/.test(line)) {
      replaced = true
      return `kgWebpageView: "${nextView}"`
    }
    return line
  })
  if (!replaced) {
    const endIdx = nextLines.lastIndexOf('---')
    if (endIdx > 0) nextLines.splice(endIdx, 0, `kgWebpageView: "${nextView}"`)
  }
  const nextBlock = nextLines.join('\n')
  const suffix = text.slice(block.rawBlock.length)
  return `${nextBlock}${suffix}`
}

export type WebsiteImportFrontmatterMeta = { importId: string; nodeId: string; outputDirRel?: string }

export function parseWebsiteImportFrontmatterMeta(rawText: string): WebsiteImportFrontmatterMeta | null {
  const block = extractYamlFrontmatterBlock(rawText)
  if (!block) return null
  const importId = readYamlFrontmatterValue(block.rawBlock, 'kgWebsiteImportId')
  const nodeId = readYamlFrontmatterValue(block.rawBlock, 'kgWebsiteNodeId')
  if (!importId || !nodeId) return null
  const outputDirRelRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebsiteOutputDirRel')
  const outputDirRel = outputDirRelRaw && outputDirRelRaw.trim() ? outputDirRelRaw.trim() : undefined
  return { importId, nodeId, outputDirRel }
}
