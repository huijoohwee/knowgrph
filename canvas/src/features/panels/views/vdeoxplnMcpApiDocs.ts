import type { FlowDetails, SettingMeta } from '@/features/settings/types'
import type { VirtualSettingsEntry } from './byteplusSharedTextApiDocs'
import { buildKnowgrphVdeoxplnRegistry } from '@/features/agent-ready/knowgrphVdeoxplnContract.mjs'

export const KNOWGRPH_VDEOXPLN_DOC_AREA = 'Knowgrph Vdeoxpln'

export function getKnowgrphVdeoxplnRowAnchorId(rowKey: string): string {
  const normalized = String(rowKey || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return `knowgrph-vdeoxpln-row-${normalized || 'entry'}`
}

const toBaseType = (): SettingMeta['type'] => 'string'

const buildVdeoxplnValue = (vdeoxpln: ReturnType<typeof buildKnowgrphVdeoxplnRegistry>[number]): string =>
  [
    `id=${vdeoxpln.id}`,
    `semanticKey=${vdeoxpln.semanticKey}`,
    `scope=${vdeoxpln.scope}`,
    `mutation=${vdeoxpln.mutation}`,
    `publishedTools=${vdeoxpln.tools.published.join(',') || 'none'}`,
    `browserLocalTools=${vdeoxpln.tools.browserLocal.join(',') || 'none'}`,
    `localTools=${vdeoxpln.tools.local.join(',') || 'none'}`,
  ].join(' | ')

const buildVdeoxplnDetails = (vdeoxpln: ReturnType<typeof buildKnowgrphVdeoxplnRegistry>[number]): FlowDetails => ({
  area: KNOWGRPH_VDEOXPLN_DOC_AREA,
  responsibility: vdeoxpln.purpose,
  notes: [
    `Contract version: ${vdeoxpln.version}.`,
    `Semantic key: ${vdeoxpln.semanticKey}.`,
    'Generated from the canonical vdeoxpln registry; no compatibility aliases or route-only triggers.',
  ].join(' '),
  modules: vdeoxpln.owners,
  classes: vdeoxpln.outputs,
  functions: [
    ...vdeoxpln.tools.published,
    ...vdeoxpln.tools.browserLocal,
    ...vdeoxpln.tools.local,
  ],
})

export const KNOWGRPH_VDEOXPLN_DOC_ENTRIES: ReadonlyArray<VirtualSettingsEntry> =
  buildKnowgrphVdeoxplnRegistry().map(vdeoxpln => ({
    meta: {
      key: `vdeoxpln.${vdeoxpln.id}`,
      type: toBaseType(),
      source: 'agentReadyVdeoxplnRegistry',
      read: () => buildVdeoxplnValue(vdeoxpln),
    },
    value: buildVdeoxplnValue(vdeoxpln),
    typeLabel: 'vdeoxpln',
    searchHints: [
      'knowgrph vdeoxpln',
      'canonical vdeoxpln registry',
      'agent skills',
      'webmcp',
      'local mcp',
      'source files',
      'floatingpanel chat',
      'kgc',
      'canvas',
      'semantic key',
      vdeoxpln.id,
      vdeoxpln.title,
      ...vdeoxpln.triggers,
    ],
    details: buildVdeoxplnDetails(vdeoxpln),
  }))
