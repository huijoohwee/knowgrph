import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { resolveCanvas2dRendererId, sharesFlowEditorFrontmatterSyntax } from '@/lib/config.render'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'

export const testMarkdownFrontmatterReusesSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'markdown', 'frontmatter.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected markdown frontmatter parsing to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('if (isPlainObject(parsed.meta)) {')) {
    throw new Error('expected markdown frontmatter preset parsing to branch on the shared plain-object guard for parsed metadata')
  }
  if (!text.includes('const preset = coerceCanvasWorkspaceFrontmatterPreset(parsed.meta)')) {
    throw new Error('expected markdown frontmatter preset parsing to normalize parsed metadata exactly once before caching')
  }
  if (!text.includes("const cacheKey = hashStringToHexCached('markdown-frontmatter:preset', block.rawBlock)")) {
    throw new Error('expected markdown frontmatter preset parsing to reuse a shared text hash cache for identical frontmatter blocks')
  }
  if (text.includes('function isRecord(value: unknown): value is Record<string, unknown> {')) {
    throw new Error('expected markdown frontmatter parsing to stop defining a local record guard')
  }
}

export const testMarkdownFrontmatterParsesCanvasWorkspacePreset = () => {
  const preset = parseCanvasWorkspaceFrontmatterPreset(`---
kgCanvasSurfaceMode: "2d"
kgCanvas2dRenderer: flowEditor
kgFrontmatterModeEnabled: true
kgDocumentSemanticMode: keyword
---`)
  if (!preset) throw new Error('expected canvas workspace frontmatter preset to parse')
  if (preset.canvasSurfaceMode !== '2d') {
    throw new Error(`expected 2d surface mode, got ${String(preset.canvasSurfaceMode)}`)
  }
  if (preset.canvas2dRenderer !== 'flowEditor') {
    throw new Error(`expected flowEditor 2d renderer, got ${String(preset.canvas2dRenderer)}`)
  }
  if (preset.frontmatterModeEnabled !== true || preset.documentSemanticMode !== 'keyword') {
    throw new Error(`expected boolean frontmatter preset flags to persist, got ${JSON.stringify(preset)}`)
  }
}

export const testMarkdownFrontmatterNormalizesCanvasRenderModeAliases = () => {
  const preset = parseCanvasWorkspaceFrontmatterPreset(`---
kgCanvasRenderMode: "Surface 2D"
kgCanvas2dRenderer: "Flow Editor"
---`)
  if (!preset) throw new Error('expected canvas render mode alias preset to parse')
  if (preset.canvasRenderMode !== '2d') {
    throw new Error(`expected Surface 2D alias to normalize to 2d, got ${String(preset.canvasRenderMode)}`)
  }
  if (preset.canvas2dRenderer !== 'flowEditor') {
    throw new Error(`expected Flow Editor alias to normalize to flowEditor, got ${String(preset.canvas2dRenderer)}`)
  }
}

export const testCanvas2dRendererNormalizationSharesAnimationAndFlowEditorSyntaxOwner = () => {
  if (resolveCanvas2dRendererId('Flow Editor') !== 'flowEditor') {
    throw new Error('expected shared renderer normalizer to resolve Flow Editor alias upstream')
  }
  if (resolveCanvas2dRendererId('Timeline Animation') !== 'animation') {
    throw new Error('expected shared renderer normalizer to resolve Timeline Animation alias upstream')
  }
  if (!sharesFlowEditorFrontmatterSyntax('flowEditor')) {
    throw new Error('expected Flow Editor to remain on the shared flow-frontmatter syntax owner')
  }
  if (!sharesFlowEditorFrontmatterSyntax('animation')) {
    throw new Error('expected Animation renderer to reuse the shared Flow Editor frontmatter syntax owner')
  }
  if (sharesFlowEditorFrontmatterSyntax('d3')) {
    throw new Error('expected non-flow renderers to stay outside the shared Flow Editor frontmatter syntax owner')
  }
}

export const testMarkdownFrontmatterCachesPresetByFrontmatterBlock = () => {
  const presetA = parseCanvasWorkspaceFrontmatterPreset(`---
kgCanvasRenderMode: "2d"
kgCanvas2dRenderer: flowEditor
---

# A`)
  const presetB = parseCanvasWorkspaceFrontmatterPreset(`---
kgCanvasRenderMode: "2d"
kgCanvas2dRenderer: flowEditor
---

# B`)
  if (!presetA || !presetB) throw new Error('expected cached canvas workspace presets to parse')
  if (presetA !== presetB) {
    throw new Error('expected identical frontmatter blocks to reuse the cached preset instance')
  }
}
