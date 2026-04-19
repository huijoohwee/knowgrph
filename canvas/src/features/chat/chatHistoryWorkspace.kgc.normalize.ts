const pad2 = (n: number): string => String(n).padStart(2, '0')

const formatIsoDateOnly = (timestampMs: number): string => {
  const d = new Date(Number.isFinite(timestampMs) ? timestampMs : Date.now())
  const yyyy = String(d.getFullYear())
  const mm = pad2(d.getMonth() + 1)
  const dd = pad2(d.getDate())
  return `${yyyy}-${mm}-${dd}`
}

const splitLeadingFrontmatterAndBody = (raw: string): { frontmatter: string; body: string } | null => {
  const text = String(raw || '').replace(/\r\n/g, '\n')
  const lines = text.split('\n')
  let lead = 0
  while (lead < lines.length && !String(lines[lead] || '').trim()) lead += 1
  if (String(lines[lead] || '').trim() !== '---') return null
  for (let i = lead + 1; i < lines.length; i += 1) {
    if (String(lines[i] || '').trim() !== '---') continue
    return {
      frontmatter: lines.slice(lead + 1, i).join('\n'),
      body: lines.slice(i + 1).join('\n').trim(),
    }
  }
  return null
}

const isBaseTemplateFrontmatter = (frontmatter: string): boolean => {
  const normalized = `\n${String(frontmatter || '')}`
  return normalized.includes('\nruntime:') &&
    normalized.includes('\npipeline:') &&
    normalized.includes('\nmermaid:') &&
    normalized.includes('\nflow:') &&
    normalized.includes('\nlinks:') &&
    normalized.includes('\n$schema:')
}

const replaceTopLevelScalarLine = (frontmatter: string, key: string, value: string): string => {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const rx = new RegExp(`^${escapedKey}:\\s*.*$`, 'm')
  const nextLine = `${key}: ${JSON.stringify(value)}`
  if (rx.test(frontmatter)) return frontmatter.replace(rx, nextLine)
  return `${frontmatter.trimEnd()}\n${nextLine}\n`
}

const replaceNestedScalarLine = (frontmatter: string, key: string, value: string): string => {
  const rx = new RegExp(`^(\\s*${key}:\\s*).*$`, 'm')
  if (!rx.test(frontmatter)) return frontmatter
  return frontmatter.replace(rx, `$1${JSON.stringify(value)}`)
}

const toFileName = (workspacePath: string): string => {
  const cleaned = String(workspacePath || '').trim()
  if (!cleaned) return ''
  const parts = cleaned.split('/').filter(Boolean)
  return String(parts[parts.length - 1] || '').trim()
}

const toGraphSlugFromFilename = (fileName: string): string => {
  const base = String(fileName || '').replace(/\.md$/i, '').trim()
  if (!base) return 'kgc-pipeline'
  const normalized = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
  return normalized || 'kgc-pipeline'
}

export const normalizeKgcFrontmatterIdentityToFileName = (args: {
  markdown: string
  workspacePath: string
  timestampMs: number
}): string => {
  const text = String(args.markdown || '').replace(/\r\n/g, '\n').trim()
  if (!text.startsWith('---\n')) return text
  const parsed = splitLeadingFrontmatterAndBody(text)
  if (!parsed) return text
  if (!isBaseTemplateFrontmatter(parsed.frontmatter)) return text

  const fileName = toFileName(args.workspacePath) || `kgc_${Date.now()}.md`
  const graphId = `md:${toGraphSlugFromFilename(fileName)}-pipeline`
  const date = formatIsoDateOnly(args.timestampMs)

  let nextFrontmatter = parsed.frontmatter
  nextFrontmatter = replaceTopLevelScalarLine(nextFrontmatter, 'date', date)
  nextFrontmatter = replaceTopLevelScalarLine(nextFrontmatter, 'graphId', graphId)
  nextFrontmatter = replaceNestedScalarLine(nextFrontmatter, 'self_ref', fileName)

  return ['---', nextFrontmatter.trimEnd(), '---', parsed.body.trim()].join('\n').trimEnd() + '\n'
}
