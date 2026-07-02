import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { applyFlowDataflowTransform } from '@/lib/storyboardWidget/flowDataflowTransforms'

export const testFlowDataflowTransformsReusesSharedPlainObjectGuard = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'storyboardWidget', 'flowDataflowTransforms.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected flow dataflow transforms to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected flow dataflow transforms to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const record = readPlainObject(v)')) {
    throw new Error('expected flow dataflow transforms rgb parsing to reuse the shared local plain-object helper')
  }
  if (text.includes('function isRecord(v: unknown): v is Record<string, unknown> {')) {
    throw new Error('expected flow dataflow transforms to stop defining a local record guard')
  }
}

export const testFlowDataflowTransformsRgbCssSupportsObjectInput = () => {
  const value = applyFlowDataflowTransform({
    transformId: 'rgb_css',
    value: { red: 255, green: 0, blue: 128 },
  })
  if (value !== 'rgb(255, 0, 128)') {
    throw new Error(`expected rgb_css object input to produce rgb(255, 0, 128), got ${String(value)}`)
  }
}
