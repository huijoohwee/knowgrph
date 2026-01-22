import type { ParserSpec, ParserId } from './types'
import { toParserId } from './types'
import type { CustomParserConfig } from './persistence'
import { builtInParsers } from './default'
import { applyTransforms, type TransformConfig, type PropsTransform } from './transform'

const byId = new Map<ParserId, ParserSpec>(builtInParsers.map(p => [p.id, p]))

const resolveBaseParser = (baseId: string): ParserSpec | null => {
  const direct = byId.get(toParserId(baseId))
  if (direct) return direct
  if (baseId === 'json' || baseId === 'csv' || baseId === 'jsonld' || baseId === 'n8n') {
    return byId.get(toParserId('auto')) || null
  }
  return null
}

const buildMatcher = (mode: 'endsWith' | 'contains' | 'regex', value: string) => {
  const v = String(value || '')
  if (mode === 'endsWith') return (name: string) => (name || '').toLowerCase().endsWith(v.toLowerCase())
  if (mode === 'contains') return (name: string, text: string) => {
    const lower = (name || '').toLowerCase()
    return lower.includes(v.toLowerCase()) || (text || '').toLowerCase().includes(v.toLowerCase())
  }
  let re: RegExp | null = null
  try { re = new RegExp(v) } catch { re = null }
  return (_name: string, text: string) => re ? re!.test(text) : false
}

export const toParserSpec = (cfg: CustomParserConfig): ParserSpec | null => {
  const base = resolveBaseParser(cfg.base)
  if (!base) return null
  const matchFn = buildMatcher(cfg.match.mode, cfg.match.value)
  const transforms = cfg.transforms || {}
  const parseFn = (name: string, text: string) => {
    const baseRes = base.parse(name, text)
    let graphData = baseRes.graphData
    if (!graphData.type) graphData.type = 'Graph'
    const warn: string[] = [...(baseRes.warnings || [])]
    if (transforms.nodeTypeDefault) {
      graphData.nodes.forEach(n => { if (!n.type) n.type = transforms.nodeTypeDefault! })
    }
    if (transforms.edgeLabelDefault) {
      graphData.edges.forEach(e => { if (!e.label) e.label = transforms.edgeLabelDefault! })
    }
    const tcfg: TransformConfig | undefined = transforms as unknown as TransformConfig
    graphData = applyTransforms(graphData, tcfg)
    type AggCfg = NonNullable<NonNullable<PropsTransform['mapAgg']>[string]>
    const check = (m?: Record<string, AggCfg>) => {
      if (!m) return
      Object.entries(m).forEach(([k, v]) => {
        const hasType = v && typeof v.type === 'number'
        const hasMethod = v && typeof v.method === 'string'
        if (hasType && hasMethod) warn.push(`mapAgg.${k}: both type and method set; type wins`)
      })
    }
    check(tcfg?.node?.props?.mapAgg as Record<string, AggCfg> | undefined)
    check(tcfg?.edge?.props?.mapAgg as Record<string, AggCfg> | undefined)
    return { graphData, warnings: warn }
  }
  return { id: toParserId(cfg.id), name: cfg.name, match: (n, t) => matchFn(n, t), parse: parseFn }
}
