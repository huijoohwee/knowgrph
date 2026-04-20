import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph.core'
import type { GraphNode } from '@/lib/graph/types'
import { captureVisibleCanvasPngBlobFromDom, wrapPngBlobAsSvgMarkup } from '@/lib/graph/svgSnapshot'
import {
  writeKgcCompanionOutputBlob,
  writeKgcCompanionOutputText,
} from './chatHistoryWorkspace.output'

export type KgcRunOutputKind = 'markdown' | 'png' | 'svg' | 'video'

export type KgcRunOutputPreference = {
  kind: KgcRunOutputKind
  extension: 'md' | 'png' | 'svg' | 'mp4'
}

const VIDEO_EXTENSIONS = new Set(['mp4', 'webm', 'mov'])

const readNodeData = (node: GraphNode): Record<string, unknown> => {
  const properties = (node.properties || null) as Record<string, unknown> | null
  const data = properties && typeof properties.data === 'object' && properties.data !== null && !Array.isArray(properties.data)
    ? (properties.data as Record<string, unknown>)
    : null
  return data || {}
}

const extractMarkdownBody = (markdown: string): string => {
  const text = String(markdown || '').replace(/^\uFEFF/, '')
  if (!text.trimStart().startsWith('---')) return text.trim()
  const lines = text.split(/\r?\n/)
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (String(lines[lead] || '').trim() !== '---') return text.trim()
  for (let i = lead + 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() === '---') {
      return lines.slice(i + 1).join('\n').trim()
    }
  }
  return text.trim()
}

const normalizeOutputExtension = (value: string): KgcRunOutputPreference | null => {
  const raw = String(value || '').replace(/^\./, '').trim().toLowerCase()
  if (!raw) return null
  if (raw === 'md' || raw === 'markdown') return { kind: 'markdown', extension: 'md' }
  if (raw === 'png') return { kind: 'png', extension: 'png' }
  if (raw === 'svg') return { kind: 'svg', extension: 'svg' }
  if (raw === 'image' || raw === 'img') return { kind: 'png', extension: 'png' }
  if (raw === 'video' || VIDEO_EXTENSIONS.has(raw)) return { kind: 'video', extension: 'mp4' }
  return null
}

const resolveOutputPreferenceFromNode = (node: GraphNode): KgcRunOutputPreference | null => {
  const data = readNodeData(node)
  const fileValue = String(data.file || '').trim()
  if (fileValue) {
    const match = /\.([a-z0-9]+)$/i.exec(fileValue)
    const fromFile = match?.[1] ? normalizeOutputExtension(String(match[1])) : null
    if (fromFile) return fromFile
  }
  const formatKeys = [
    data.format,
    data.output_type,
    data.outputType,
    data.media_kind,
    data.mediaKind,
  ]
  for (const candidate of formatKeys) {
    const resolved = normalizeOutputExtension(String(candidate || ''))
    if (resolved) return resolved
  }
  if (typeof data.video === 'string' || typeof data.video_url === 'string') {
    return { kind: 'video', extension: 'mp4' }
  }
  if (typeof data.svg === 'string') {
    return { kind: 'svg', extension: 'svg' }
  }
  if (typeof data.image === 'string' || typeof data.image_url === 'string') {
    return { kind: 'png', extension: 'png' }
  }
  return null
}

export const resolveKgcRunOutputPreference = (args: {
  canonicalPath: string
  canonicalText: string
}): KgcRunOutputPreference => {
  const parsed = tryParseMarkdownFrontmatterFlowGraph(args.canonicalPath.split('/').pop() || 'kgc.md', args.canonicalText)
  const nodes = Array.isArray(parsed?.graphData?.nodes) ? parsed!.graphData.nodes : []
  for (const node of nodes) {
    if (String(node?.type || '').trim().toLowerCase() !== 'output') continue
    const resolved = resolveOutputPreferenceFromNode(node as GraphNode)
    if (resolved) return resolved
  }
  return { kind: 'markdown', extension: 'md' }
}

export const emitKgcRunOutput = async (args: {
  canonicalPath: string
  canonicalText: string
  getStore: () => {
    captureCanvasPngSnapshot: () => Promise<Blob | null>
    captureCanvasSvgSnapshot: () => Promise<string | null>
  }
}): Promise<{ path: string | null; kind: KgcRunOutputKind; degraded: boolean }> => {
  const preference = resolveKgcRunOutputPreference(args)
  if (preference.kind === 'markdown') {
    const path = await writeKgcCompanionOutputText({
      workspacePath: args.canonicalPath,
      extension: 'md',
      text: extractMarkdownBody(args.canonicalText),
    })
    return { path, kind: 'markdown', degraded: false }
  }
  if (preference.kind === 'png') {
    const rawPng = (await args.getStore().captureCanvasPngSnapshot()) || (await captureVisibleCanvasPngBlobFromDom())
    if (!rawPng) return { path: null, kind: 'png', degraded: false }
    const pngBlob = String(rawPng.type || '').trim() === 'image/png'
      ? rawPng
      : new Blob([await rawPng.arrayBuffer()], { type: 'image/png' })
    const path = await writeKgcCompanionOutputBlob({
      workspacePath: args.canonicalPath,
      extension: 'png',
      blob: pngBlob,
    })
    return { path, kind: 'png', degraded: false }
  }
  if (preference.kind === 'svg') {
    const rawSvg = String(await args.getStore().captureCanvasSvgSnapshot() || '').trim()
    if (rawSvg) {
      const path = await writeKgcCompanionOutputText({
        workspacePath: args.canonicalPath,
        extension: 'svg',
        text: rawSvg,
      })
      return { path, kind: 'svg', degraded: false }
    }
    const rawPng = (await args.getStore().captureCanvasPngSnapshot()) || (await captureVisibleCanvasPngBlobFromDom())
    if (!rawPng) return { path: null, kind: 'svg', degraded: false }
    const wrappedSvg = await wrapPngBlobAsSvgMarkup(rawPng, { includeXmlDeclaration: true })
    if (!String(wrappedSvg || '').trim()) return { path: null, kind: 'svg', degraded: false }
    const path = await writeKgcCompanionOutputText({
      workspacePath: args.canonicalPath,
      extension: 'svg',
      text: wrappedSvg,
    })
    return { path, kind: 'svg', degraded: false }
  }
  const path = await writeKgcCompanionOutputText({
    workspacePath: args.canonicalPath,
    extension: 'md',
    text: extractMarkdownBody(args.canonicalText),
  })
  return { path, kind: 'video', degraded: true }
}
