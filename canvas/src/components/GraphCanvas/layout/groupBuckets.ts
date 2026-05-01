export type GroupBucketLayoutMeta = {
  depth?: number
  xIndex?: number
  yIndex?: number
}

export function pushGroupBucketMember(
  bucketsByKey: Map<string, string[]>,
  bucketKey: string,
  memberNodeId: unknown,
): void {
  const key = String(bucketKey || '').trim()
  const nodeId = String(memberNodeId || '').trim()
  if (!key || !nodeId) return
  const current = bucketsByKey.get(key)
  if (current) current.push(nodeId)
  else bucketsByKey.set(key, [nodeId])
}

export function finalizeGroupBucketMemberNodeIds(memberNodeIds: ReadonlyArray<string>): string[] {
  return Array.from(new Set(memberNodeIds.map(id => String(id || '').trim()).filter(Boolean))).sort((a, b) => a.localeCompare(b))
}

export function readUpdatedBucketLayoutMeta(
  current: GroupBucketLayoutMeta | undefined,
  args: {
    bucketValue?: unknown
    explicitDepth?: unknown
    xIndex?: unknown
    yIndex?: unknown
  },
): GroupBucketLayoutMeta {
  const next: GroupBucketLayoutMeta = { ...(current || {}) }

  const bucketDepth =
    typeof args.bucketValue === 'number' && Number.isFinite(args.bucketValue)
      ? args.bucketValue
      : undefined
  const explicitDepth =
    typeof args.explicitDepth === 'number' && Number.isFinite(args.explicitDepth)
      ? args.explicitDepth
      : undefined
  const xIndex = typeof args.xIndex === 'number' && Number.isFinite(args.xIndex) ? args.xIndex : undefined
  const yIndex = typeof args.yIndex === 'number' && Number.isFinite(args.yIndex) ? args.yIndex : undefined

  const depthCandidates = [next.depth, bucketDepth, explicitDepth].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  if (depthCandidates.length > 0) next.depth = Math.max(...depthCandidates)

  const xCandidates = [next.xIndex, xIndex].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  if (xCandidates.length > 0) next.xIndex = Math.max(...xCandidates)

  const yCandidates = [next.yIndex, yIndex].filter(
    (value): value is number => typeof value === 'number' && Number.isFinite(value),
  )
  if (yCandidates.length > 0) next.yIndex = Math.max(...yCandidates)

  return next
}
