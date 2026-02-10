export function shiftMarkdownHeadings(args: { markdown: string; delta: number }): string {
  const delta = Number.isFinite(args.delta) ? Math.floor(args.delta) : 0
  if (!delta) return args.markdown
  return String(args.markdown || '')
    .split(/\r?\n/)
    .map(line => {
      const m = /^(#{1,6})(\s+)(.*)$/.exec(line)
      if (!m) return line
      const level = m[1].length
      const next = Math.max(1, Math.min(6, level + delta))
      return `${'#'.repeat(next)}${m[2]}${m[3]}`
    })
    .join('\n')
}

