const TEXTAREA_INVOCATION_TEXT_CLASS_TOKEN_PATTERN =
  /^(?:p(?:[trblxy])?-.+|text-.+|font-.+|leading-.+|tracking-.+|whitespace-.+|break-.+|tabular-nums|normal-nums|ordinal|slashed-zero|antialiased|subpixel-antialiased|uppercase|lowercase|capitalize|normal-case)$/

export function readTextareaInvocationProjectionTextClassName(className: string, fallbackClassName = 'font-sans text-xs'): string {
  const selectedTokenByGroup = new Map<string, string>()
  const orderedKeys: string[] = []
  for (const token of String(className || '')
    .split(/\s+/)
    .filter(token => token && TEXTAREA_INVOCATION_TEXT_CLASS_TOKEN_PATTERN.test(token))) {
    const key = readTextareaInvocationProjectionClassGroup(token) || `token:${orderedKeys.length}:${token}`
    if (!selectedTokenByGroup.has(key)) orderedKeys.push(key)
    selectedTokenByGroup.set(key, token)
  }
  const tokens = orderedKeys.map(key => selectedTokenByGroup.get(key)).filter(Boolean) as string[]
  return tokens.length ? tokens.join(' ') : fallbackClassName
}

function readTextareaInvocationProjectionClassGroup(token: string): string | null {
  if (/^p[trblxy]?-/.test(token)) return token.slice(0, token.indexOf('-'))
  if (/^leading-/.test(token)) return 'leading'
  if (/^text-(?:xs|sm|base|lg|xl|[2-9]xl|\[(?!color:).+\])$/.test(token)) return 'text-size'
  return null
}
