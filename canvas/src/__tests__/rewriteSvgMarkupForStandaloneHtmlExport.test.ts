import { rewriteSvgMarkupForStandaloneHtmlExport } from '@/lib/graph/htmlViewer/rewriteSvgMarkupForStandaloneHtmlExport'

export async function testRewriteSvgMarkupUnwrapsFetchRemoteProxyUrls() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="/__fetch_remote?url=${encodeURIComponent(
    'https://example.com/a.png?x=1',
  )}" x="0" y="0" width="10" height="10"/></svg>`
  const out = await rewriteSvgMarkupForStandaloneHtmlExport({ svgMarkup: svg })
  if (!out.includes('https://example.com/a.png?x=1')) {
    throw new Error('expected fetch proxy url to be unwrapped to absolute url')
  }
  if (out.includes('/__fetch_remote?url=')) {
    throw new Error('expected fetch proxy endpoint to be removed')
  }
}

export async function testRewriteSvgMarkupUnwrapsWebpageAssetPathUrls() {
  const originEnc = encodeURIComponent('https://example.com')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><image href="/__webpage_asset_path/${originEnc}/assets/img.png" x="0" y="0" width="10" height="10"/></svg>`
  const out = await rewriteSvgMarkupForStandaloneHtmlExport({ svgMarkup: svg })
  if (!out.includes('https://example.com/assets/img.png')) {
    throw new Error('expected webpage asset path to be unwrapped to absolute url')
  }
}

