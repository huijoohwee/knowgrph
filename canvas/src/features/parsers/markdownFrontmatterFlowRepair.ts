import { tryParseMarkdownFrontmatterFlowGraph } from '@/features/parsers/markdownFrontmatterFlowGraph.core'

// Repair detection stays intentionally narrow: only parser-backed frontmatter-flow
// string fields that repeat the canonical value for the same element qualify.
// Ordinary edits, renames, and broad raw-text diffs must not trigger repair.
const normalizeString = (value: unknown): string => String(value || '').trim()

const countStringOccurrences = (text: string, needle: string): number => {
  if (!text || !needle) return 0
  let count = 0
  let offset = 0
  while (true) {
    const index = text.indexOf(needle, offset)
    if (index < 0) break
    count += 1
    offset = index + needle.length
  }
  return count
}

const buildFrontmatterFlowElementFieldKey = (elementKind: 'node' | 'edge', elementId: string, fieldKey: string): string =>
  `${elementKind}::${elementId}::${fieldKey}`

const isLikelyRepeatedCanonicalResidue = (currentValue: string, canonicalValue: string): boolean => {
  if (!currentValue || !canonicalValue) return false
  if (currentValue === canonicalValue) return false
  if (currentValue.length <= canonicalValue.length) return false
  if (!currentValue.startsWith(canonicalValue)) return false
  return countStringOccurrences(currentValue, canonicalValue) >= 2
}

const readFrontmatterFlowElementStringFieldMap = (documentName: string, textRaw: string): Map<string, string> => {
  const text = String(textRaw || '')
  if (!text.trim()) return new Map()
  const parsed = tryParseMarkdownFrontmatterFlowGraph(documentName, text)
  const nodes = Array.isArray(parsed?.graphData?.nodes) ? parsed!.graphData.nodes : []
  const edges = Array.isArray(parsed?.graphData?.edges) ? parsed!.graphData.edges : []
  const out = new Map<string, string>()
  for (let i = 0; i < nodes.length; i += 1) {
    const node = nodes[i]
    const id = normalizeString(node?.id)
    if (!id) continue
    const type = normalizeString(node?.type)
    if (type) out.set(buildFrontmatterFlowElementFieldKey('node', id, 'type'), type)
    const label = normalizeString(node?.label)
    if (label) out.set(buildFrontmatterFlowElementFieldKey('node', id, 'label'), label)
    const properties = node?.properties
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) continue
    for (const [propertyKeyRaw, propertyValue] of Object.entries(properties)) {
      const propertyKey = normalizeString(propertyKeyRaw)
      if (!propertyKey || typeof propertyValue !== 'string') continue
      const value = normalizeString(propertyValue)
      if (!value) continue
      out.set(buildFrontmatterFlowElementFieldKey('node', id, `property:${propertyKey}`), value)
    }
  }
  for (let i = 0; i < edges.length; i += 1) {
    const edge = edges[i]
    const id = normalizeString(edge?.id)
    if (!id) continue
    const source = normalizeString(edge?.source)
    if (source) out.set(buildFrontmatterFlowElementFieldKey('edge', id, 'source'), source)
    const target = normalizeString(edge?.target)
    if (target) out.set(buildFrontmatterFlowElementFieldKey('edge', id, 'target'), target)
    const label = normalizeString(edge?.label)
    if (label) out.set(buildFrontmatterFlowElementFieldKey('edge', id, 'label'), label)
    const type = normalizeString(edge?.type)
    if (type) out.set(buildFrontmatterFlowElementFieldKey('edge', id, 'type'), type)
    const sourceHandle = normalizeString(edge?.sourceHandle)
    if (sourceHandle) out.set(buildFrontmatterFlowElementFieldKey('edge', id, 'sourceHandle'), sourceHandle)
    const targetHandle = normalizeString(edge?.targetHandle)
    if (targetHandle) out.set(buildFrontmatterFlowElementFieldKey('edge', id, 'targetHandle'), targetHandle)
    const properties = edge?.properties
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) continue
    for (const [propertyKeyRaw, propertyValue] of Object.entries(properties)) {
      const propertyKey = normalizeString(propertyKeyRaw)
      if (!propertyKey || typeof propertyValue !== 'string') continue
      const value = normalizeString(propertyValue)
      if (!value) continue
      out.set(buildFrontmatterFlowElementFieldKey('edge', id, `property:${propertyKey}`), value)
    }
  }
  return out
}

/**
 * Returns true only when the current frontmatter-flow text appears corrupted by
 * repeated canonical string residue for the same parsed node/edge field.
 *
 * Contract:
 * - compare parsed element string fields, not raw text spans
 * - require stable element identity plus field identity
 * - require the current value to start with and repeat the canonical value
 * - never treat ordinary edits or non-repeated differences as repair candidates
 */
export const frontmatterFlowTextHasRepeatedCanonicalStringResidue = (args: {
  documentName: string
  currentText: string
  canonicalText: string
}): boolean => {
  const documentName = normalizeString(args.documentName) || 'workspace-flow.md'
  const currentText = String(args.currentText || '')
  const canonicalText = String(args.canonicalText || '')
  if (!currentText.trim() || !canonicalText.trim() || currentText === canonicalText) return false
  const currentElementFields = readFrontmatterFlowElementStringFieldMap(documentName, currentText)
  const canonicalElementFields = readFrontmatterFlowElementStringFieldMap(documentName, canonicalText)
  if (currentElementFields.size === 0 || canonicalElementFields.size === 0) return false
  for (const [fieldKey, canonicalValue] of canonicalElementFields.entries()) {
    const currentValue = currentElementFields.get(fieldKey)
    if (!currentValue) continue
    if (isLikelyRepeatedCanonicalResidue(currentValue, canonicalValue)) return true
  }
  return false
}
