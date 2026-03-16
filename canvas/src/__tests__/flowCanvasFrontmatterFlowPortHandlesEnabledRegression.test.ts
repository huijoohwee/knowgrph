import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowCanvasFrontmatterFlowEnablesPortHandles() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas.tsx')
  const text = readFileSync(p, 'utf8')

  if (!text.includes("metaKind === 'frontmatter-flow'")) {
    throw new Error('expected FlowCanvas to detect frontmatter-flow graphs')
  }
  if (!text.includes('portHandles') || !text.includes('enabled: true')) {
    throw new Error('expected FlowCanvas to force-enable portHandles for frontmatter-flow graphs')
  }
}

