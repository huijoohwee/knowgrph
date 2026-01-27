import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import MarkdownPreview from '@/features/markdown/ui/MarkdownPreview'

export async function testMarkdownAnnotateDisplay() {
  const markdown = '```geojson\n{"type":"FeatureCollection","features":[]}\n```'

  const geoDatasetIntegration: React.ComponentProps<typeof MarkdownPreview>['geoDatasetIntegration'] = {
    renderGeoJsonFeatureCollection: () => React.createElement('div', { 'data-kg-test': 'geo-map' }, 'map'),
    registerGeoJsonFeatureCollection: async () => ({ ok: true }),
    requestOpenGeoPanel: () => {},
  }
  
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
    geoDatasetIntegration,
  }
  const elInline = React.createElement(MarkdownPreview, inlineProps)
  
  const htmlInline = renderToStaticMarkup(elInline)
  if (htmlInline.includes('data-kg-test="geo-map"')) {
    throw new Error('Expected inline mode to render code, not the GeoJSON map renderer.')
  }
  if (!htmlInline.includes('Render code block output') || !htmlInline.includes('Show annotations beside code') || !htmlInline.includes('Show annotations inline')) {
    throw new Error('Expected per-code-block display toggle controls to be present.')
  }

  // Test render
  const renderProps: React.ComponentProps<typeof MarkdownPreview> = {
    markdownText: markdown,
    activeDocumentPath: 'test.md',
    highlightedLineRange: null as React.ComponentProps<typeof MarkdownPreview>['highlightedLineRange'],
    markdownWordWrap: true,
    markdownPresentationMode: false,
    markdownTextHighlight: false,
    uiPanelTextFontClass: 'font-sans',
    uiPanelMonospaceTextClass: 'font-mono',
    annotateDisplayMode: 'render',
    geoDatasetIntegration,
  }
  const elRender = React.createElement(MarkdownPreview, renderProps)
  
  const htmlRender = renderToStaticMarkup(elRender)
  if (!htmlRender.includes('data-kg-test="geo-map"')) {
    throw new Error('Expected render mode to use the GeoJSON map renderer.')
  }
  if (!htmlRender.includes('Render code block output') || !htmlRender.includes('Show annotations beside code') || !htmlRender.includes('Show annotations inline')) {
    throw new Error('Expected per-code-block display toggle controls to be present.')
  }
}
