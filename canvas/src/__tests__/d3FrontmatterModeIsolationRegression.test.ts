import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3FrontmatterModeDoesNotForceDocumentStructureGroups() {
  const files = [
    ['sceneDerivation', resolve(process.cwd(), 'src', 'lib', 'scene', 'sceneDerivation.ts')],
    ['graphScene', resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'scene.ts')],
    ['groupsLayer', resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'groups.ts')],
  ] as const

  for (let i = 0; i < files.length; i += 1) {
    const [name, p] = files[i]!
    const text = readFileSync(p, 'utf8')
    if (!text.includes('resolveActiveDocumentViewMode')) {
      throw new Error(`expected ${name} to use shared active document mode resolver`)
    }
    if (text.includes("forceDocumentStructure: args.documentSemanticMode === 'document'")) {
      throw new Error(`expected ${name} to avoid semantic-mode-only document-structure forcing`)
    }
    if (!text.includes("forceDocumentStructure: activeDocumentViewMode === 'documentStructure'")) {
      throw new Error(`expected ${name} to force document structure only for active document-structure mode`)
    }
  }
}
