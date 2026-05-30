import { resolveRouterBasename } from '@/lib/routing/basePath'

export const testResolveRouterBasenameFromBaseUrl = () => {
  const cases: Array<{ input: unknown; expected: string | undefined }> = [
    { input: undefined, expected: undefined },
    { input: '', expected: undefined },
    { input: '/', expected: undefined },
    { input: '/knowgrph/', expected: '/knowgrph' },
    { input: '/knowgrph', expected: '/knowgrph' },
    { input: 'knowgrph/', expected: '/knowgrph' },
  ]

  for (const c of cases) {
    const got = resolveRouterBasename(c.input)
    if (got !== c.expected) {
      throw new Error(`Expected resolveRouterBasename(${JSON.stringify(c.input)}) to be ${JSON.stringify(c.expected)}, got ${JSON.stringify(got)}`)
    }
  }

  const rootAlias = resolveRouterBasename('/knowgrph/', {
    pathname: '/',
    rootAliasBasePath: '/knowgrph/',
  })
  if (rootAlias !== undefined) {
    throw new Error(`Expected root alias basename to be undefined, got ${JSON.stringify(rootAlias)}`)
  }

  const canonicalPath = resolveRouterBasename('/knowgrph/', {
    pathname: '/knowgrph/',
    rootAliasBasePath: '/knowgrph/',
  })
  if (canonicalPath !== '/knowgrph') {
    throw new Error(`Expected canonical path basename to stay /knowgrph, got ${JSON.stringify(canonicalPath)}`)
  }

  const mismatchedAlias = resolveRouterBasename('/knowgrph/', {
    pathname: '/',
    rootAliasBasePath: '/other/',
  })
  if (mismatchedAlias !== '/knowgrph') {
    throw new Error(`Expected mismatched root alias basename to stay /knowgrph, got ${JSON.stringify(mismatchedAlias)}`)
  }
}
