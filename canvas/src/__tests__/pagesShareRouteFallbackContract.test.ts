import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const findRepoRoot = () => {
  const candidates = [
    resolve(process.cwd(), '..'),
    process.cwd(),
    resolve(process.cwd(), '..', '..'),
  ]
  for (const candidate of candidates) {
    if (existsSync(resolve(candidate, 'scripts', 'sync-pages-knowgrph.mjs'))) {
      return candidate
    }
  }
  throw new Error('expected to find knowgrph repo root')
}

export function testGeneratedRedirectsKeepPublishedDocRoutesFunctionOwned() {
  const repoRoot = findRepoRoot()
  const syncScript = readFileSync(resolve(repoRoot, 'scripts', 'sync-pages-knowgrph.mjs'), 'utf8')
  const publishedDocFunctionRoutes = [
    '/knowgrph/share/* /knowgrph/share/:splat 200',
    '/knowgrph/doc/* /knowgrph/doc/:splat 200',
    '/knowgrph/doc-default/* /knowgrph/doc-default/:splat 200',
  ]

  for (const route of publishedDocFunctionRoutes) {
    const routeIndex = syncScript.indexOf(route)
    const fallbackIndex = syncScript.indexOf('/knowgrph/* /content/knowgrph/index.html 200')
    if (routeIndex < 0) {
      throw new Error(`expected generated redirects to preserve published document function route ${route}`)
    }
    if (fallbackIndex >= 0 && routeIndex > fallbackIndex) {
      throw new Error(`expected published document route ${route} to precede app-shell fallback`)
    }
  }

  if (!syncScript.includes('...rootFiles.map(rel => `/knowgrph/${rel} /content/knowgrph/${rel} 200`)')) {
    throw new Error('expected generated static file routes to remain rooted in content/knowgrph')
  }
  if (!syncScript.includes("'/knowgrph/mcp /knowgrph/mcp 200'")) {
    throw new Error('expected agent-ready function routes to stay explicitly routed')
  }
}
