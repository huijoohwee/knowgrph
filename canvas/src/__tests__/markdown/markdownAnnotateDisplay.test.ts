import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'

export async function testMarkdownAnnotateDisplay() {
  const markdown = '```js\nconsole.log("hello")\n```'
  
  // Test inline
  const inlineProps: React.ComponentProps<typeof MarkdownPreview> = {
    markdownText: markdown,
    activeDocumentPath: 'test.md',
    highlightedLineRange: null as React.ComponentProps<typeof MarkdownPreview>['highlightedLineRange'],
    markdownWordWrap: true,
    markdownPresentationMode: false,
    markdownTextHighlight: false,
    uiPanelTextFontClass: 'font-sans',
    uiPanelMonospaceTextClass: 'font-mono',
    annotateDisplayMode: 'inline',
  }
  const elInline = React.createElement(MarkdownPreview, inlineProps)
  
  const htmlInline = renderToStaticMarkup(elInline)
  if (!htmlInline.includes('data-annotate-display="inline"')) {
    throw new Error(`Expected data-annotate-display="inline", got html length ${htmlInline.length}`)
  }

  // Test beside
  const besideProps: React.ComponentProps<typeof MarkdownPreview> = {
    markdownText: markdown,
    activeDocumentPath: 'test.md',
    highlightedLineRange: null as React.ComponentProps<typeof MarkdownPreview>['highlightedLineRange'],
    markdownWordWrap: true,
    markdownPresentationMode: false,
    markdownTextHighlight: false,
    uiPanelTextFontClass: 'font-sans',
    uiPanelMonospaceTextClass: 'font-mono',
    annotateDisplayMode: 'beside',
  }
  const elBeside = React.createElement(MarkdownPreview, besideProps)
  
  const htmlBeside = renderToStaticMarkup(elBeside)
  if (!htmlBeside.includes('data-annotate-display="beside"')) {
    throw new Error(`Expected data-annotate-display="beside", got html length ${htmlBeside.length}`)
  }
}
