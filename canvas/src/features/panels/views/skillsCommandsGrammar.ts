import {
  MAIN_PANEL_INVOCATION_SUBJECT_ICON_META_BY_KEY,
  resolveMainPanelInvocationSubjectIconKey,
} from '@/features/panels/ui/mainPanelHelpInvocationIconLibrary'

export type SkillsCommandsGrammarGroupBy = 'object' | 'subject' | 'verb'

export type SkillsCommandsGrammarProjectionInput = Readonly<{
  group?: unknown
  kind?: unknown
  keywords?: readonly unknown[]
  label?: unknown
  sourcePath?: unknown
  summary?: unknown
  token?: unknown
}>

export type SkillsCommandsGrammarFacetValue = Readonly<{
  key: string
  label: string
}>

export type SkillsCommandsGrammarProjection = Readonly<Record<SkillsCommandsGrammarGroupBy, SkillsCommandsGrammarFacetValue>>

const normalizeText = (value: unknown): string => String(value || '').trim().toLowerCase()

const normalizeGrammarKey = (value: string): string => {
  const normalized = normalizeText(value).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
  return normalized || 'unknown'
}

const toTitleLabel = (value: string): string => {
  const words = normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean)
  if (words.length === 0) return 'Unknown'
  return words.map(word => word.length <= 3 ? word.toUpperCase() : `${word[0]?.toUpperCase() || ''}${word.slice(1)}`).join(' ')
}

const toFacetValue = (value: string): SkillsCommandsGrammarFacetValue => {
  const label = toTitleLabel(value)
  return { key: normalizeGrammarKey(label), label }
}

const readTokenBody = (token: unknown): string => String(token || '').trim().replace(/^[/#@]+/, '')

const readDotSegments = (tokenBody: string): string[] => tokenBody.split(/[.:/]+/).map(segment => segment.trim()).filter(Boolean)

const readWords = (value: string): string[] => normalizeText(value).split(/[^a-z0-9]+/).filter(Boolean)

const readSubjectValue = (input: SkillsCommandsGrammarProjectionInput, tokenBody: string): string => {
  const iconKey = resolveMainPanelInvocationSubjectIconKey(input)
  if (!iconKey.startsWith('invocation.prefix.')) {
    return MAIN_PANEL_INVOCATION_SUBJECT_ICON_META_BY_KEY[iconKey].label.replace(/\s+(command|keyword|reference)$/i, '')
  }
  const firstSegment = readDotSegments(tokenBody)[0]
  const firstWord = readWords(firstSegment || tokenBody)[0]
  return firstWord || String(input.label || input.kind || 'invocation')
}

const readVerbValue = (input: SkillsCommandsGrammarProjectionInput, tokenBody: string): string => {
  const token = String(input.token || '').trim()
  const kind = normalizeText(input.kind)
  if (kind === 'skill') return 'invoke'
  if (token.startsWith('#')) return 'tag'
  if (token.startsWith('@')) return 'bind'
  const dotSegments = readDotSegments(tokenBody)
  if (dotSegments.length > 1) return dotSegments[dotSegments.length - 1] || 'run'
  if (kind === 'doc') return 'open'
  if (kind === 'command') return 'run'
  return kind || 'invoke'
}

const readObjectValue = (input: SkillsCommandsGrammarProjectionInput, tokenBody: string): string => {
  const dotSegments = readDotSegments(tokenBody)
  if (dotSegments.length > 2) return dotSegments.slice(1, -1).join(' ')
  if (dotSegments.length === 2) return dotSegments[0] || dotSegments[1] || 'invocation'
  const words = readWords(tokenBody)
  if (words.length > 1) return words.slice(1).join(' ')
  return words[0] || String(input.label || input.kind || 'invocation')
}

export function resolveSkillsCommandsGrammarProjection(input: SkillsCommandsGrammarProjectionInput): SkillsCommandsGrammarProjection {
  const tokenBody = readTokenBody(input.token)
  return {
    subject: toFacetValue(readSubjectValue(input, tokenBody)),
    verb: toFacetValue(readVerbValue(input, tokenBody)),
    object: toFacetValue(readObjectValue(input, tokenBody)),
  }
}
