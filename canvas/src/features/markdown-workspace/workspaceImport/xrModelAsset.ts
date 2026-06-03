import {
  compilePngToXrGlb,
  compilePngToXrGltf,
  compileSvgToXrGlb,
  compileSvgToXrGltf,
  type XrGltfCompileResult,
  type XrSvgToGlbCompileResult,
  type XrSvgToGlbInspectReport,
} from '@/lib/xr/xrAssetConversion'
import { buildGlbAssetMarkdown, buildGltfAssetMarkdown, deriveGlbWorkspaceDocumentName, deriveModelWorkspaceDocumentName } from './glbAsset'

export type XrSvgGlbAssetMarkdownResult = {
  markdown: string
  glb: ArrayBuffer
  inspect: XrSvgToGlbInspectReport
}

export type XrGltfAssetMarkdownResult = {
  markdown: string
  gltfText: string
  inspect: XrSvgToGlbInspectReport
}

function deriveXrModelName(sourceName: unknown, format: 'glb' | 'gltf'): string {
  const raw = String(sourceName || '').trim() || 'vector.svg'
  const withoutQuery = raw.split(/[?#]/)[0] || raw
  const fileName = withoutQuery.split(/[\\/]/).filter(Boolean).pop() || withoutQuery
  const base = fileName.replace(/\.(?:svg|png)$/i, '').replace(/\.[a-z0-9]+$/i, '') || 'vector'
  return format === 'glb'
    ? deriveGlbWorkspaceDocumentName(`${base}.glb`)
    : deriveModelWorkspaceDocumentName(`${base}.gltf`, 'gltf')
}

function buildXrModelMetadata(inspect: XrSvgToGlbInspectReport, sourceName: string): Record<string, string | number> {
  const costLog = inspect.costLog
  return {
    kgAssetXrSourceFormat: inspect.sourceFormat,
    kgAssetXrSourceName: sourceName,
    kgAssetXrSourceHash: inspect.sourceHash,
    kgAssetXrSourceWidth: inspect.sourceWidth,
    kgAssetXrSourceHeight: inspect.sourceHeight,
    kgAssetXrDrawCalls: inspect.drawCalls,
    kgAssetXrTriangleCount: inspect.triangleCount,
    kgAssetXrVertexCount: inspect.vertexCount,
    kgAssetXrCostModel: costLog.model,
    kgAssetXrPromptTokens: costLog.prompt_tokens,
    kgAssetXrCompletionTokens: costLog.completion_tokens,
    kgAssetXrCacheHits: costLog.cache_hits,
    kgAssetXrEstimatedCostUsd: costLog.estimated_cost_usd,
  }
}

function buildXrModelBodyLines(inspect: XrSvgToGlbInspectReport, sourceName: string): string[] {
  const costLog = inspect.costLog
  return [
    'XR conversion provenance:',
    `- Source format: ${inspect.sourceFormat.toUpperCase()}`,
    `- Source name: ${sourceName}`,
    `- Source hash: ${inspect.sourceHash}`,
    `- Source viewport: ${inspect.sourceWidth} x ${inspect.sourceHeight}`,
    `- Draw calls: ${inspect.drawCalls}`,
    `- Triangles: ${inspect.triangleCount}`,
    `- Vertices: ${inspect.vertexCount}`,
    `- Token cost: ${costLog.prompt_tokens} prompt / ${costLog.completion_tokens} completion / $${costLog.estimated_cost_usd}`,
  ]
}

function buildXrGlbAssetMarkdownFromCompiled(args: {
  sourceName: string
  sourceKind?: 'local' | 'url'
  sourceUrl?: string | null
  compiled: XrSvgToGlbCompileResult
}): XrSvgGlbAssetMarkdownResult {
  const sourceName = String(args.sourceName || '').trim() || 'vector.svg'
  const markdown = buildGlbAssetMarkdown({
    name: deriveXrModelName(sourceName, 'glb'),
    sourceKind: args.sourceKind || 'local',
    sourceUrl: args.sourceUrl,
    buffer: args.compiled.glb,
    metadata: buildXrModelMetadata(args.compiled.inspect, sourceName),
    bodyLines: buildXrModelBodyLines(args.compiled.inspect, sourceName),
  })
  return {
    markdown,
    glb: args.compiled.glb,
    inspect: args.compiled.inspect,
  }
}

function buildXrGltfAssetMarkdownFromCompiled(args: {
  sourceName: string
  sourceKind?: 'local' | 'url'
  sourceUrl?: string | null
  compiled: XrGltfCompileResult
}): XrGltfAssetMarkdownResult {
  const sourceName = String(args.sourceName || '').trim() || 'vector.svg'
  const markdown = buildGltfAssetMarkdown({
    name: deriveXrModelName(sourceName, 'gltf'),
    sourceKind: args.sourceKind || 'local',
    sourceUrl: args.sourceUrl,
    text: args.compiled.text,
    metadata: buildXrModelMetadata(args.compiled.inspect, sourceName),
    bodyLines: buildXrModelBodyLines(args.compiled.inspect, sourceName),
  })
  return {
    markdown,
    gltfText: args.compiled.text,
    inspect: args.compiled.inspect,
  }
}

export function buildXrSvgGlbAssetMarkdown(args: {
  sourceName: string
  svgText: string
  sourceKind?: 'local' | 'url'
  sourceUrl?: string | null
  targetMaxDimension?: number
}): XrSvgGlbAssetMarkdownResult {
  const sourceName = String(args.sourceName || '').trim() || 'vector.svg'
  const compiled = compileSvgToXrGlb({
    svgText: args.svgText,
    sourceName,
    targetMaxDimension: args.targetMaxDimension,
  })
  return buildXrGlbAssetMarkdownFromCompiled({ sourceName, sourceKind: args.sourceKind, sourceUrl: args.sourceUrl, compiled })
}

export function buildXrSvgGltfAssetMarkdown(args: {
  sourceName: string
  svgText: string
  sourceKind?: 'local' | 'url'
  sourceUrl?: string | null
  targetMaxDimension?: number
}): XrGltfAssetMarkdownResult {
  const sourceName = String(args.sourceName || '').trim() || 'vector.svg'
  const compiled = compileSvgToXrGltf({
    svgText: args.svgText,
    sourceName,
    targetMaxDimension: args.targetMaxDimension,
  })
  return buildXrGltfAssetMarkdownFromCompiled({ sourceName, sourceKind: args.sourceKind, sourceUrl: args.sourceUrl, compiled })
}

export function buildXrPngGlbAssetMarkdown(args: {
  sourceName: string
  bytes: Uint8Array | ArrayBuffer
  sourceKind?: 'local' | 'url'
  sourceUrl?: string | null
  targetMaxDimension?: number
}): XrSvgGlbAssetMarkdownResult {
  const sourceName = String(args.sourceName || '').trim() || 'image.png'
  const compiled = compilePngToXrGlb({
    bytes: args.bytes,
    sourceName,
    targetMaxDimension: args.targetMaxDimension,
  })
  return buildXrGlbAssetMarkdownFromCompiled({ sourceName, sourceKind: args.sourceKind, sourceUrl: args.sourceUrl, compiled })
}

export function buildXrPngGltfAssetMarkdown(args: {
  sourceName: string
  bytes: Uint8Array | ArrayBuffer
  sourceKind?: 'local' | 'url'
  sourceUrl?: string | null
  targetMaxDimension?: number
}): XrGltfAssetMarkdownResult {
  const sourceName = String(args.sourceName || '').trim() || 'image.png'
  const compiled = compilePngToXrGltf({
    bytes: args.bytes,
    sourceName,
    targetMaxDimension: args.targetMaxDimension,
  })
  return buildXrGltfAssetMarkdownFromCompiled({ sourceName, sourceKind: args.sourceKind, sourceUrl: args.sourceUrl, compiled })
}
