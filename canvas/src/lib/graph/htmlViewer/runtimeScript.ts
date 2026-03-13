import { getKgHtmlViewerRuntimeTemplateB64 } from './runtimeTemplateB64'

const decodeBase64Utf8 = (b64: string): string => {
  const trimmed = String(b64 || '').trim()
  if (!trimmed) return ''
  const buf = (globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc2: string) => string } } })
    .Buffer
  if (buf) return buf.from(trimmed, 'base64').toString('utf8')
  const atobFn = (globalThis as unknown as { atob?: (s: string) => string }).atob
  if (!atobFn) return ''
  const binary = atobFn(trimmed)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  try {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  } catch {
    let out = ''
    for (let i = 0; i < bytes.length; i += 1) out += String.fromCharCode(bytes[i])
    return out
  }
}

const replaceAllExact = (s: string, token: string, replacement: string): string => {
  if (!token) return s
  if (!s.includes(token)) return s
  return s.split(token).join(replacement)
}

const cookTemplateLiteral = (raw: string): string => {
  const src = String(raw || '')
  if (!src) return ''
  const escaped = src.replace(/`/g, '\\`').replace(/\$\{/g, '\\${')
  try {
    return Function('return `' + escaped + '`')() as string
  } catch {
    return src
  }
}

export function buildHtmlViewerRuntimeScript(args: {
  interactionCfgJson: string
  mediaNodesJson: string
  nodeLabelByIdJson: string
  edgeMetaByIdJson: string
  nodePosByIdJson: string
  groupMembersByIdJson: string
  density: 'default' | 'compact'
  widthRatioDefault: number
  widthRatioCompact: number
  widthMinDefault: number
  widthMinCompact: number
  widthMaxDefault: number
  widthMaxCompact: number
}): string {
  const templateRaw = decodeBase64Utf8(getKgHtmlViewerRuntimeTemplateB64())
  const template = cookTemplateLiteral(templateRaw)
  if (!template) return ''

  let out = template
  out = replaceAllExact(out, '__KG_CFG__', args.interactionCfgJson)
  out = replaceAllExact(out, '__KG_MEDIA_NODES__', args.mediaNodesJson)
  out = replaceAllExact(out, '__KG_NODE_META__', args.nodeLabelByIdJson)
  out = replaceAllExact(out, '__KG_EDGE_META__', args.edgeMetaByIdJson)
  out = replaceAllExact(out, '__KG_NODE_POS__', args.nodePosByIdJson)
  out = replaceAllExact(out, '__KG_GROUP_MEMBERS__', args.groupMembersByIdJson)
  out = replaceAllExact(out, '__KG_DENSITY__', JSON.stringify(args.density))
  out = replaceAllExact(out, '__KG_WIDTH_RATIO_DEFAULT__', String(args.widthRatioDefault))
  out = replaceAllExact(out, '__KG_WIDTH_RATIO_COMPACT__', String(args.widthRatioCompact))
  out = replaceAllExact(out, '__KG_WIDTH_MIN_DEFAULT__', String(args.widthMinDefault))
  out = replaceAllExact(out, '__KG_WIDTH_MIN_COMPACT__', String(args.widthMinCompact))
  out = replaceAllExact(out, '__KG_WIDTH_MAX_DEFAULT__', String(args.widthMaxDefault))
  out = replaceAllExact(out, '__KG_WIDTH_MAX_COMPACT__', String(args.widthMaxCompact))
  return out
}
