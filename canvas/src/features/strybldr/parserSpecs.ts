import type { ParserSpec } from '@/features/parsers/types'
import { toParserId } from '@/features/parsers/types'
import {
  buildStrybldrGraphData,
  isStrybldrStoryboardMarkdown,
  parseStrybldrStoryboardMarkdown,
} from './strybldrStoryboard'

export const strybldrStoryboardSpec: ParserSpec = {
  id: toParserId('strybldr-storyboard'),
  name: 'Strybldr Storyboard',
  match: (_name, text) => isStrybldrStoryboardMarkdown(text),
  parse: (_name, text) => {
    const doc = parseStrybldrStoryboardMarkdown(text)
    if (!doc) {
      return {
        graphData: { context: 'strybldr-storyboard', type: 'Graph', nodes: [], edges: [] },
        warnings: ['Strybldr storyboard payload was not parseable'],
      }
    }
    return {
      graphData: buildStrybldrGraphData(doc),
      warnings: [],
    }
  },
}

export const strybldrParsers: ParserSpec[] = [strybldrStoryboardSpec]
