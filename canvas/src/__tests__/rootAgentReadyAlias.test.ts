import { onRequest as onRootRequest } from '../../../cloudflare/pages/root-agent-ready-index.mjs'

const PUBLISHED_APP_SHELL_WITH_DIV_MOUNT = `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <title>Knowgrph</title>
    <link rel="modulepreload" href="/knowgrph/assets/react-D1l5gsU-.js" />
    <script type="module" src="/knowgrph/assets/index-Cs7TCbuM.js"></script>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`

export async function testRootAgentReadyAliasCanonicalizesPublishedAppShellMount(): Promise<void> {
  const originalFetch = globalThis.fetch
  const fetchUrls: string[] = []

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchUrls.push(url)
      if (url === 'https://airvio.co/knowgrph/?agentReadyRootAlias=1') {
        return new Response(PUBLISHED_APP_SHELL_WITH_DIV_MOUNT, {
          status: 200,
          headers: { 'content-type': 'text/html; charset=utf-8' },
        })
      }
      throw new Error(`unexpected root alias fetch: ${url}`)
    }) as typeof fetch

    const response = await onRootRequest({
      request: new Request('https://airvio.co/', {
        method: 'GET',
        headers: { accept: 'text/html' },
      }),
      env: {},
      next: async () => new Response('unexpected next()'),
    } as never)
    const body = await response.text()

    if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
      throw new Error(`expected root alias HTML response, got ${response.status} ${response.headers.get('content-type')}`)
    }
    if (fetchUrls.length !== 1 || fetchUrls[0] !== 'https://airvio.co/knowgrph/?agentReadyRootAlias=1') {
      throw new Error(`expected root alias to load only the published app shell, got ${JSON.stringify(fetchUrls)}`)
    }
    if (!body.includes('<main id="root"></main>') || body.includes('<div id="root"></div>')) {
      throw new Error(`expected root alias to serve canonical root mount, got ${body.slice(0, 400)}`)
    }
    if (!body.includes('/knowgrph/assets/index-Cs7TCbuM.js')) {
      throw new Error('expected root alias to keep the published app asset references')
    }
    if (!body.includes('name="x-knowgrph-root-alias" content="/knowgrph/"')) {
      throw new Error('expected root alias metadata to be injected')
    }
    if (body.includes('id="knowgrph-root-fallback"') || body.includes('data-knowgrph-root-fallback')) {
      throw new Error('expected root alias to omit the old full-screen launch fallback')
    }
    if (body.includes('Open Knowgrph')) {
      throw new Error('expected successful root alias app shell to omit launch fallback CTA')
    }
    if (!body.includes('Agent-actionable chat-to-canvas knowledge graph workspace')) {
      throw new Error('expected root alias description to be canonical')
    }
    if (/http-equiv=["']refresh["']/i.test(body) || body.includes('url=/knowgrph/')) {
      throw new Error('expected root alias to avoid redirect-style fallbacks')
    }
  } finally {
    globalThis.fetch = originalFetch
  }
}
