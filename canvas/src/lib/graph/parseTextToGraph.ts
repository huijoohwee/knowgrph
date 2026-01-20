import type { GraphData } from './types'
import { parseGraph } from '@/lib/graph/io/adapter'

export const parseTextToGraph = (name: string, text: string): GraphData | null => {
  return parseGraph(name, text).data
}
