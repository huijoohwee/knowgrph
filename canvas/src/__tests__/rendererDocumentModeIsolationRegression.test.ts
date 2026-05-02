import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (relativePath: string): string => {
  return readFileSync(resolve(process.cwd(), 'src', ...relativePath.split('/')), 'utf8')
}

export function testRendererDocumentModeIsolationUsesResolvedActiveMode() {
  const documentViewMode = readSource('lib/graph/documentViewMode.ts')
  const graphCanvasRoot = readSource('components/GraphCanvasRoot/GraphCanvasRootImpl.tsx')
  const designCanvasMarkdownGroups = readSource('components/DesignCanvas/useDesignCanvasMarkdownPanelGroups.ts')

  const targets = [
    ['documentViewMode', documentViewMode],
    ['GraphCanvasRoot', graphCanvasRoot],
    ['DesignCanvasMarkdownGroups', designCanvasMarkdownGroups],
  ] as const

  if (!documentViewMode.includes('export function readDocumentViewModeContext')) {
    throw new Error('expected documentViewMode to expose the shared document view mode context helper upstream')
  }
  if (!documentViewMode.includes("const markdownPanelAllowedKinds = activeDocumentViewMode === 'multiDimTable'")) {
    throw new Error('expected shared markdown panel kind gating to be derived inside the shared document view mode context helper')
  }

  for (let i = 1; i < targets.length; i += 1) {
    const [name, text] = targets[i]!
    if (!text.includes('readDocumentViewModeContext({')) {
      throw new Error(`expected ${name} to reuse the shared document view mode context helper`)
    }
    if (text.includes("if (multiDimTableModeEnabled) return ['code', 'blockquote', 'callout', 'html']")) {
      throw new Error(`expected ${name} to avoid raw multi-dimensional table mode gating seepage`)
    }
  }
}
