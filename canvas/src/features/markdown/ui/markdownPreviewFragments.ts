export type MarkdownFragmentConfig = {
  enabled: boolean
  tags: string[]
  classNames: string[]
  steps: number
}

const DEFAULT_FRAGMENT_TAGS = ['v-click', 'v-mark']
const DEFAULT_FRAGMENT_CLASSNAMES = ['fragment']

export const DEFAULT_FRAGMENT_CONFIG: MarkdownFragmentConfig = {
  enabled: false,
  tags: DEFAULT_FRAGMENT_TAGS,
  classNames: DEFAULT_FRAGMENT_CLASSNAMES,
  steps: 0,
}

const normalizeFragmentStringArray = (value: unknown): string[] => {
  if (!value) return []
  if (Array.isArray(value)) {
    const out: string[] = []
    for (const item of value) {
      if (typeof item !== 'string') continue
      const trimmed = item.trim()
      if (trimmed) out.push(trimmed)
    }
    return out
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return []
    return trimmed
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
  }
  return []
}

const parseFragmentSteps = (value: unknown): number => {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return 0
    const n = Math.floor(value)
    return n > 0 ? n : 0
  }
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (!trimmed) return 0
    const n = Number.parseInt(trimmed, 10)
    if (!Number.isFinite(n)) return 0
    const k = Math.floor(n)
    return k > 0 ? k : 0
  }
  return 0
}

export const buildSlideFragmentConfig = (
  headMeta: Record<string, unknown>,
  slideMeta: Record<string, unknown> | null,
): MarkdownFragmentConfig => {
  let enabled = false
  let tags = DEFAULT_FRAGMENT_TAGS
  let classNames = DEFAULT_FRAGMENT_CLASSNAMES
  let steps = 0

  const apply = (record: Record<string, unknown>) => {
    const fragmentsRaw = record.fragments
    if (typeof fragmentsRaw === 'boolean') {
      if (fragmentsRaw) enabled = true
    } else if (fragmentsRaw && typeof fragmentsRaw === 'object' && !Array.isArray(fragmentsRaw)) {
      const fragRecord = fragmentsRaw as Record<string, unknown>
      if (typeof fragRecord.enabled === 'boolean') {
        if (fragRecord.enabled) enabled = true
      }
      const tagsRaw = fragRecord.tags
      const classesRaw = fragRecord.classNames ?? fragRecord.classes
      const tagsList = normalizeFragmentStringArray(tagsRaw)
      const classList = normalizeFragmentStringArray(classesRaw)
      if (tagsList.length) tags = tagsList
      if (classList.length) classNames = classList
      const stepsRaw = fragRecord.steps ?? fragRecord.stepCount
      const parsedSteps = parseFragmentSteps(stepsRaw)
      if (parsedSteps > 0) steps = parsedSteps
    }
    if (typeof record.fragmentEnabled === 'boolean') {
      if (record.fragmentEnabled) enabled = true
    }
    const tagsFromRecord = normalizeFragmentStringArray(record.fragmentTags)
    if (tagsFromRecord.length) tags = tagsFromRecord
    const classFromRecord = normalizeFragmentStringArray(record.fragmentClassNames)
    if (classFromRecord.length) classNames = classFromRecord
    const stepsFromRecord = parseFragmentSteps(record.fragmentSteps ?? record.fragmentStepCount)
    if (stepsFromRecord > 0) steps = stepsFromRecord
  }

  apply(headMeta)
  if (slideMeta) apply(slideMeta)

  if (!enabled || steps <= 0) {
    return DEFAULT_FRAGMENT_CONFIG
  }

  return {
    enabled: true,
    tags: tags.length ? tags : DEFAULT_FRAGMENT_TAGS,
    classNames: classNames.length ? classNames : DEFAULT_FRAGMENT_CLASSNAMES,
    steps,
  }
}

export const normalizeSlideOrder = (prev: number[], slideCount: number): number[] => {
  const n = Math.max(0, slideCount)
  const raw = Array.isArray(prev) ? prev : []
  const normalized = raw.filter(i => Number.isFinite(i) && i >= 0 && i < n)
  const seen = new Set<number>()
  const deduped: number[] = []
  for (const i of normalized) {
    if (seen.has(i)) continue
    seen.add(i)
    deduped.push(i)
  }
  for (let i = 0; i < n; i += 1) {
    if (!seen.has(i)) deduped.push(i)
  }
  return deduped
}
