export type MarkdownGeoGraphSourceKind = 'code-block' | 'table'

export type MarkdownGeoGraphSourceDescriptor = {
  kind: MarkdownGeoGraphSourceKind
  sourcePath: string
}
