import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function testFlowLabelsScaleWithZoom() {
  const p = resolve(process.cwd(), 'src', 'components', 'FlowCanvas', 'nativeRuntime.ts')
  const text = readFileSync(p, 'utf8')

  if (text.includes('fontSizeWorld = fontSizePx / Math.max(1e-6, k)')) {
    throw new Error('expected Flow labels to scale with zoom (no px->world division)')
  }
  if (text.includes('padX = 6 / Math.max(1e-6, k)') || text.includes('padY = 3 / Math.max(1e-6, k)')) {
    throw new Error('expected Flow edge label padding to scale with zoom (no /k padding)')
  }
  if (text.includes('ctx.font = `${fontSizeWorld}px ${rt.fontFamily}`')) {
    throw new Error('expected Flow labels to use fontSizePx directly')
  }
  if (!text.includes('drawTextHalo(')) {
    throw new Error('expected Flow labels to reuse shared halo text style')
  }
}

