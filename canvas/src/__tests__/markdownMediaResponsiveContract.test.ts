import fs from 'node:fs'
import path from 'node:path'

const readUtf8 = (relativePath: string): string => fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8')

export function testMarkdownMediaUsesSharedResponsiveOwners() {
  const ownerText = readUtf8('src/lib/cards/cardMarkdownPreviewUtils.ts')
  const cssText = readUtf8('src/styles/markdown-media-responsive.css')
  const indexCssText = readUtf8('src/index.css')
  const mediaUiText = readUtf8('src/lib/markdown-core/ui/MarkdownMediaUi.impl.tsx')
  const safeHtmlText = readUtf8('src/lib/markdown-core/ui/markdownPreviewLinks.safeHtml.render.tsx')
  const inlineRendererText = readUtf8('src/lib/markdown-core/ui/MarkdownInlineRenderer.impl.tsx')
  const paragraphText = readUtf8('src/features/markdown/ui/MarkdownParagraphBlock.tsx')
  const scrollSyncText = readUtf8('src/features/markdown-workspace/useMarkdownScrollSync.ts')

  for (const name of [
    'CARD_MARKDOWN_PREVIEW_MEDIA_FRAME_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_MEDIA_EMBED_FRAME_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_MEDIA_AUDIO_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_MEDIA_WIDE_AUDIO_CLASS_NAME',
    'CARD_MARKDOWN_PREVIEW_MEDIA_ERROR_FRAME_CLASS_NAME',
  ]) {
    if (!ownerText.includes(name)) throw new Error(`expected card markdown preview media owner to export ${name}`)
  }
  for (const snippet of [
    '.kg-card-markdown-preview-media-frame',
    '.kg-card-markdown-preview-media-embed-frame',
    '.kg-card-markdown-preview-media-audio',
    '.kg-card-markdown-preview-media-error-frame',
    '--kg-card-markdown-preview-media-frame-max-width',
    '--kg-card-markdown-preview-media-audio-max-width',
  ]) {
    if (!cssText.includes(snippet)) throw new Error(`expected markdown media responsive CSS owner to include ${snippet}`)
  }
  if (!indexCssText.includes("@import './styles/markdown-media-responsive.css';")) {
    throw new Error('expected app CSS to import markdown media responsive owners')
  }
  if (!mediaUiText.includes('CARD_MARKDOWN_PREVIEW_MEDIA_EMBED_FRAME_CLASS_NAME') || !mediaUiText.includes('CARD_MARKDOWN_PREVIEW_MEDIA_FRAME_CLASS_NAME')) {
    throw new Error('expected Markdown media UI to consume shared responsive media frame owners')
  }
  if (!safeHtmlText.includes('CARD_MARKDOWN_PREVIEW_MEDIA_WIDE_AUDIO_CLASS_NAME') || !safeHtmlText.includes('CARD_MARKDOWN_PREVIEW_MEDIA_EMBED_FRAME_CLASS_NAME')) {
    throw new Error('expected safe HTML media renderer to consume shared responsive media owners')
  }
  if (!inlineRendererText.includes('CARD_MARKDOWN_PREVIEW_MEDIA_AUDIO_CLASS_NAME') || !paragraphText.includes('CARD_MARKDOWN_PREVIEW_MEDIA_AUDIO_CLASS_NAME')) {
    throw new Error('expected inline and paragraph audio renderers to consume shared responsive audio owners')
  }
  if (!scrollSyncText.includes('CARD_MARKDOWN_PREVIEW_MEDIA_FRAME_CLASS_NAME') || scrollSyncText.includes("hasClass('max-w-xl')")) {
    throw new Error('expected Markdown scroll sync to recognize shared media owners instead of stale max-width literals')
  }
  for (const literal of ['w-full max-w-xl', 'w-full max-w-2xl', 'aspect-video w-full max-w-xl']) {
    if ([mediaUiText, safeHtmlText, inlineRendererText, paragraphText].some(text => text.includes(literal))) {
      throw new Error(`expected Markdown media renderers to avoid inline fixed media width literal: ${literal}`)
    }
  }
}
