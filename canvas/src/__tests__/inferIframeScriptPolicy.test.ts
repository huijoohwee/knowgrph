import { inferIframeScriptPolicyFromHtml } from '@/lib/url'

export async function testInferIframeScriptPolicyUsesStripForReactLikePages() {
  const html = [
    '<!doctype html><html><head>',
    '<script>window.__NEXT_DATA__={}</script>',
    '</head><body><div id="__next"></div></body></html>',
  ].join('')
  const policy = inferIframeScriptPolicyFromHtml(html)
  if (policy !== 'strip') throw new Error(`expected strip, got ${policy}`)
}
