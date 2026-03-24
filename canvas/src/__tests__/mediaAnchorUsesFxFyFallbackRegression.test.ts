import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testReadNodeCenterWorld2dFallsBackToFxFy() {
  const p = resolve(process.cwd(), 'src', 'lib', 'render', 'mediaAnchor.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('node.fx') && !text.includes('fxRaw')) {
    throw new Error('expected readNodeCenterWorld2d to consider fx/fy when x/y are missing')
  }
  if (!text.includes('node.fy') && !text.includes('fyRaw')) {
    throw new Error('expected readNodeCenterWorld2d to consider fx/fy when x/y are missing')
  }
}
