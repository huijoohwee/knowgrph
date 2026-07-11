import { onRequest as onRootRequest } from '../../../cloudflare/pages/root-agent-ready-index.mjs'

export async function testRootAgentReadyAliasCanonicalizesPublishedAppShellMount(): Promise<void> {
  const originalFetch = globalThis.fetch
  const fetchUrls: string[] = []

  try {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input)
      fetchUrls.push(url)
      if (url === 'https://airvio.co/knowgrph/?agentReadyRootWebMcp=1') {
        return new Response('<script>const createWebMcpLifecycleController = true; const toolDefinitions = [];</script>', {
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
    if (fetchUrls.length !== 1 || fetchUrls[0] !== 'https://airvio.co/knowgrph/?agentReadyRootWebMcp=1') {
      throw new Error(`expected root landing to load only the WebMCP contract, got ${JSON.stringify(fetchUrls)}`)
    }
    if (!body.includes('data-kg-live-canvas-launch="true"')) {
      throw new Error(`expected root landing overlay, got ${body.slice(0, 400)}`)
    }
    if (!body.includes('<iframe class="live-canvas" src="/knowgrph/" title="Interactive Knowgrph canvas"></iframe>')) {
      throw new Error('expected root landing to embed the live canonical canvas')
    }
    if (!body.includes('data-kg-live-canvas-hero-enter="true">Enter Knowgrph</a>')) {
      throw new Error('expected root landing to expose the canonical Enter Knowgrph action')
    }
    if (body.includes('id="knowgrph-root-fallback"') || body.includes('data-knowgrph-root-fallback')) {
      throw new Error('expected root alias to omit the old full-screen launch fallback')
    }
    if (body.includes('Open Knowgrph')) {
      throw new Error('expected root landing to omit the legacy launch CTA')
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
