import { UI_COPY } from '@/lib/config'

export type JsonToMarkdownCopy = {
  emptyArrayLabel: string
  emptyListLabel: string
  moreRowsLabel: (remaining: number) => string
  itemLabel: (index: number) => string
}

export const JSON_TO_MARKDOWN_COPY: JsonToMarkdownCopy = {
  emptyArrayLabel: UI_COPY.jsonToMarkdownEmptyArrayLabel,
  emptyListLabel: UI_COPY.jsonToMarkdownEmptyListLabel,
  moreRowsLabel: remaining => UI_COPY.jsonToMarkdownMoreRowsLabel(remaining),
  itemLabel: index => UI_COPY.jsonToMarkdownItemLabel(index),
}

