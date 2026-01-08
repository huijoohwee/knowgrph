export type GenericToken = {
  type: string
  raw?: string
}

export type TextToken = GenericToken & {
  type: 'text'
  text: string
}

export type StrongToken = GenericToken & {
  type: 'strong'
  tokens?: Token[]
}

export type EmToken = GenericToken & {
  type: 'em'
  tokens?: Token[]
}

export type DelToken = GenericToken & {
  type: 'del'
  tokens?: Token[]
}

export type BrToken = GenericToken & {
  type: 'br'
}

export type CodeSpanToken = GenericToken & {
  type: 'code'
  text: string
}

export type LinkToken = GenericToken & {
  type: 'link'
  href: string
  tokens?: Token[]
}

export type ImageToken = GenericToken & {
  type: 'image'
  href: string
  text?: string
}

export type ParagraphToken = GenericToken & {
  type: 'paragraph'
  text?: string
  tokens?: Token[]
}

export type HeadingToken = GenericToken & {
  type: 'heading'
  depth: number
  text?: string
  tokens?: Token[]
}

export type CodeBlockToken = GenericToken & {
  type: 'code'
  text: string
  lang?: string
}

export type TableCellToken = {
  text?: string
  tokens?: Token[]
}

export type TableToken = GenericToken & {
  type: 'table'
  header: TableCellToken[]
  rows: TableCellToken[][]
}

export type ListItemToken = {
  task?: boolean
  checked?: boolean
  tokens?: Token[]
}

export type ListToken = GenericToken & {
  type: 'list'
  ordered: boolean
  items: ListItemToken[]
}

export type BlockquoteToken = GenericToken & {
  type: 'blockquote'
  tokens?: Token[]
}

export type HtmlToken = GenericToken & {
  type: 'html'
  text: string
}

export type HrToken = GenericToken & {
  type: 'hr'
}

export type SpaceToken = GenericToken & {
  type: 'space'
}

export type Token =
  | TextToken
  | StrongToken
  | EmToken
  | DelToken
  | BrToken
  | CodeSpanToken
  | LinkToken
  | ImageToken
  | ParagraphToken
  | HeadingToken
  | CodeBlockToken
  | TableToken
  | ListToken
  | BlockquoteToken
  | HtmlToken
  | HrToken
  | SpaceToken

export type TokensGeneric = GenericToken
export type TokensText = TextToken
export type TokensStrong = StrongToken
export type TokensEm = EmToken
export type TokensDel = DelToken
export type TokensBr = BrToken
export type TokensCode = CodeSpanToken | CodeBlockToken
export type TokensLink = LinkToken
export type TokensImage = ImageToken
export type TokensParagraph = ParagraphToken
export type TokensHeading = HeadingToken
export type TokensTable = TableToken
export type TokensList = ListToken
export type TokensBlockquote = BlockquoteToken
export type TokensHTML = HtmlToken
export type TokensHr = HrToken
