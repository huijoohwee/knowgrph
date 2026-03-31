import fs from 'node:fs'

import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph'
import { FLOW_EDGE_SOURCE_PORT_KEY, FLOW_EDGE_TARGET_PORT_KEY } from '@/lib/graph/flowPorts'
import { FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY } from '@/lib/config'

const readTemplatePath = (): string => {
  const v = process.env.KG_TEST_VIDEO_SCRIPT_TEMPLATE_PATH
  return typeof v === 'string' ? v.trim() : ''
}

export function testVideoScriptTemplateFileFrontmatterFlowGraphFidelity() {
  const templatePath = readTemplatePath()
  if (!templatePath) return
  if (!fs.existsSync(templatePath)) return
  const md = fs.readFileSync(templatePath, 'utf8')
  const looksLikeFlowFrontmatter =
    md.trimStart().startsWith('---') && md.includes('\nnodes:\n') && md.includes('\nconnections:\n') && md.includes('\nsocket_types:\n')
  if (!looksLikeFlowFrontmatter) return
  const res = tryParseMarkdownFrontmatterFlowGraph('video-script-template.md', md)
  if (!res) throw new Error('expected frontmatter flow parse result for video-script-template.md')

  const g = res.graphData
  const meta = (g.metadata || {}) as Record<string, unknown>

  const registry = meta[FLOW_NODE_QUICK_EDITOR_REGISTRY_METADATA_KEY]
  if (!Array.isArray(registry) || registry.length < 5) throw new Error('expected quick editor registry metadata')

  const socketTypes = meta.socketTypes
  if (!socketTypes || typeof socketTypes !== 'object') throw new Error('expected socketTypes metadata')
  if (!Object.prototype.hasOwnProperty.call(socketTypes as Record<string, unknown>, 'VIDEO_CLIP')) {
    throw new Error('expected socket_types to include VIDEO_CLIP')
  }

  const e42 = (g.edges || []).find(e => String(e.id || '') === 'e42') || null
  if (!e42) throw new Error('expected edge e42')
  const e42Props = (e42.properties || {}) as Record<string, unknown>
  if (e42Props[FLOW_EDGE_SOURCE_PORT_KEY] !== 'composed_out') throw new Error('expected e42 source port composed_out')
  if (e42Props[FLOW_EDGE_TARGET_PORT_KEY] !== 'clip_04_in') throw new Error('expected e42 target port clip_04_in')
  if (String(e42.type || '') !== 'VIDEO_CLIP') throw new Error('expected e42.type=VIDEO_CLIP')

  const overlay = (g.nodes || []).find(n => String(n.id || '') === 'NODE_OVERLAY_04') || null
  if (!overlay) throw new Error('expected node NODE_OVERLAY_04')
  const overlayProps = (overlay.properties || {}) as Record<string, unknown>
  const portTypes = overlayProps['flow:portTypes']
  if (!portTypes || typeof portTypes !== 'object') throw new Error('expected NODE_OVERLAY_04.flow:portTypes')
  const params = overlayProps.params
  if (!params || typeof params !== 'object') throw new Error('expected NODE_OVERLAY_04.params object')
}
