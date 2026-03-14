import type { WebpageFrontmatterMeta, WebpageViewMode, WebsiteImportFrontmatterMeta, YamlFrontmatterBlock } from '@/lib/markdown/frontmatter'
import { readYamlFrontmatterValue } from '@/lib/markdown/frontmatter'

export function normalizeWebpageViewFromFrontmatterValue(viewRaw: string): WebpageViewMode {
  if (viewRaw === 'html') return 'html'
  if (viewRaw === 'dom') return 'html'
  if (viewRaw === 'json') return 'json'
  if (viewRaw === 'raw') return 'json'
  if (viewRaw === 'markdown') return 'markdown'
  return 'markdown'
}

export function deriveWebpageFrontmatterMetaFromBlock(block: YamlFrontmatterBlock | null): WebpageFrontmatterMeta | null {
  if (!block) return null
  const url = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageUrl')
  if (!url) return null
  const viewRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageView')
  const view = normalizeWebpageViewFromFrontmatterValue(viewRaw)

  const siteRootRelRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageSiteRootRel')
  const siteRootRel = siteRootRelRaw && siteRootRelRaw.trim() ? siteRootRelRaw.trim() : undefined
  const scriptRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageScriptPolicy')
  const scriptPolicy = scriptRaw === 'allow' ? 'allow' : scriptRaw === 'strip' ? 'strip' : undefined

  const fidelityRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageFidelityLevel')
  const fidelityParsed = fidelityRaw ? Number.parseInt(fidelityRaw, 10) : NaN
  const fidelityLevel = fidelityParsed === 1 || fidelityParsed === 2 || fidelityParsed === 3 || fidelityParsed === 4 ? fidelityParsed : undefined

  const includeImagesRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageIncludeImages')
  const includeImages = includeImagesRaw === 'true' ? true : includeImagesRaw === 'false' ? false : undefined

  return { url, view, siteRootRel, scriptPolicy, fidelityLevel, includeImages }
}

export function deriveWebsiteImportFrontmatterMetaFromBlock(block: YamlFrontmatterBlock | null): WebsiteImportFrontmatterMeta | null {
  if (!block) return null
  const importId = readYamlFrontmatterValue(block.rawBlock, 'kgWebsiteImportId')
  const nodeId = readYamlFrontmatterValue(block.rawBlock, 'kgWebsiteNodeId')
  if (!importId || !nodeId) return null
  const outputDirRelRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebsiteOutputDirRel')
  const outputDirRel = outputDirRelRaw && outputDirRelRaw.trim() ? outputDirRelRaw.trim() : undefined
  return { importId, nodeId, outputDirRel }
}

export function shouldRenderWebpageIframe(meta: WebpageFrontmatterMeta | null): boolean {
  return !!(meta && meta.url && (meta.view === 'html' || meta.view === 'json'))
}

