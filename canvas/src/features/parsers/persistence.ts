export type CustomParserConfig = {
  id: string
  name: string
  base: 'csv' | 'json' | 'jsonld' | 'n8n'
  match: { mode: 'endsWith' | 'contains' | 'regex'; value: string }
  transforms?: {
    nodeTypeDefault?: string
    edgeLabelDefault?: string
    node?: { typeMap?: Record<string, string>; labelFrom?: string; props?: { pick?: string[]; drop?: string[]; map?: Record<string, string>; mapAgg?: Record<string, { op: 'join' | 'sum' | 'count' | 'first' | 'last' | 'min' | 'max' | 'avg' | 'median' | 'percentile'; path: string; sep?: string; p?: number; method?: 'nearest' | 'linear' | 'tukey' | 'hazen'; type?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }>; set?: Record<string, import('@/lib/graph/types').JSONValue> } }
    edge?: { labelMap?: Record<string, string>; props?: { pick?: string[]; drop?: string[]; map?: Record<string, string>; mapAgg?: Record<string, { op: 'join' | 'sum' | 'count' | 'first' | 'last' | 'min' | 'max' | 'avg' | 'median' | 'percentile'; path: string; sep?: string; p?: number; method?: 'nearest' | 'linear' | 'tukey' | 'hazen'; type?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 }>; set?: Record<string, import('@/lib/graph/types').JSONValue> } }
  }
}

import { LS_KEYS } from '@/lib/config'
import { lsJson, lsSetJson, lsRemove } from '@/lib/persistence'

const PARSER_STORAGE_KEY = LS_KEYS.customParsers

const parseCustomParsers = (raw: unknown): CustomParserConfig[] | null => {
  if (!Array.isArray(raw)) return null
  return raw as CustomParserConfig[]
}

export const readCustomParsers = (): CustomParserConfig[] => {
  return lsJson<CustomParserConfig[]>(PARSER_STORAGE_KEY, [], parseCustomParsers)
}

export const writeCustomParsers = (arr: CustomParserConfig[]) => {
  lsSetJson(PARSER_STORAGE_KEY, arr || [])
}

export const upsertCustomParser = (cfg: CustomParserConfig) => {
  const list = readCustomParsers()
  const idx = list.findIndex(x => x.id === cfg.id)
  if (idx >= 0) list[idx] = cfg; else list.push(cfg)
  writeCustomParsers(list)
  return list
}

export const deleteCustomParser = (id: string) => {
  const list = readCustomParsers().filter(x => x.id !== id)
  writeCustomParsers(list)
  return list
}

export const clearCustomParsers = () => {
  lsRemove(PARSER_STORAGE_KEY)
}
