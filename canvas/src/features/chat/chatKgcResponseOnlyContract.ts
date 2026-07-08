export const KGC_RESPONSE_ONLY_SCHEMA = 'kgc-response/v1'

export const hasResponseOnlyKgcMarker = (frontmatter: string): boolean => {
  return /(^|\n)kgcResponseOnly:\s*true\b/.test(String(frontmatter || ''))
}

export const isResponseOnlyKgcFrontmatter = (frontmatter: string): boolean => {
  const text = String(frontmatter || '')
  return hasResponseOnlyKgcMarker(text) &&
    /(^|\n)\$schema:\s*["']kgc-response\/v1["']/.test(text)
}

export const hasResponseOnlyKgcBody = (markdownBody: string, forbiddenSections: readonly string[]): boolean => {
  const body = String(markdownBody || '').replace(/\r\n/g, '\n')
  if (!/(^|\n)## Response\s*(\n|$)/.test(body)) return false
  return !forbiddenSections.some(section => body.includes(section))
}

export const readResponseOnlyKgcVariableLinkError = (args: {
  frontmatterKeys: ReadonlySet<string>
  refs: readonly string[]
  readRefKey: (ref: string) => string
}): string => {
  for (const key of ['title', 'graphId', 'doc_type', 'date', 'ai_model', 'response'] as const) {
    if (!args.frontmatterKeys.has(key)) return `Response-only KGC frontmatter is missing: ${key}.`
  }
  for (const ref of args.refs) {
    const key = args.readRefKey(ref)
    if (key && !args.frontmatterKeys.has(key)) return `Body variable {{${key}}} is not declared in YAML frontmatter.`
  }
  return ''
}
