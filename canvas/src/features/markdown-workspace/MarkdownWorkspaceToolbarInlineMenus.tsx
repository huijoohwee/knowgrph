import React from 'react'
import { usePanelTypography, type PanelTypography } from '@/lib/ui/panelTypography'
import type { MarkdownFormatAction } from 'grph-shared/markdown/formatting'
import type { MarkdownPresentationApi } from './markdownWorkspaceTypes'
import { uiToolbarRowScrollListClassName } from '@/features/toolbar/ui/toolbarStyles'
import {
  Bold,
  ChevronLeft,
  ChevronRight,
  Code,
  Edit3,
  Eye,
  Heading2,
  Italic,
  Link,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  WrapText,
} from 'lucide-react'

export function MarkdownWorkspacePresentationNavMenu(props: {
  canNavigateSlides: boolean
  toolbarButtonClassName: string
  presentationApiRef: React.MutableRefObject<MarkdownPresentationApi | null>
}) {
  if (!props.canNavigateSlides) return null
  return (
    <menu className={`${uiToolbarRowScrollListClassName} gap-1`} aria-label="Presentation navigation">
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Previous slide"
          onClick={() => props.presentationApiRef.current?.prev()}
        >
          <ChevronLeft className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Next slide"
          onClick={() => props.presentationApiRef.current?.next()}
        >
          <ChevronRight className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
    </menu>
  )
}

export function MarkdownWorkspaceFormattingMenu(props: {
  toolbarButtonClassName: string
  isEditing: boolean
  isMarkdown: boolean
  onFormatAction: (action: MarkdownFormatAction) => void
}) {
  const panelTypography = usePanelTypography()
  return (
    <menu className={`${uiToolbarRowScrollListClassName} gap-1`} aria-label="Formatting">
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Heading"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('heading2')}
        >
          <Heading2 className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Bold"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('bold')}
        >
          <Bold className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Italic"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('italic')}
        >
          <Italic className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Strikethrough"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('strike')}
        >
          <Strikethrough className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Inline code"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('inlineCode')}
        >
          <Code className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Link"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('link')}
        >
          <Link className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Bulleted list"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('bulletList')}
        >
          <List className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Numbered list"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('numberedList')}
        >
          <ListOrdered className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Quote"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('blockquote')}
        >
          <Quote className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          title="Normalize ASCII blocks"
          disabled={!props.isEditing || !props.isMarkdown}
          onClick={() => props.onFormatAction('normalizeAsciiBlocks')}
        >
          <span className={`${panelTypography.microLabelClass} kg-truncate-chip`}>ASCII</span>
        </button>
      </li>
    </menu>
  )
}

export function MarkdownWorkspaceDisplayMenu(props: {
  toolbarButtonClassName: string
  markdownTextHighlight: boolean
  setMarkdownTextHighlight: (next: boolean) => void
  markdownWordWrap: boolean
  setMarkdownWordWrap: (next: boolean) => void
}) {
  return (
    <menu className={`${uiToolbarRowScrollListClassName} gap-1`} aria-label="Display">
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          aria-pressed={props.markdownTextHighlight}
          title="Toggle text highlight"
          onClick={() => props.setMarkdownTextHighlight(!props.markdownTextHighlight)}
        >
          <Eye className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
      <li className="list-none">
        <button
          type="button"
          className={props.toolbarButtonClassName}
          aria-pressed={props.markdownWordWrap}
          title="Toggle word wrap"
          onClick={() => props.setMarkdownWordWrap(!props.markdownWordWrap)}
        >
          <WrapText className="w-4 h-4" strokeWidth={1.6} />
        </button>
      </li>
    </menu>
  )
}
