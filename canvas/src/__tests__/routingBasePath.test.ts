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
}

