import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testD3AttachTickNotGatedByLabelsSel() {
  const p = resolve(process.cwd(), 'src', 'components', 'GraphCanvas', 'scene.ts')
  const text = readFileSync(p, 'utf8')
  const attachIdx = text.indexOf('attachSimulationTick({')
  if (attachIdx < 0) {
    throw new Error('expected GraphCanvas scene to attachSimulationTick')
  }

  const ifIdx = text.indexOf('if (labelsSelRef.current)')
  if (ifIdx >= 0) {
    const openIdx = text.indexOf('{', ifIdx)
    if (openIdx >= 0) {
      let depth = 0
      let endIdx = -1
      for (let i = openIdx; i < text.length; i += 1) {
        const ch = text[i]
        if (ch === '{') depth += 1
        else if (ch === '}') {
          depth -= 1
          if (depth === 0) {
            endIdx = i
            break
          }
        }
      }
      if (endIdx > openIdx && attachIdx > openIdx && attachIdx < endIdx) {
        throw new Error('GraphCanvas scene must attach simulation tick even when labels are absent')
      }
    }
  }
}
