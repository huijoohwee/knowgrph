import fs from 'node:fs'
import path from 'node:path'
import {
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME,
  CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME,
} from '@/lib/cards/cardMarkdownPreviewUtils'
import { DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME } from '@/features/markdown/ui/dataViewChipStyles'
import { UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { UI_INLINE_CHIP_LABEL_15CH_CLASSNAME, UI_INLINE_CHIP_SHELL_15CH_CLASSNAME, UI_INLINE_MEDIA_CHIP_SHELL_15CH_CLASSNAME, UI_INLINE_TEXT_PILL_HEIGHT_CLASSNAME } from '@/lib/ui/textLayout'

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
  if (!ownerText.includes('UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME')) {
    throw new Error('expected inline media chips to reuse the shared responsive inline row owner')
  }
  if (!CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME.includes(UI_INLINE_CHIP_LABEL_15CH_CLASSNAME)) {
    throw new Error(`expected @ media label to use shared 15ch chip truncation, got ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_LABEL_CLASS_NAME}`)
  }
  if (!CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME.includes(UI_INLINE_CHIP_SHELL_15CH_CLASSNAME) || !CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME.includes(UI_INLINE_MEDIA_CHIP_SHELL_15CH_CLASSNAME)) {
    throw new Error(`expected @ media chip shell to use shared 15ch fit-content cap, got ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME}`)
  }
  if (!indexCssText.includes('.kg-inline-chip-label-15ch') || !indexCssText.includes('max-inline-size: min(15ch, 100%);') || !indexCssText.includes('.kg-inline-chip-shell-15ch') || !indexCssText.includes('width: fit-content;') || !indexCssText.includes('max-inline-size: min(calc(15ch + var(--kg-inline-chip-shell-extra, 1rem)), 100%);')) {
    throw new Error('expected app CSS to cap inline / # @ chip labels and shells at 15ch while preserving responsive max width')
  }
  for (const className of [
    UI_RESPONSIVE_INLINE_ELEMENT_ROW_CLASSNAME,
    UI_INLINE_TEXT_PILL_HEIGHT_CLASSNAME,
  ]) {
    if (!CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME.includes(className)) {
      throw new Error(`expected @ media chip to reuse ${className}, got ${CARD_MARKDOWN_PREVIEW_INLINE_MEDIA_PILL_CLASS_NAME}`)
    }
    if (!DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME.includes(className)) {
      throw new Error(`expected invocation chips to reuse ${className}, got ${DATA_VIEW_INLINE_TEXT_CHIP_ROW_CLASSNAME}`)
    }
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
