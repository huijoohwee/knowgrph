import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testStrictOverlapDoesNotRunWhenSettled() {
  const p = resolve(process.cwd(), 'src', 'lib', 'graph', 'physics2dTuning.ts')
  const text = readFileSync(p, 'utf8')
  if (!text.includes('if (alpha < 0.055) return 0')) {
    throw new Error('expected strict overlap relax to be gated off at low alpha')
  }
}
