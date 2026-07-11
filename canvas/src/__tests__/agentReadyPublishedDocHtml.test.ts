import { encodePublishedDocShareToken } from '@/features/canvas/canvasDocShareToken.mjs'
import { onRequest } from '../../../cloudflare/pages/knowgrph-agent-ready.mjs'

export async function testPublishedDocHtmlUsesKnowgrphAppShellAsset(): Promise<void> {
  const shareToken = encodePublishedDocShareToken({ canonicalPath: 'docs/shared.md' })
  const appShellHtml = '<!doctype html><html><head><title>knowgrph</title></head><body><main id="root"></main></body></html>'
  const rootAliasHtml = '<!doctype html><html><head><meta http-equiv="refresh" content="0; url=/knowgrph/" /></head><body></body></html>'
  const assetFetchUrls: string[] = []
  let nextCallCount = 0

  const response = await onRequest({
    request: new Request(`https://airvio.co/knowgrph/share/${shareToken}`, {
      method: 'GET',
      headers: { accept: 'text/html' },
    }),
    env: {
      ASSETS: {
        fetch: async (input: RequestInfo | URL) => {
          const requestUrl = input instanceof Request ? input.url : String(input)
          assetFetchUrls.push(requestUrl)
          return new Response(appShellHtml, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8' },
          })
        },
      },
    },
    next: async () => {
      nextCallCount += 1
      return new Response(rootAliasHtml, {
        status: 200,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      })
    },
  } as never)

  const html = await response.text()
  if (!response.ok || response.headers.get('x-knowgrph-route-tag') !== 'shared-doc-html') {
    throw new Error(`expected published doc HTML route headers, got ${response.status} ${response.headers.get('x-knowgrph-route-tag')}`)
  }
  if (nextCallCount !== 0) {
    throw new Error(`expected published doc HTML route to bypass root alias next(), got ${nextCallCount}`)
  }
  if (assetFetchUrls.length !== 1 || new URL(assetFetchUrls[0]).pathname !== '/knowgrph/') {
    throw new Error(`expected published doc HTML route to fetch /knowgrph/, got ${assetFetchUrls.join(', ')}`)
  }
  if (!html.includes('id="root"') || html.includes('url=/knowgrph/')) {
    throw new Error(`expected published doc HTML route to return app shell without root refresh, got ${html.slice(0, 160)}`)
  }
  if (response.headers.get('content-security-policy') !== 'frame-ancestors *') {
    throw new Error(`expected the opaque published document route to allow external iframe hosts, got ${response.headers.get('content-security-policy')}`)
  }
  if (response.headers.has('x-frame-options')) {
    throw new Error('expected the embeddable published document route to omit conflicting X-Frame-Options')
  }
}
