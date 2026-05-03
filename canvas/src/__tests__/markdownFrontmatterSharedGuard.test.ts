import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { parseCanvasWorkspaceFrontmatterPreset } from '@/lib/markdown/frontmatter'

export const testMarkdownFrontmatterReusesSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'markdown', 'frontmatter.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected markdown frontmatter parsing to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('if (isPlainObject(parsed.meta)) return coerceCanvasWorkspaceFrontmatterPreset(parsed.meta)')) {
    throw new Error('expected markdown frontmatter preset parsing to reuse the shared plain-object guard for parsed metadata')
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
