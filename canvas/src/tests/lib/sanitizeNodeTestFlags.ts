const escapeRe = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

const stripFlag = (args: string[], name: string) => {
  for (let i = args.length - 1; i >= 0; i -= 1) {
    const current = args[i]
    if (current !== name && !current.startsWith(name + '=')) continue
    if (current.startsWith(name + '=')) {
      args.splice(i, 1)
      continue
    }
    const next = args[i + 1]
    const hasValue = typeof next === 'string' && next.trim() !== '' && !next.startsWith('-')
    args.splice(i, hasValue ? 2 : 1)
  }
}

const stripFromNodeOptions = (name: string) => {
  const value = process.env.NODE_OPTIONS
  if (!value) return
  const escaped = escapeRe(name)
  const pattern = new RegExp(
    `(?:^|\\s)${escaped}(?:=(?:"[^"]*"|'[^']*'|\\S+)|\\s+(?:"[^"]*"|'[^']*'|\\S+))?(?=\\s|$)`,
    'g',
  )
  const next = value.replace(pattern, ' ').replace(/\s+/g, ' ').trim()
  process.env.NODE_OPTIONS = next
}

export const sanitizeNodeTestFlags = () => {
  try {
    stripFlag(process.argv, '--localstorage-file')
    stripFlag(process.argv, '--localstorageFile')
    stripFlag(process.execArgv, '--localstorage-file')
    stripFlag(process.execArgv, '--localstorageFile')
    stripFromNodeOptions('--localstorage-file')
    stripFromNodeOptions('--localstorageFile')
  } catch {
    void 0
  }
}
