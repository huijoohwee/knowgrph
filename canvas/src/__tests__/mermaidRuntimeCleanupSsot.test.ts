import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testMermaidRuntimeCleanupReusesSharedHelpers() {
  const runtimePath = resolve(process.cwd(), 'src', 'lib', 'mermaid', 'mermaidRuntime.ts')
  const svgPath = resolve(process.cwd(), 'src', 'lib', 'mermaid', 'mermaidSvg.ts')
  const previewPath = resolve(process.cwd(), 'src', 'lib', 'panels', 'views', 'preview-panel', 'ui', 'MermaidDiagram.impl.tsx')
  const plainPath = resolve(process.cwd(), 'src', 'features', 'markdown', 'ui', 'PlainMermaidDiagram.tsx')

  const runtimeText = readFileSync(runtimePath, 'utf8')
  const svgText = readFileSync(svgPath, 'utf8')
  const previewText = readFileSync(previewPath, 'utf8')
  const plainText = readFileSync(plainPath, 'utf8')

  if (!runtimeText.includes('export const renderMermaidWithRuntime = async')) {
    throw new Error('expected mermaidRuntime SSOT to expose shared renderMermaidWithRuntime helper')
  }
  if (!runtimeText.includes('flowchart.htmlLabels = false')) {
    throw new Error('expected mermaidRuntime SSOT to force Mermaid runtime rendering onto plain SVG labels')
  }
  if (!svgText.includes("import { renderMermaidWithRuntime } from '@/lib/mermaid/mermaidRuntime'")) {
    throw new Error('expected mermaidSvg cached renderer to import shared renderMermaidWithRuntime helper')
  }
  if (!svgText.includes('export const sanitizeMermaidSvg =')) {
    throw new Error('expected mermaidSvg SSOT to expose shared sanitizeMermaidSvg helper')
  }
  if (!svgText.includes('export const extractMermaidErrorFromSvg =')) {
    throw new Error('expected mermaidSvg SSOT to expose shared extractMermaidErrorFromSvg helper')
  }
  if (!svgText.includes('export const postprocessMermaidSvg =')) {
    throw new Error('expected mermaidSvg SSOT to expose shared postprocessMermaidSvg helper')
  }
  if (!previewText.includes("import { renderMermaidWithRuntime } from '@/lib/mermaid/mermaidRuntime'")) {
    throw new Error('expected MermaidDiagram preview runtime to reuse shared renderMermaidWithRuntime helper')
  }
  if (!previewText.includes("import { postprocessMermaidSvg } from '@/lib/mermaid/mermaidSvg'")) {
    throw new Error('expected MermaidDiagram preview runtime to reuse shared Mermaid SVG postprocess helper')
  }
  if (!previewText.includes('const processed = postprocessMermaidSvg(out.svg)')) {
    throw new Error('expected MermaidDiagram preview runtime to postprocess Mermaid SVG through shared helper')
  }
  if (!previewText.includes('const rawBounds = parseSvgBounds(nextSvg)')) {
    throw new Error('expected MermaidDiagram preview runtime to derive SVG bounds from parsed markup instead of live SVG geometry APIs')
  }
  if (previewText.includes('svgEl.getBBox()')) {
    throw new Error('expected MermaidDiagram preview runtime to avoid live getBBox() calls that can fail on relative SVG lengths')
  }
  if (previewText.includes('out.bindFunctions(host)')) {
    throw new Error('expected MermaidDiagram preview runtime to avoid rebinding Mermaid DOM behaviors onto the React-managed host subtree')
  }
  if (!plainText.includes("import { postprocessMermaidSvg, renderPlainMermaidSvgCached } from '@/lib/mermaid/mermaidSvg'")) {
    throw new Error('expected PlainMermaidDiagram to reuse shared cached Mermaid SVG postprocess helper')
  }
  if (!plainText.includes('const processed = postprocessMermaidSvg(out.svg)')) {
    throw new Error('expected PlainMermaidDiagram to postprocess Mermaid SVG through shared helper')
  }
}
