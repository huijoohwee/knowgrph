export type MarkdownGeoCodeBlockLanguage = 'geojson' | 'json'

export type MarkdownGeoCodeBlock = {
  lang: MarkdownGeoCodeBlockLanguage
  text: string
  startLine: number
  endLine: number
}

export type MarkdownGeoEmbeddedCodeBlock = Omit<MarkdownGeoCodeBlock, 'lang'> & {
  lang: 'geojson'
}
