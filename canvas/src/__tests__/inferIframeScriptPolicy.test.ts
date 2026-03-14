import { inferIframeScriptPolicyFromHtml } from '@/lib/url'

export async function testInferIframeScriptPolicyUsesAllowForReactLikePages() {
  const html = [
    '<!doctype html><html><head>',
    '<script>window.__NEXT_DATA__={}</script>',
    '</head><body><div id="__next"></div></body></html>',
  ].join('')
  const policy = inferIframeScriptPolicyFromHtml(html)
  if (policy !== 'allow') throw new Error(`expected allow, got ${policy}`)
}

