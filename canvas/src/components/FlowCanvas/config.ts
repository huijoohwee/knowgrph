import type { GraphSchema } from '@/lib/graph/schema'
import { readFlowLayoutKnobs, type FlowLayoutKnobs } from '@/lib/graph/layoutDefaults'

export type FlowConfig = FlowLayoutKnobs

export function readFlowConfig(args: { schema: GraphSchema | null; rankdir: 'TB' | 'LR' }): FlowConfig {
  return readFlowLayoutKnobs(args)
}
