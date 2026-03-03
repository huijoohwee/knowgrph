import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testLabelPresentationSsotUsage() {
  const paths = [
    resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'presentation.ts'),
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'layers', 'labels.ts'),
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'sceneHandlers.ts'),
    resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'useGraphCanvasStyles.ts'),
  ]
  for (let i = 0; i < paths.length; i += 1) {
    const p = paths[i]!
    const text = readFileSync(p, 'utf8')
    if (!text.includes('readLabelPresentation2d')) {
      throw new Error(`expected SSOT label presentation usage in ${p}`)
    }
  }
}

