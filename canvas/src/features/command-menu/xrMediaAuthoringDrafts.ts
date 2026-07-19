export function reconcileXrTransformNumberDraft(args: Readonly<{
  draftValue: string
  persistedValue: number
  minimum: number
  maximum: number
  commit: (value: number) => boolean
}>): string {
  const draft = String(args.draftValue || '').trim()
  const value = draft ? Number(draft) : Number.NaN
  if (!Number.isFinite(value) || value < args.minimum || value > args.maximum) return String(args.persistedValue)
  return args.commit(value) ? String(value) : String(args.persistedValue)
}

export function reconcileNextSubjectLabelAfterDrop(currentValue: string, committedValue: string | undefined): string {
  const committed = String(committedValue || '').trim()
  return committed && currentValue.trim() === committed ? '' : currentValue
}
