export function computeWorkspaceSeedSyncNextDelayMs(args: {
  basePollMs: number
  idleMaxMs: number
  docsOnly: boolean
  changed: boolean
  idleStreak: number
}): { nextDelayMs: number; nextIdleStreak: number } {
  const basePollMs = Number.isFinite(args.basePollMs) ? Math.max(1000, Math.floor(args.basePollMs)) : 1000
  const idleMaxMs = Number.isFinite(args.idleMaxMs) ? Math.max(basePollMs, Math.floor(args.idleMaxMs)) : basePollMs
  const changed = args.changed === true
  const docsOnly = args.docsOnly === true
  if (changed) return { nextDelayMs: basePollMs, nextIdleStreak: 0 }
  if (!docsOnly) return { nextDelayMs: basePollMs, nextIdleStreak: 0 }
  const nextIdleStreak = Math.max(0, Math.floor(args.idleStreak || 0)) + 1
  if (nextIdleStreak <= 1) return { nextDelayMs: basePollMs, nextIdleStreak }
  const exponent = Math.min(6, nextIdleStreak - 1)
  const boosted = Math.floor(basePollMs * Math.pow(2, exponent))
  return {
    nextDelayMs: Math.min(idleMaxMs, boosted),
    nextIdleStreak,
  }
}
