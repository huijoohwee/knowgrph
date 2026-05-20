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
} from '@/features/markdown/ui/markdownFloatingSelectionToolbar'
import {
  uiToolbarResponsiveRowScrollClassName,
  uiToolbarRowScrollListClassName,
  uiToolbarTouchRowScrollClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import type { SsotSurface } from 'grph-shared/ssot/types'
import { useMediaQuery } from '@/lib/ui/useMediaQuery'

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
  applyComment: () => void
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
  const isTouchToolbarViewport = useMediaQuery('(max-width: 768px), (pointer: coarse)')
  const suppressToolbarMenuClickRef = React.useRef(false)
  const suppressToolbarInteractionEndCountRef = React.useRef(0)
  const triggerButtonRefs = React.useRef<Record<string, HTMLButtonElement | null>>({})
  const [openMenuKey, setOpenMenuKey] = React.useState<string | null>(null)
  const toolbarMenuPanelClassName = React.useMemo(
    () =>
      String(props.toolbarMenuClassName || '')
        .split(/\s+/)
        .filter(token => token && token !== 'absolute' && token !== 'left-0' && token !== 'right-0' && token !== 'mt-2' && token !== 'z-40')
        .join(' '),
    [props.toolbarMenuClassName],
  )
  if (!props.show) return null
  const toolbarRowClassName = [
    uiToolbarRowScrollListClassName,
    uiToolbarResponsiveRowScrollClassName,
    isTouchToolbarViewport ? uiToolbarTouchRowScrollClassName : '',
    'gap-1',
  ].filter(Boolean).join(' ')
  const handleToolbarPointerDownCapture = (event: React.PointerEvent<HTMLElement>) => {
    preventDefaultPointerDown(event)
    props.holdToolbarInteraction()
  }
  const handleToolbarMouseDownCapture = (event: React.MouseEvent<HTMLElement>) => {
    preventDefaultMouseDown(event)
    props.holdToolbarInteraction()
  }
  const handleToolbarInteractionEndCapture = () => {
    if (suppressToolbarInteractionEndCountRef.current > 0) {
      suppressToolbarInteractionEndCountRef.current -= 1
      return
    }
    props.onToolbarInteractionEnd()
  }
  const runMenuAction = (
    event: React.MouseEvent<HTMLButtonElement>,
    action: () => void,
    closeMenu?: () => void,
  ) => {
    props.holdToolbarInteraction()
    closeMenu?.()
    action()
    props.onToolbarInteractionEnd()
  }
  const renderToolbarMenu = (args: {
    key: string
    ariaLabel: string
    title?: string
    summary: React.ReactNode
    portalPlacement?: 'bottom-start' | 'bottom-end'
    menu: (close: () => void) => React.ReactNode
  }) => {
    const closeMenu = () => {
      setOpenMenuKey(prev => (prev === args.key ? null : prev))
    }
    const toggleMenu = () => {
      setOpenMenuKey(prev => (prev === args.key ? null : args.key))
    }
    const anchorRef = { current: triggerButtonRefs.current[args.key] } as React.RefObject<HTMLElement>
    return (
      <>
        <button
          type="button"
          ref={el => {
            triggerButtonRefs.current[args.key] = el
          }}
          className={props.toolbarMenuSummaryClassName}
          aria-label={args.ariaLabel}
          aria-expanded={openMenuKey === args.key}
          title={args.title}
          onPointerDown={(event) => {
            preventDefaultPointerDown(event)
            props.holdToolbarInteraction()
            if (event.button === 0) {
              suppressToolbarMenuClickRef.current = true
              suppressToolbarInteractionEndCountRef.current = Math.max(suppressToolbarInteractionEndCountRef.current, 2)
              toggleMenu()
            }
          }}
          onMouseDown={(event) => {
            preventDefaultMouseDown(event)
            props.holdToolbarInteraction()
          }}
          onClick={(event) => {
            event.preventDefault()
            props.holdToolbarInteraction()
            if (suppressToolbarMenuClickRef.current) {
              suppressToolbarMenuClickRef.current = false
              return
            }
            toggleMenu()
          }}
        >
          {args.summary}
        </button>
        <AnchorOverlay
          anchorRef={anchorRef}
          open={openMenuKey === args.key}
          onClose={() => {
            closeMenu()
            props.onToolbarInteractionEnd()
          }}
          align={args.portalPlacement === 'bottom-end' ? 'bottom-right' : 'bottom-left'}
          className=""
          autoFocus={false}
        >
          <div
            onPointerDownCapture={(event) => {
              props.holdToolbarInteraction()
            }}
            onMouseDownCapture={(event) => {
              props.holdToolbarInteraction()
            }}
            onPointerUpCapture={handleToolbarInteractionEndCapture}
            onMouseUpCapture={handleToolbarInteractionEndCapture}
          >
            {args.menu(closeMenu)}
          </div>
        </AnchorOverlay>
      </>
    )
  }
  const selectionActions = props.selectionActions
  return (
    <AnchorOverlay
      anchorRef={props.anchorRef}
      open
      align="top-center"
      className={props.floatingBubbleToolbarClassName}
      autoFocus={false}
      allowOverflowVisible
    >
      <menu
        ref={props.toolbarRef}
        className={toolbarRowClassName}
        aria-label="Inline selection toolbar"
        onPointerDownCapture={handleToolbarPointerDownCapture}
        onMouseDownCapture={handleToolbarMouseDownCapture}
        onPointerUpCapture={handleToolbarInteractionEndCapture}
        onMouseUpCapture={handleToolbarInteractionEndCapture}
        style={isTouchToolbarViewport ? { touchAction: 'pan-x manipulation' } : undefined}
      >
        {renderToolbarMenu({
          key: 'heading',
          ariaLabel: 'Heading',
          title: 'Heading',
          summary: <Heading2 className="w-3 h-3" strokeWidth={1.6} />,
          menu: close => (
            <menu className={toolbarMenuPanelClassName} aria-label="Turn into menu">
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyTurnInto('heading2'), close)}><Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />H2</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyTurnInto('code'), close)}><Code className="w-3 h-3 mr-1" strokeWidth={1.6} />Code block</button></li>
              <li className={props.toolbarMenuDividerClassName} />
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyToggleHeading(1), close)}><Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />H1</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyToggleHeading(2), close)}><Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />H2</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyToggleHeading(3), close)}><Heading2 className="w-3 h-3 mr-1" strokeWidth={1.6} />H3</button></li>
            </menu>
          ),
        })}
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyDraftAction('bold')} title="Bold"><Bold className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyDraftAction('italic')} title="Italic"><Italic className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyDraftAction('strike')} title="Strikethrough"><Strikethrough className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyDraftAction('inlineCode')} title="Inline Code"><Code className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyDraftAction('link')} title="Link"><LinkIcon className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyTurnInto('bulletList')} title="Bulleted List"><List className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyTurnInto('numberedList')} title="Numbered List"><ListOrdered className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyTurnInto('blockquote')} title="Quote"><Quote className="w-3 h-3" strokeWidth={1.8} /></button>
        {renderToolbarMenu({
          key: 'align',
          ariaLabel: 'Align',
          summary: <AlignLeft className="w-3 h-3" strokeWidth={1.8} />,
          menu: close => (
            <menu className={toolbarMenuPanelClassName} aria-label="Align menu">
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyAlign('left'), close)}>Left</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyAlign('center'), close)}>Center</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyAlign('right'), close)}>Right</button></li>
            </menu>
          ),
        })}
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyWrap('<u>', '</u>')} title="Underline"><Underline className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyWrap('^', '^')} title="Superscript"><Superscript className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyWrap('~', '~')} title="Subscript"><Subscript className="w-3 h-3" strokeWidth={1.8} /></button>
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={() => props.applyWrap('$', '$')} title="Math"><span className="text-[10px] leading-none">∑</span></button>
        {renderToolbarMenu({
          key: 'highlight',
          ariaLabel: 'Highlight',
          title: 'Highlight',
          summary: <Highlighter className="w-3 h-3" strokeWidth={1.8} />,
          menu: close => (
            <menu className={toolbarMenuPanelClassName} aria-label="Highlight menu">
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => props.applyWrap('==', '=='), close)}>Default (==)</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ backgroundColor: '#FEF08A' }} onClick={(event) => runMenuAction(event, () => props.applyHighlightColor('#FEF08A'), close)}>Yellow</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ backgroundColor: '#BBF7D0' }} onClick={(event) => runMenuAction(event, () => props.applyHighlightColor('#BBF7D0'), close)}>Green</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ backgroundColor: '#BFDBFE' }} onClick={(event) => runMenuAction(event, () => props.applyHighlightColor('#BFDBFE'), close)}>Blue</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ backgroundColor: '#FBCFE8' }} onClick={(event) => runMenuAction(event, () => props.applyHighlightColor('#FBCFE8'), close)}>Pink</button></li>
            </menu>
          ),
        })}
        {renderToolbarMenu({
          key: 'text-color',
          ariaLabel: 'Text color',
          title: 'Text color',
          summary: <Palette className="w-3 h-3" strokeWidth={1.8} />,
          menu: close => (
            <menu className={toolbarMenuPanelClassName} aria-label="Text color menu">
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ color: '#EF4444' }} onClick={(event) => runMenuAction(event, () => props.applyColor('#EF4444'), close)}>Red</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ color: '#10B981' }} onClick={(event) => runMenuAction(event, () => props.applyColor('#10B981'), close)}>Green</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ color: '#3B82F6' }} onClick={(event) => runMenuAction(event, () => props.applyColor('#3B82F6'), close)}>Blue</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} style={{ color: '#6B7280' }} onClick={(event) => runMenuAction(event, () => props.applyColor('#6B7280'), close)}>Gray</button></li>
            </menu>
          ),
        })}
        <button type="button" className={props.floatingBubbleButtonClassName} onClick={props.applyClearFormatting} title="Clear formatting"><Eraser className="w-3 h-3" strokeWidth={1.8} /></button>
        <button
          type="button"
          className={props.floatingBubbleButtonClassName}
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            props.applyComment()
          }}
          title="Comment"
        >
          <MessageSquare className="w-3 h-3" strokeWidth={1.8} />
        </button>
        {renderToolbarMenu({
          key: 'more',
          ariaLabel: 'More',
          title: 'More',
          portalPlacement: 'bottom-end',
          summary: <MoreHorizontal className="w-3 h-3" strokeWidth={1.8} />,
          menu: close => (
            <menu className={toolbarMenuPanelClassName} aria-label="More actions">
              {selectionActions ? (
                <>
                  <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, () => selectionActions.onShowOnCanvas(selectionActions.startLine, selectionActions.endLine), close)}>Show on Canvas</button></li>
                  <li className="list-none"><button type="button" className={selectionActions.currentView === 'markdown.viewer' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'markdown.viewer'} onClick={(event) => runMenuAction(event, () => selectionActions.onShowInViewer(selectionActions.startLine), close)}>Show in Viewer</button></li>
                  <li className="list-none"><button type="button" className={selectionActions.currentView === 'markdown.editor' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'markdown.editor'} onClick={(event) => runMenuAction(event, () => selectionActions.onShowInEditor(selectionActions.startLine), close)}>Show in Editor</button></li>
                  <li className="list-none"><button type="button" className={selectionActions.currentView === 'markdown.presentation' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'markdown.presentation'} onClick={(event) => runMenuAction(event, () => selectionActions.onShowInPresentation(selectionActions.startLine), close)}>Show in Presentation</button></li>
                  <li className="list-none"><button type="button" className={selectionActions.currentView === 'markdown.slides' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'markdown.slides'} onClick={(event) => runMenuAction(event, () => selectionActions.onShowInSlidesGallery(selectionActions.startLine), close)}>Show in Slides Gallery</button></li>
                  <li className="list-none"><button type="button" className={selectionActions.currentView === 'table' ? props.floatingMenuButtonDisabledClassName : props.toolbarMenuButtonClassName} disabled={selectionActions.currentView === 'table'} onClick={(event) => runMenuAction(event, () => selectionActions.onShowInGraphDataTable(selectionActions.startLine), close)}>Show in Graph Data Table</button></li>
                  <li className={props.toolbarMenuDividerClassName} />
                </>
              ) : (
                <>
                  <li className="list-none"><button type="button" className={props.floatingMenuButtonDisabledClassName} disabled>Copy</button></li>
                  <li className="list-none"><button type="button" className={props.floatingMenuButtonDisabledClassName} disabled>Copy link to block</button></li>
                  <li className={props.toolbarMenuDividerClassName} />
                </>
              )}
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, props.applyChecklist, close)}>Checklist</button></li>
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, props.applyDivider, close)}>Divider</button></li>
              <li className={props.toolbarMenuDividerClassName} />
              <li className="list-none"><button type="button" className={props.toolbarMenuButtonClassName} onClick={(event) => runMenuAction(event, props.handleDuplicate, close)}>Duplicate</button></li>
              <li className="list-none"><button type="button" className={props.floatingMenuButtonDangerClassName} onClick={(event) => runMenuAction(event, props.handleDelete, close)}>Delete</button></li>
            </menu>
          ),
        })}
      </menu>
    </AnchorOverlay>
  )
}
