import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3FrontmatterModeDoesNotForceDocumentStructureGroups() {
  const files = [
    ['documentViewMode', resolve(process.cwd(), 'src', 'lib', 'graph', 'documentViewMode.ts')],
    ['sceneDerivation', resolve(process.cwd(), 'src', 'lib', 'scene', 'sceneDerivation.ts')],
    ['graphScene', resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'scene.ts')],
    ['groupsLayer', resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'groups.ts')],
    ['exportHtmlCanvas', resolve(process.cwd(), 'src', 'components', 'BottomPanel', 'markdownWorkspace', 'main', 'exports', 'exportHtmlCanvas.ts')],
    ['htmlCanvasSvgExport', resolve(process.cwd(), 'src', 'lib', 'graph', 'htmlCanvasSvgExport.ts')],
  ] as const

  const documentViewModeText = readFileSync(files[0]![1], 'utf8')
  if (!documentViewModeText.includes('export function readDocumentViewModeContext')) {
    throw new Error('expected documentViewMode to expose the shared document view mode context helper')
  }
  if (!documentViewModeText.includes("forceDocumentStructureGroups: activeDocumentViewMode === 'documentStructure'")) {
    throw new Error('expected shared document-structure group forcing to be derived inside the shared document view mode context helper')
  }

  for (let i = 1; i < files.length; i += 1) {
    const [name, p] = files[i]!
    const text = readFileSync(p, 'utf8')
    if (!text.includes('readDocumentViewModeContext')) {
      throw new Error(`expected ${name} to reuse the shared document view mode context helper`)
    }
    if (text.includes("forceDocumentStructure: args.documentSemanticMode === 'document'")) {
      throw new Error(`expected ${name} to avoid semantic-mode-only document-structure forcing`)
    }
    if (text.includes("forceDocumentStructure: activeDocumentViewMode === 'documentStructure'")) {
      throw new Error(`expected ${name} to stop re-implementing active-mode-based document-structure forcing inline`)
    }
  }
}
