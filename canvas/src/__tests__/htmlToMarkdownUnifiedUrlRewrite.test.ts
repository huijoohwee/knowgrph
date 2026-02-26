import { convertHtmlToMarkdownUnified } from '@/lib/markdown/htmlToMarkdownUnified'

export async function testHtmlToMarkdownUnifiedRewritesSrcsetPosterAndDataSrc() {
  const html = [
    '<!doctype html>',
    '<html>',
    '<body>',
    '  <picture>',
    '    <source srcset="img/one.webp 1x, /img/two.webp 2x" type="image/webp" />',
    '    <img data-src="img/four.jpg" srcset="./img/three.jpg 1x, img/five.jpg 2x" alt="x" />',
    '  </picture>',
    '  <video poster="poster.png"><source src="clip.webm" /></video>',
    '</body>',
    '</html>',
  ].join('')

  const out = await convertHtmlToMarkdownUnified({
    html,
    baseUrl: 'https://example.com/a/b/',
    includeImages: true,
    fidelityLevel: 4,
  })
  if (out.ok !== true) throw new Error('expected ok conversion')
  const md = out.markdown

  if (!md.includes('(https://example.com/a/b/img/four.jpg)')) throw new Error('expected data-src to become image src and resolve')
  if (!md.includes('poster="https://example.com/a/b/poster.png"')) throw new Error('expected video poster to resolve')
  if (!md.includes('src="https://example.com/a/b/clip.webm"')) throw new Error('expected video source src to resolve')
}
