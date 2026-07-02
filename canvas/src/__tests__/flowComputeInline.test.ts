import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { invalidateFlowComputeSourceCache, readFlowComputeSource, runFlowComputeSource } from '@/lib/storyboardWidget/flowComputeInline'

export const testFlowComputeInlineReusesSharedReaders = () => {
  const filePath = resolve(process.cwd(), 'src', 'lib', 'storyboardWidget', 'flowComputeInline.ts')
  const text = readFileSync(filePath, 'utf8')
  if (!text.includes("import { readNodeProperties } from '@/lib/graph/nodeProperties'")) {
    throw new Error('expected flow compute inline to reuse the shared node properties reader upstream')
  }
  if (!text.includes("import { isPlainObject } from '@/lib/graph/value'")) {
    throw new Error('expected flow compute inline to reuse the shared plain-object guard upstream')
  }
  if (!text.includes('const readPlainObject = (value: unknown): Record<string, unknown> | null => {')) {
    throw new Error('expected flow compute inline to centralize plain-object coercion in one local helper')
  }
  if (!text.includes('const props = readNodeProperties(node)')) {
    throw new Error('expected flow compute source reads to reuse the shared node properties reader')
  }
  if (!text.includes('return readPlainObject(computed)')) {
    throw new Error('expected flow compute runtime output to reuse the shared local plain-object helper')
  }
  if (text.includes('function isRecord(v: unknown): v is Record<string, unknown> {')) {
    throw new Error('expected flow compute inline to stop defining a local record guard')
  }
}

export const testFlowComputeInlineReadsAndRunsSafeCompute = () => {
  invalidateFlowComputeSourceCache()
  const source = readFlowComputeSource({
    id: 'n1',
    type: 'Compute',
    properties: {
      'flow:compute': '(inputs) => ({ result: String(inputs.value || "").toUpperCase() })',
    },
  } as never)
  if (!source) throw new Error('expected flow compute source to be read from shared node properties')
  const computed = runFlowComputeSource(source, { value: 'hello' })
  if (!computed) throw new Error('expected safe flow compute source to run')
  if (computed.result !== 'HELLO') throw new Error(`expected computed.result to be HELLO, got ${String(computed.result)}`)
}

export const testFlowComputeInlineSupportsNeutralComputeContext = () => {
  invalidateFlowComputeSourceCache()
  const source = '(inputs, context) => ({ result: `${context.node.label}:${inputs.value}` })'
  const computed = runFlowComputeSource(source, { value: 42 }, { node: { label: 'Metric' } })
  if (!computed) throw new Error('expected safe flow compute source with context to run')
  if (computed.result !== 'Metric:42') throw new Error(`expected computed.result to include context label, got ${String(computed.result)}`)
}
