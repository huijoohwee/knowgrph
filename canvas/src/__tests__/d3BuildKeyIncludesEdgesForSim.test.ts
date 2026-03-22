import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3SceneBuildKeyIncludesEdgesForSimLength() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas.tsx')
  const text = readFileSync(p, 'utf8')
  const ok = /\$\{String\(edgesForSim\.length\)\}/m.test(text)
  if (!ok) {
    throw new Error('expected GraphCanvas scene buildKey to include edgesForSim.length')
  }
}
