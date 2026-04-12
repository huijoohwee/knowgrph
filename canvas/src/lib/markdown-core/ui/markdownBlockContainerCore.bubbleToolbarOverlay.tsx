import React from 'react'
import {
  AlignLeft,
  Bold,
  Code,
  Eraser,
  Heading2,
  Highlighter,
  Italic,
  Link as LinkIcon,
  List,
  ListOrdered,
  MessageSquare,
  MoreHorizontal,
  Palette,
  Quote,
  Strikethrough,
  Subscript,
  Superscript,
  Underline,
} from 'lucide-react'
import { AnchorOverlay } from '@/lib/ui/overlay'
import {
  preventDefaultMouseDown,
  preventDefaultPointerDown,
  toggleParentDetailsOpenFromSummaryClick,
} from '@/features/markdown/ui/markdownFloatingSelectionToolbar'
import type { SsotSurface } from 'grph-shared/ssot/types'

export const MarkdownBlockContainerBubbleToolbarOverlay = (props: {
  show: boolean
  anchorRef: React.RefObject<HTMLSpanElement | null>
  toolbarRef: React.RefObject<HTMLElement | null>
  holdToolbarInteraction: () => void
  onToolbarInteractionEnd: () => void
  floatingBubbleToolbarClassName: string
  floatingBubbleButtonClassName: string
  floatingMenuButtonDangerClassName: string
  floatingMenuButtonDisabledClassName: string
  toolbarMenuClassName: string
  toolbarMenuButtonClassName: string
  toolbarMenuDividerClassName: string
  toolbarMenuSummaryClassName: string
  applyTurnInto: (next: string) => void
  applyToggleHeading: (level: 1 | 2 | 3) => void
  applyAlign: (next: string) => void
  applyDraftAction: (action: 'bold' | 'inlineCode' | 'italic' | 'link' | 'strike') => void
  applyWrap: (left: string, right: string) => void
  applyHighlightColor: (color: string) => void
  applyColor: (color: string) => void
  applyClearFormatting: () => void
  applyChecklist: () => void
  applyDivider: () => void
  handleDuplicate: () => void
  handleDelete: () => void
  selectionActions?: {
    startLine: number
    endLine: number
    currentView: SsotSurface
    onShowOnCanvas: (startLine: number, endLine: number) => void
    onShowInViewer: (line: number) => void
    onShowInEditor: (line: number) => void
    onShowInPresentation: (line: number) => void
    onShowInSlidesGallery: (line: number) => void
    onShowInGraphDataTable: (line: number) => void
  } | null
}) => {
  if (!props.show) return null
  const closeParentDetails = (event: React.MouseEvent<HTMLElement>) => {
    const details = (event.currentTarget as HTMLElement | null)?.closest('details') as HTMLDetailsElement | null
    if (details) details.open = false
  }
  const selectionActions = props.selectionActions
  return (
    <AnchorOverlay anchorRef={props.anchorRef} open align="top-center" className={props.floatingBubbleToolbarClassName}>
      <menu
        ref={props.toolbarRef}
        className="list-none m-0 p-0 flex flex-wrap items-center gap-1"
        aria-label="Inline selection toolbar"
        onPointerDownCapture={props.holdToolbarInteraction}
        onMouseDownCapture={props.holdToolbarInteraction}
        onPointerUpCapture={props.onToolbarInteractionEnd}
        onMouseUpCapture={props.onToolbarInteractionEnd}
      >
        <details className="relative">
          <summary className={props.toolbarMenuSummaryClassName} onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}>
            <Heading2 className="w-3 h-3" strokeWidth={1.6} />
          </summary>
          <menu className={props.toolbarMenuClassName} aria-label="Turn into menu">
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyTurnInto('heading2')}><Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />H2</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyTurnInto('bulletList')}><List className="w-3 h-3 mr-1" strokeWidth={1.6} />Bulleted list</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyTurnInto('numberedList')}><ListOrdered className="w-3 h-3 mr-1" strokeWidth={1.6} />Numbered list</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyTurnInto('blockquote')}><Quote className="w-3 h-3 mr-1" strokeWidth={1.6} />Quote</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyTurnInto('code')}><Code className="w-3 h-3 mr-1" strokeWidth={1.6} />Code block</button></li>
            <li className={props.toolbarMenuDividerClassName} />
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyToggleHeading(1)}><Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />H1</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyToggleHeading(2)}><Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />H2</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyToggleHeading(3)}><Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />H3</button></li>
          </menu>
        </details>
        <details className="relative">
          <summary className={props.toolbarMenuSummaryClassName} onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}>
            <AlignLeft className="w-3 h-3" strokeWidth={1.8} />
          </summary>
          <menu className={props.toolbarMenuClassName} aria-label="Align menu">
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyAlign('left')}>Left</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyAlign('center')}>Center</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyAlign('right')}>Right</button></li>
          </menu>
        </details>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyDraftAction('bold')} title="Bold"><Bold className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyDraftAction('inlineCode')} title="Code"><Code className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyDraftAction('italic')} title="Italic"><Italic className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyDraftAction('link')} title="Link"><LinkIcon className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyDraftAction('strike')} title="Strikethrough"><Strikethrough className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyWrap('<u>', '</u>')} title="Underline"><Underline className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyWrap('^', '^')} title="Superscript"><Superscript className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyWrap('~', '~')} title="Subscript"><Subscript className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyWrap('$', '$')} title="Math"><span className="text-[10px] leading-none">∑</span></button>
        <details className="relative">
          <summary className={props.toolbarMenuSummaryClassName} title="Highlight" onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}><Highlighter className="w-3 h-3" strokeWidth={1.8} /></summary>
          <menu className={props.toolbarMenuClassName} aria-label="Highlight menu">
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyWrap('==', '==')}>Default (==)</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ backgroundColor: '#FEF08A' }} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyHighlightColor('#FEF08A')}>Yellow</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ backgroundColor: '#BBF7D0' }} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyHighlightColor('#BBF7D0')}>Green</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ backgroundColor: '#BFDBFE' }} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyHighlightColor('#BFDBFE')}>Blue</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ backgroundColor: '#FBCFE8' }} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyHighlightColor('#FBCFE8')}>Pink</button></li>
          </menu>
        </details>
        <details className="relative">
          <summary className={props.toolbarMenuSummaryClassName} title="Text color" onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}><Palette className="w-3 h-3" strokeWidth={1.8} /></summary>
          <menu className={props.toolbarMenuClassName} aria-label="Text color menu">
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ color: '#EF4444' }} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyColor('#EF4444')}>Red</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ color: '#10B981' }} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyColor('#10B981')}>Green</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ color: '#3B82F6' }} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyColor('#3B82F6')}>Blue</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ color: '#6B7280' }} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyColor('#6B7280')}>Gray</button></li>
          </menu>
        </details>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={props.applyClearFormatting} title="Clear formatting"><Eraser className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyWrap('<!-- ', ' -->')} title="Comment"><MessageSquare className="w-3 h-3" strokeWidth={1.8} /></button>
        <details className="relative">
          <summary className={props.toolbarMenuSummaryClassName} title="More" onPointerDown={preventDefaultPointerDown} onClick={toggleParentDetailsOpenFromSummaryClick}><MoreHorizontal className="w-3 h-3" strokeWidth={1.8} /></summary>
          <menu className={props.toolbarMenuClassName} aria-label="More actions">
            {selectionActions ? (
              <>
                <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={(event) => { closeParentDetails(event); selectionActions.onShowOnCanvas(selectionActions.startLine, selectionActions.endLine) }}>Show on Canvas</button></li>
                <li className="list-none"><button type="button" className={selectionActions.currentView === 'markdown.viewer' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'markdown.viewer'} onMouseDown={preventDefaultMouseDown} onClick={(event) => { closeParentDetails(event); selectionActions.onShowInViewer(selectionActions.startLine) }}>Show in Viewer</button></li>
                <li className="list-none"><button type="button" className={selectionActions.currentView === 'markdown.editor' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'markdown.editor'} onMouseDown={preventDefaultMouseDown} onClick={(event) => { closeParentDetails(event); selectionActions.onShowInEditor(selectionActions.startLine) }}>Show in Editor</button></li>
                <li className="list-none"><button type="button" className={selectionActions.currentView === 'markdown.presentation' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'markdown.presentation'} onMouseDown={preventDefaultMouseDown} onClick={(event) => { closeParentDetails(event); selectionActions.onShowInPresentation(selectionActions.startLine) }}>Show in Presentation</button></li>
                <li className="list-none"><button type="button" className={selectionActions.currentView === 'markdown.slides' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'markdown.slides'} onMouseDown={preventDefaultMouseDown} onClick={(event) => { closeParentDetails(event); selectionActions.onShowInSlidesGallery(selectionActions.startLine) }}>Show in Slides Gallery</button></li>
                <li className="list-none"><button type="button" className={selectionActions.currentView === 'table' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'table'} onMouseDown={preventDefaultMouseDown} onClick={(event) => { closeParentDetails(event); selectionActions.onShowInGraphDataTable(selectionActions.startLine) }}>Show in Graph Data Table</button></li>
                <li className={props.toolbarMenuDividerClassName} />
              </>
            ) : (
              <>
                <li className="list-none"><button type="button" className={props.floatingMenuButtonDisabledClassName} disabled>Copy</button></li>
                <li className="list-none"><button type="button" className={props.floatingMenuButtonDisabledClassName} disabled>Copy link to block</button></li>
                <li className={props.toolbarMenuDividerClassName} />
              </>
            )}
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={props.applyChecklist}>Checklist</button></li>
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={props.applyDivider}>Divider</button></li>
            <li className={props.toolbarMenuDividerClassName} />
            <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={props.handleDuplicate}>Duplicate</button></li>
            <li className="list-none"><button type="button" className={props.floatingMenuButtonDangerClassName} onMouseDown={preventDefaultMouseDown} onClick={props.handleDelete}>Delete</button></li>
          </menu>
        </details>
      </menu>
    </AnchorOverlay>
  )
}
