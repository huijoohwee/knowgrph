import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const readSource = (relativePath: string): string => {
  return readFileSync(resolve(process.cwd(), 'src', ...relativePath.split('/')), 'utf8')
}

export function testRendererDocumentModeIsolationUsesResolvedActiveMode() {
  const flowCanvas = readSource('components/FlowCanvas.tsx')
  const graphCanvasRoot = readSource('components/GraphCanvasRoot/GraphCanvasRootImpl.tsx')
  const designCanvas = readSource('components/DesignCanvas.tsx')

  const targets = [
    ['FlowCanvas', flowCanvas],
    ['GraphCanvasRoot', graphCanvasRoot],
    ['DesignCanvas', designCanvas],
  ] as const

  for (let i = 0; i < targets.length; i += 1) {
    const [name, text] = targets[i]!
    if (!text.includes('resolveActiveDocumentViewMode')) {
      throw new Error(`expected ${name} to use shared active document view mode resolver`)
    }
    if (text.includes("if (multiDimTableModeEnabled) return ['code', 'blockquote', 'callout', 'html']")) {
      throw new Error(`expected ${name} to avoid raw multi-dimensional table mode gating seepage`)
    }
    if (!text.includes("activeDocumentViewMode === 'multiDimTable'")) {
      throw new Error(`expected ${name} to gate table overlays by resolved active document mode`)
    }
  }
}
