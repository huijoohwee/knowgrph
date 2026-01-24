import { promises as fs } from 'node:fs'
import { resolve } from 'node:path'

type FetchOpts = { timeoutMs: number; maxBytes: number }

export type FsDatasetRegistryEntry = {
  url: string
  fixturePath: string
}

export function createFsBoundedTextFetcher(args: {
  baseDir: string
  registry: FsDatasetRegistryEntry[]
}): (url: string, opts: FetchOpts) => Promise<string | null> {
  const byUrl = new Map<string, string>()
  for (const item of args.registry) {
    const url = String(item?.url || '').trim()
    const fixturePath = String(item?.fixturePath || '').trim()
    if (!url || !fixturePath) continue
    byUrl.set(url, resolve(args.baseDir, fixturePath))
  }

  return async (urlRaw: string, opts: FetchOpts): Promise<string | null> => {
    const url = String(urlRaw || '').trim()
    const path = byUrl.get(url)
    if (!path) return null

    const work = (async () => {
      const stat = await fs.stat(path)
      if (stat.size > opts.maxBytes) return null
      return fs.readFile(path, 'utf8')
    })()

    const timeout = new Promise<null>(resolveTimeout => {
      setTimeout(() => resolveTimeout(null), Math.max(1, Math.floor(opts.timeoutMs)))
    })

    return Promise.race([work, timeout])
  }
}
