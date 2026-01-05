import type { GraphData } from '@/lib/graph/types'

declare const parserIdBrand: unique symbol

export type ParserId = string & { readonly [parserIdBrand]: true }

export const toParserId = (id: string): ParserId => id as ParserId

export type ParserSpec = {
  id: ParserId
  name: string
  match: (name: string, text: string) => boolean
  parse: (name: string, text: string) => { graphData: GraphData; warnings: string[] }
  parseAsync?: (name: string, text: string) => Promise<{ graphData: GraphData; warnings: string[] }>
}

export type ParseInput = { name: string; text: string }

export type ParseResult = { graphData: GraphData; warnings: string[] }
