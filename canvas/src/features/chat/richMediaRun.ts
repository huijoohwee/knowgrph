import { getObjectPath } from '@/lib/data/objectPath'
import type { GraphNode } from '@/lib/graph/types'
import type { FlowConnectedValuesBySchemaPath } from '@/lib/flowEditor/flowDataflow'
import {
  FLOW_IMAGE_GENERATION_NODE_TYPE_ID,
  FLOW_VIDEO_GENERATION_NODE_TYPE_ID,
} from '@/lib/config.flow-editor'
import { FLOW_WIDGET_FORM_ID_KEY } from '@/features/flow-editor-manager/resolveWidgetRegistry'
import { downloadBlob, saveBlobWithPicker } from '@/lib/graph/save'
import type {
  GeneratedBinaryAsset,
  RunGenerationConfig,
} from './byteplusRunGeneration'
import {
  generateRunImageWithBytePlus,
  generateRunVideoWithBytePlus,
} from './byteplusRunGeneration'
import {
  resolveWorkspaceSiblingArtifactPath,
  writeWorkspaceBlobArtifactAtPath,
} from './chatHistoryWorkspace.output'
import { buildTextWidgetOutputSrcDoc } from '@/lib/render/widgetOutputSrcDoc'

export type RichMediaWidgetKind = 'image' | 'video'

export type RichMediaWidgetRunRequest = {
  kind: RichMediaWidgetKind
  prompt: string
  model?: string
  contentJson?: string
  aspectRatio?: string
  resolution?: string
  duration?: number
  generateAudio?: boolean
  fast?: boolean
  watermark?: boolean
  referenceImageUrl?: string
}

export type RichMediaWidgetRunResult = {
  kind: RichMediaWidgetKind
  asset: GeneratedBinaryAsset
  outputPath: string | null
}

const DEFAULT_IMAGE_PROMPT = 'Generate an image responsive to the active request.'
const DEFAULT_VIDEO_PROMPT = 'Generate a video responsive to the active request.'

const cleanString = (value: unknown): string => {
  return typeof value === 'string' ? value.trim() : ''
}

const cleanBool = (value: unknown): boolean | null => {
  if (value === true) return true
  if (value === false) return false
  if (typeof value === 'string') {
    const raw = value.trim().toLowerCase()
    if (raw === 'true' || raw === '1' || raw === 'yes' || raw === 'on') return true
    if (raw === 'false' || raw === '0' || raw === 'no' || raw === 'off') return false
  }
  return null
}

const cleanNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value.trim())
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

const sanitizeFileNameStem = (raw: string): string => {
  return String(raw || '')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
}

const extractWorkspaceContext = (markdownText: string): string => {
  const raw = String(markdownText || '').replace(/^\uFEFF/, '')
  if (!raw.trim()) return ''
  const noFrontmatter = raw.trimStart().startsWith('---')
    ? raw.replace(/^\s*---[\s\S]*?\n---\s*/m, '')
    : raw
  const collapsed = noFrontmatter
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/\r\n?/g, '\n')
    .replace(/\n{2,}/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .trim()
  return collapsed.slice(0, 1200)
}

const readConnectedValue = (
  connectedValuesBySchemaPath: FlowConnectedValuesBySchemaPath | undefined,
  schemaPath: string,
): unknown => {
  if (!connectedValuesBySchemaPath) return undefined
  return connectedValuesBySchemaPath[schemaPath]?.value
}

const readNodeProperty = (node: GraphNode, schemaPath: string): unknown => {
  const root = {
    label: node.label,
    type: node.type,
    properties: (node.properties || {}) as Record<string, unknown>,
    metadata: (node.metadata || {}) as Record<string, unknown>,
  }
  return getObjectPath(root, schemaPath)
}

export const resolveRichMediaWidgetKind = (node: GraphNode | null | undefined): RichMediaWidgetKind | null => {
  if (!node) return null
  const typeId = cleanString(node.type)
  if (typeId === FLOW_IMAGE_GENERATION_NODE_TYPE_ID) return 'image'
  if (typeId === FLOW_VIDEO_GENERATION_NODE_TYPE_ID) return 'video'
  const formId = cleanString((node.properties || {})[FLOW_WIDGET_FORM_ID_KEY])
  if (formId === 'imageGeneration') return 'image'
  if (formId === 'videoGeneration') return 'video'
  return null
}

export const clearRichMediaOutputProperties = (properties: Record<string, unknown> | null | undefined): Record<string, unknown> => {
  const next = { ...(properties || {}) }
  delete next.imageUrl
  delete next.videoUrl
  delete next.image_url
  delete next.video_url
  delete next.image
  delete next.video
  delete next.mediaUrl
  delete next.media_url
  delete next.mediaKind
  delete next.media_kind
  delete next.outputPath
  delete next.outputMimeType
  delete next.outputModel
  delete next.outputSourceUrl
  delete next.outputSavedName
  delete next.outputSrcDoc
  delete next.outputLoading
  delete next.outputLoadingKind
  delete next.lastRunAt
  return next
}

export const buildRichMediaWidgetOutputPatch = (args: {
  kind: RichMediaWidgetKind
  asset: GeneratedBinaryAsset
  outputPath: string | null
}): Record<string, unknown> => {
  const isImage = args.kind === 'image'
  return {
    imageUrl: isImage ? args.asset.renderUrl : undefined,
    videoUrl: isImage ? undefined : args.asset.renderUrl,
    image_url: undefined,
    video_url: undefined,
    image: undefined,
    video: undefined,
    mediaUrl: undefined,
    media_url: undefined,
    mediaKind: undefined,
    media_kind: undefined,
    outputPath: args.outputPath || undefined,
    outputMimeType: cleanString(args.asset.blob.type) || undefined,
    outputModel: cleanString(args.asset.model) || undefined,
    outputSourceUrl: cleanString(args.asset.sourceUrl) || undefined,
    lastRunAt: new Date().toISOString(),
  }
}

export const buildTextWidgetOutputPatch = (args: {
  output: string
  title?: unknown
  model?: unknown
}): Record<string, unknown> => {
  const output = String(args.output || '')
  return {
    output,
    outputPath: undefined,
    outputMimeType: 'text/markdown; charset=utf-8',
    outputModel: cleanString(args.model) || undefined,
    outputSourceUrl: undefined,
    outputSavedName: undefined,
    outputSrcDoc: buildTextWidgetOutputSrcDoc({
      title: args.title,
      text: output,
    }),
    lastRunAt: new Date().toISOString(),
  }
}

export const buildRichMediaWidgetRunRequest = (args: {
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  markdownDocumentText?: string | null
}): RichMediaWidgetRunRequest | null => {
  const kind = resolveRichMediaWidgetKind(args.node)
  if (!kind) return null
  const promptValue = cleanString(readNodeProperty(args.node, 'properties.prompt'))
    || cleanString(readConnectedValue(args.connectedValuesBySchemaPath, 'properties.prompt'))
  const contentJson = cleanString(readNodeProperty(args.node, 'properties.content_json'))
  const promptIsGeneric = promptValue === DEFAULT_IMAGE_PROMPT || promptValue === DEFAULT_VIDEO_PROMPT || !promptValue
  const workspaceContext = extractWorkspaceContext(String(args.markdownDocumentText || ''))
  const referenceImageUrl = cleanString(readNodeProperty(args.node, 'properties.reference_image'))
    || cleanString(readConnectedValue(args.connectedValuesBySchemaPath, 'properties.reference_image'))
  const aspectRatio = cleanString(readNodeProperty(args.node, 'properties.aspect_ratio'))
  const resolution = cleanString(readNodeProperty(args.node, 'properties.resolution'))
  const model = cleanString(readNodeProperty(args.node, 'properties.model'))
  const duration = cleanNumber(readNodeProperty(args.node, 'properties.duration'))
  const generateAudio = cleanBool(readNodeProperty(args.node, 'properties.generate_audio'))
  const fast = cleanBool(readNodeProperty(args.node, 'properties.fast'))
  const watermark = cleanBool(readNodeProperty(args.node, 'properties.watermark'))
  const connectedContextLines = Object.entries(args.connectedValuesBySchemaPath || {})
    .filter(([schemaPath, rec]) => schemaPath !== 'properties.prompt' && schemaPath !== 'properties.reference_image' && rec)
    .slice(0, 8)
    .map(([schemaPath, rec]) => {
      const value = typeof rec.value === 'string' ? rec.value : JSON.stringify(rec.value)
      return `${schemaPath.replace(/^properties\./, '')}: ${String(value || '').slice(0, 240)}`
    })
  const promptSections = [
    `Create a single ${kind} deliverable that stays directly responsive to the current user request and connected workflow context.`,
    promptIsGeneric ? '' : `Primary request:\n${promptValue}`,
    workspaceContext ? `Workspace context:\n${workspaceContext}` : '',
    connectedContextLines.length ? `Connected inputs:\n- ${connectedContextLines.join('\n- ')}` : '',
    referenceImageUrl
      ? kind === 'video'
        ? `Use the connected reference image as the first-frame or style anchor: ${referenceImageUrl}`
        : `Use the connected reference image as a composition and style anchor: ${referenceImageUrl}`
      : '',
    kind === 'video'
      ? 'Keep motion coherent, visually specific, and production-ready. Avoid unrelated scene changes, decorative filler, or UI chrome unless requested.'
      : 'Keep the composition visually specific, presentation-ready, and free of unrelated decorative filler or UI chrome unless requested.',
  ].filter(Boolean)
  return {
    kind,
    prompt: promptSections.join('\n\n'),
    ...(model ? { model } : {}),
    ...(contentJson ? { contentJson } : {}),
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(resolution ? { resolution } : {}),
    ...(duration != null ? { duration } : {}),
    ...(generateAudio != null ? { generateAudio } : {}),
    ...(fast != null ? { fast } : {}),
    ...(watermark != null ? { watermark } : {}),
    ...(referenceImageUrl ? { referenceImageUrl } : {}),
  }
}

const buildSuggestedArtifactFileName = (args: {
  workspacePath?: string | null
  node: GraphNode
  kind: RichMediaWidgetKind
  extension: string
}): string => {
  const workspaceBase = cleanString(args.workspacePath).split('/').pop() || ''
  const workspaceStem = workspaceBase.replace(/\.[^.]+$/, '')
  const nodeStem = sanitizeFileNameStem(cleanString(args.node.label) || cleanString(args.node.id) || args.kind)
  const stem = sanitizeFileNameStem([workspaceStem, nodeStem].filter(Boolean).join('-')) || `${args.kind}-asset`
  return `${stem}.${args.extension}`
}

const persistGeneratedAsset = async (args: {
  workspacePath?: string | null
  node: GraphNode
  kind: RichMediaWidgetKind
  extension: string
  asset: GeneratedBinaryAsset
}): Promise<string | null> => {
  const suggestedName = buildSuggestedArtifactFileName({
    workspacePath: args.workspacePath,
    node: args.node,
    kind: args.kind,
    extension: args.extension,
  })
  const siblingPath = resolveWorkspaceSiblingArtifactPath({
    workspacePath: args.workspacePath,
    fileName: suggestedName,
  })
  if (siblingPath) {
    return await writeWorkspaceBlobArtifactAtPath({
      absolutePath: siblingPath,
      blob: args.asset.blob,
    })
  }
  const saved = await saveBlobWithPicker(args.asset.blob, suggestedName, {
    description: args.kind === 'video' ? 'Video Files' : 'Image Files',
    accept: args.kind === 'video'
      ? { 'video/mp4': ['.mp4'] }
      : { 'image/png': ['.png'] },
  })
  if (!saved) downloadBlob(args.asset.blob, suggestedName)
  return null
}

export const runRichMediaWidgetGeneration = async (args: {
  node: GraphNode
  connectedValuesBySchemaPath?: FlowConnectedValuesBySchemaPath
  markdownDocumentText?: string | null
  workspacePath?: string | null
  generationConfig: RunGenerationConfig
}): Promise<RichMediaWidgetRunResult | null> => {
  const request = buildRichMediaWidgetRunRequest(args)
  if (!request) return null
  const asset = request.kind === 'image'
    ? await generateRunImageWithBytePlus({
        config: args.generationConfig,
        prompt: request.prompt,
        options: {
          model: request.model,
          contentJson: request.contentJson,
          aspectRatio: request.aspectRatio,
          resolution: request.resolution,
          referenceImageUrl: request.referenceImageUrl,
        },
      })
    : await generateRunVideoWithBytePlus({
        config: args.generationConfig,
        prompt: request.prompt,
        options: {
          model: request.model,
          aspectRatio: request.aspectRatio,
          resolution: request.resolution,
          duration: request.duration,
          generateAudio: request.generateAudio,
          fast: request.fast,
          watermark: request.watermark,
          referenceImageUrl: request.referenceImageUrl,
        },
      })
  if (!asset) return null
  const outputPath = await persistGeneratedAsset({
    workspacePath: args.workspacePath,
    node: args.node,
    kind: request.kind,
    extension: request.kind === 'video' ? 'mp4' : 'png',
    asset,
  })
  return {
    kind: request.kind,
    asset,
    outputPath,
  }
}
