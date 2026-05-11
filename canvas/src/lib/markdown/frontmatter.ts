import { parseMarkdownFrontmatter, splitMarkdownLines } from '../markdown'
import type { Canvas2dRendererId, Canvas3dModeId } from '@/lib/config.render'
import { isPlainObject } from '@/lib/graph/value'
import { hashStringToHexCached } from '@/lib/hash/textHashCache'

export type YamlFrontmatterBlock = {
  rawBlock: string
  yamlText: string
  bodyText: string
}

export type CanvasWorkspaceFrontmatterPreset = {
  canvasSurfaceMode?: '2d' | '3d' | 'geospatial'
  canvasRenderMode?: '2d' | '3d'
  canvas3dMode?: Canvas3dModeId
  canvas2dRenderer?: Canvas2dRendererId
  documentSemanticMode?: 'document' | 'keyword'
  frontmatterModeEnabled?: boolean
  multiDimTableModeEnabled?: boolean
  documentStructureBaselineLock?: boolean
}

const FRONTMATTER_PRESET_CACHE_LIMIT = 48
const frontmatterPresetCache = new Map<string, CanvasWorkspaceFrontmatterPreset | null>()

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

function normalizePresetToken(value: unknown): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_-]+/g, '')
}

function readCanvasSurfaceModePreset(value: unknown): '2d' | '3d' | 'geospatial' | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  if (raw === '2d' || raw === '3d' || raw === 'geospatial') return raw
  const normalized = normalizePresetToken(raw)
  if (normalized === '2d' || normalized === 'mode2d' || normalized === 'surface2d') return '2d'
  if (normalized === '3d' || normalized === 'mode3d' || normalized === 'surface3d') return '3d'
  if (normalized === 'geospatial' || normalized === 'geomode' || normalized === 'geospatialmode' || normalized === 'surfacegeospatial') return 'geospatial'
  return undefined
}

function readCanvasRenderModePreset(value: unknown): '2d' | '3d' | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  if (raw === '2d' || raw === '3d') return raw
  const normalized = normalizePresetToken(raw)
  if (normalized === '2d' || normalized === 'mode2d' || normalized === 'surface2d') return '2d'
  if (normalized === '3d' || normalized === 'mode3d' || normalized === 'surface3d') return '3d'
  return undefined
}

function readCanvas3dModePreset(value: unknown): Canvas3dModeId | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  if (raw === '3d' || raw === 'voxel') return raw
  const normalized = normalizePresetToken(raw)
  if (normalized === '3d' || normalized === 'free3d') return '3d'
  if (normalized === 'voxel' || normalized === 'voxelmode') return 'voxel'
  return undefined
}

function readCanvas2dRendererPreset(value: unknown): Canvas2dRendererId | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  if (
    raw === 'd3' ||
    raw === 'flowchart' ||
    raw === 'flow' ||
    raw === 'flowEditor' ||
    raw === 'design'
  ) {
    return raw as Canvas2dRendererId
  }
  const normalized = normalizePresetToken(raw)
  if (normalized === 'd3' || normalized === 'd3graph') return 'd3'
  if (normalized === 'd3flowchart' || normalized === 'flowchart' || normalized === 'flowchart') return 'flowchart'
  if (normalized === 'flow' || normalized === 'flowcanvas') return 'flow'
  if (normalized === 'floweditor' || normalized === 'edit') return 'flowEditor'
  if (normalized === 'design') return 'design'
  return undefined
}

function readDocumentSemanticModePreset(value: unknown): 'document' | 'keyword' | undefined {
  const raw = String(value || '').trim()
  if (!raw) return undefined
  if (raw === 'document' || raw === 'keyword') return raw
  const normalized = normalizePresetToken(raw)
  if (normalized === 'document' || normalized === 'documentstructure' || normalized === 'documentstructuremode') {
    return 'document'
  }
  if (normalized === 'keyword' || normalized === 'keywordmode') return 'keyword'
  return undefined
}

function readBooleanPreset(value: unknown): boolean | undefined {
  if (typeof value === 'boolean') return value
  const normalized = normalizePresetToken(value)
  if (!normalized) return undefined
  if (normalized === 'true' || normalized === '1' || normalized === 'yes' || normalized === 'on') return true
  if (normalized === 'false' || normalized === '0' || normalized === 'no' || normalized === 'off') return false
  return undefined
}

function coerceCanvasWorkspaceFrontmatterPreset(meta: Record<string, unknown> | null | undefined): CanvasWorkspaceFrontmatterPreset | null {
  if (!meta) return null

  const canvasSurfaceMode = readCanvasSurfaceModePreset(meta.kgCanvasSurfaceMode)
  const canvasRenderMode = readCanvasRenderModePreset(meta.kgCanvasRenderMode)
  const canvas3dMode = readCanvas3dModePreset(meta.kgCanvas3dMode)
  const canvas2dRenderer = readCanvas2dRendererPreset(meta.kgCanvas2dRenderer)
  const documentSemanticMode = readDocumentSemanticModePreset(meta.kgDocumentSemanticMode)
  const frontmatterModeEnabled = readBooleanPreset(meta.kgFrontmatterModeEnabled)
  const multiDimTableModeEnabled = readBooleanPreset(meta.kgMultiDimTableModeEnabled)
  const documentStructureBaselineLock = readBooleanPreset(meta.kgDocumentStructureBaselineLock)

  if (
    canvasSurfaceMode === undefined &&
    canvasRenderMode === undefined &&
    canvas3dMode === undefined &&
    canvas2dRenderer === undefined &&
    documentSemanticMode === undefined &&
    frontmatterModeEnabled === undefined &&
    multiDimTableModeEnabled === undefined &&
    documentStructureBaselineLock === undefined
  ) {
    return null
  }

  return {
    canvasSurfaceMode,
    canvasRenderMode,
    canvas3dMode,
    canvas2dRenderer,
    documentSemanticMode,
    frontmatterModeEnabled,
    multiDimTableModeEnabled,
    documentStructureBaselineLock,
  }
}

export function readCanvasWorkspaceFrontmatterPresetFromMeta(
  meta: Record<string, unknown> | null | undefined,
): CanvasWorkspaceFrontmatterPreset | null {
  return coerceCanvasWorkspaceFrontmatterPreset(meta)
}

export function parseCanvasWorkspaceFrontmatterPreset(rawText: string): CanvasWorkspaceFrontmatterPreset | null {
  const block = extractYamlFrontmatterBlock(rawText)
  if (!block) return null
  const cacheKey = hashStringToHexCached('markdown-frontmatter:preset', block.rawBlock)
  if (frontmatterPresetCache.has(cacheKey)) {
    return frontmatterPresetCache.get(cacheKey) || null
  }
  // Parse only the YAML block so large markdown bodies do not incur full-document line splitting on file switches.
  const parsed = parseMarkdownFrontmatter(splitMarkdownLines(block.rawBlock))
  if (isPlainObject(parsed.meta)) {
    const preset = coerceCanvasWorkspaceFrontmatterPreset(parsed.meta)
    frontmatterPresetCache.set(cacheKey, preset)
    if (frontmatterPresetCache.size > FRONTMATTER_PRESET_CACHE_LIMIT) {
      const oldestKey = frontmatterPresetCache.keys().next().value
      if (typeof oldestKey === 'string') frontmatterPresetCache.delete(oldestKey)
    }
    return preset
  }
  const canvasSurfaceModeRaw = readYamlFrontmatterValue(block.rawBlock, 'kgCanvasSurfaceMode')
  const canvasRenderModeRaw = readYamlFrontmatterValue(block.rawBlock, 'kgCanvasRenderMode')
  const canvas3dModeRaw = readYamlFrontmatterValue(block.rawBlock, 'kgCanvas3dMode')
  const canvas2dRendererRaw = readYamlFrontmatterValue(block.rawBlock, 'kgCanvas2dRenderer')
  const documentSemanticModeRaw = readYamlFrontmatterValue(block.rawBlock, 'kgDocumentSemanticMode')
  const frontmatterModeEnabledRaw = readYamlFrontmatterValue(block.rawBlock, 'kgFrontmatterModeEnabled')
  const multiDimTableModeEnabledRaw = readYamlFrontmatterValue(block.rawBlock, 'kgMultiDimTableModeEnabled')
  const documentStructureBaselineLockRaw = readYamlFrontmatterValue(block.rawBlock, 'kgDocumentStructureBaselineLock')
  const preset = coerceCanvasWorkspaceFrontmatterPreset({
    kgCanvasSurfaceMode: canvasSurfaceModeRaw || undefined,
    kgCanvasRenderMode: canvasRenderModeRaw || undefined,
    kgCanvas3dMode: canvas3dModeRaw || undefined,
    kgCanvas2dRenderer: canvas2dRendererRaw || undefined,
    kgDocumentSemanticMode: documentSemanticModeRaw || undefined,
    kgFrontmatterModeEnabled: readBooleanPreset(frontmatterModeEnabledRaw),
    kgMultiDimTableModeEnabled: readBooleanPreset(multiDimTableModeEnabledRaw),
    kgDocumentStructureBaselineLock: readBooleanPreset(documentStructureBaselineLockRaw),
  })
  frontmatterPresetCache.set(cacheKey, preset)
  if (frontmatterPresetCache.size > FRONTMATTER_PRESET_CACHE_LIMIT) {
    const oldestKey = frontmatterPresetCache.keys().next().value
    if (typeof oldestKey === 'string') frontmatterPresetCache.delete(oldestKey)
  }
  return preset
}

export type WebpageViewMode = 'markdown' | 'json' | 'html'
export type WebpageScriptPolicy = 'strip' | 'allow'
export type WebpageFidelityLevel = 1 | 2 | 3 | 4
export type WebpageFrontmatterMeta = {
  url: string
  view: WebpageViewMode
  siteRootRel?: string
  scriptPolicy?: WebpageScriptPolicy
  fidelityLevel?: WebpageFidelityLevel
  includeImages?: boolean
  hydrate?: boolean
}

export function parseWebpageFrontmatterMeta(rawText: string): WebpageFrontmatterMeta | null {
  const block = extractYamlFrontmatterBlock(rawText)
  if (!block) return null
  const url = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageUrl')
  const viewRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageView')
  if (!url) return null
  const view: WebpageViewMode =
    viewRaw === 'html'
      ? 'html'
      : viewRaw === 'dom'
        ? 'html'
        : viewRaw === 'json'
          ? 'json'
          : viewRaw === 'raw'
            ? 'json'
            : viewRaw
              ? 'markdown'
              : 'html'
  const siteRootRelRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageSiteRootRel')
  const siteRootRel = siteRootRelRaw && siteRootRelRaw.trim() ? siteRootRelRaw.trim() : undefined
  const scriptRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageScriptPolicy')
  const scriptPolicy: WebpageScriptPolicy | undefined = scriptRaw === 'allow' ? 'allow' : scriptRaw === 'strip' ? 'strip' : undefined

  const fidelityRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageFidelityLevel')
  const fidelityParsed = fidelityRaw ? Number.parseInt(fidelityRaw, 10) : NaN
  const fidelityLevel: WebpageFidelityLevel | undefined =
    fidelityParsed === 1 || fidelityParsed === 2 || fidelityParsed === 3 || fidelityParsed === 4 ? fidelityParsed : undefined

  const includeImagesRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageIncludeImages')
  const includeImages: boolean | undefined =
    includeImagesRaw === 'true' ? true : includeImagesRaw === 'false' ? false : undefined

  const hydrateRaw = readYamlFrontmatterValue(block.rawBlock, 'kgWebpageHydrate')
  const hydrate: boolean | undefined = hydrateRaw === 'false' ? false : hydrateRaw === 'true' ? true : undefined

  return { url, view, siteRootRel, scriptPolicy, fidelityLevel, includeImages, hydrate }
}

export function upsertWebpageFrontmatterMeta(rawText: string, meta: WebpageFrontmatterMeta): string {
  const text = String(rawText || '')
  const url = String(meta?.url || '').trim()
  const view: WebpageViewMode = meta?.view === 'html' ? 'html' : meta?.view === 'json' ? 'json' : 'markdown'
  const siteRootRel = String(meta?.siteRootRel || '').trim()
  const scriptPolicy: WebpageScriptPolicy | '' = meta?.scriptPolicy === 'allow' ? 'allow' : meta?.scriptPolicy === 'strip' ? 'strip' : ''
  const fidelityLevel: WebpageFidelityLevel | 0 =
    meta?.fidelityLevel === 1 || meta?.fidelityLevel === 2 || meta?.fidelityLevel === 3 || meta?.fidelityLevel === 4
      ? meta.fidelityLevel
      : 0
  const includeImages: boolean | null =
    meta?.includeImages === true ? true : meta?.includeImages === false ? false : null
  const block = extractYamlFrontmatterBlock(text)
  if (!block) {
    const lines: string[] = []
    lines.push('---')
    lines.push(`kgWebpageUrl: "${url}"`)
    lines.push(`kgWebpageView: "${view}"`)
    if (scriptPolicy) lines.push(`kgWebpageScriptPolicy: "${scriptPolicy}"`)
    if (fidelityLevel) lines.push(`kgWebpageFidelityLevel: "${fidelityLevel}"`)
    if (includeImages != null) lines.push(`kgWebpageIncludeImages: "${includeImages ? 'true' : 'false'}"`)
    if (siteRootRel) lines.push(`kgWebpageSiteRootRel: "${siteRootRel}"`)
    lines.push('---')
    lines.push('')
    return `${lines.join('\n')}${text}`
  }

  const lines = block.rawBlock.split('\n')
  let urlReplaced = false
  let viewReplaced = false
  let scriptPolicyReplaced = false
  let fidelityLevelReplaced = false
  let includeImagesReplaced = false
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
    if (/^\s*kgWebpageScriptPolicy\s*:/.test(line)) {
      scriptPolicyReplaced = true
      return scriptPolicy ? `kgWebpageScriptPolicy: "${scriptPolicy}"` : ''
    }
    if (/^\s*kgWebpageFidelityLevel\s*:/.test(line)) {
      fidelityLevelReplaced = true
      return fidelityLevel ? `kgWebpageFidelityLevel: "${fidelityLevel}"` : ''
    }
    if (/^\s*kgWebpageIncludeImages\s*:/.test(line)) {
      includeImagesReplaced = true
      return includeImages != null ? `kgWebpageIncludeImages: "${includeImages ? 'true' : 'false'}"` : ''
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
    if (scriptPolicy && !scriptPolicyReplaced) nextLines.splice(endIdx, 0, `kgWebpageScriptPolicy: "${scriptPolicy}"`)
    if (fidelityLevel && !fidelityLevelReplaced) nextLines.splice(endIdx, 0, `kgWebpageFidelityLevel: "${fidelityLevel}"`)
    if (includeImages != null && !includeImagesReplaced) {
      nextLines.splice(endIdx, 0, `kgWebpageIncludeImages: "${includeImages ? 'true' : 'false'}"`)
    }
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
