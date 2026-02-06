import type { FlowNativeNodeShape } from '@/components/FlowCanvas/nativeRuntime'

export function coerceFlowNativeNodeShape(args: { shape: FlowNativeNodeShape; forbidCircle: boolean }): FlowNativeNodeShape {
  if (args.forbidCircle && args.shape === 'circle') return 'rect'
  return args.shape
}

