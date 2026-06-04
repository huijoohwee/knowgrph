import React from 'react'
import { AnchorOverlay } from '@/lib/ui/overlay'
import { UI_RESPONSIVE_MARKDOWN_INLINE_MENU_LIST_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { uiToolbarRowScrollListClassName } from '@/features/toolbar/ui/toolbarStyles'
import { preventDefaultMouseDown } from '@/features/markdown/ui/markdownFloatingSelectionToolbar'

type VariableMode = 'ref' | 'create' | 'update' | 'fallback' | 'delete'

export const MarkdownBlockContainerInlineMenusOverlay = (props: {
  editDisableRichUi: boolean
  slashMenu: { show: boolean; leftPx: number; topPx: number }
  variableMenu: {
    show: boolean
    leftPx: number
    topPx: number
    query: string
    keyInput: string
    valueInput: string
    fallbackInput: string
    mode: VariableMode
  }
  linkPopover: { show: boolean; leftPx: number; topPx: number; href: string }
  slashAnchorRef: React.RefObject<HTMLSpanElement | null>
  variableAnchorRef: React.RefObject<HTMLSpanElement | null>
  linkAnchorRef: React.RefObject<HTMLSpanElement | null>
  variableMenuRef: React.RefObject<HTMLElement | null>
  onToolbarInteract: () => void
  onVariableMenuMouseDownCapture: () => void
  setSlashMenuStable: (next: { show: boolean; leftPx: number; topPx: number }) => void
  applyDraftAction: (action: 'heading2' | 'bulletList' | 'numberedList' | 'blockquote') => void
  applyToggleHeading: (level: 1 | 2 | 3) => void
  setVariableMenu: React.Dispatch<React.SetStateAction<{
    show: boolean
    leftPx: number
    topPx: number
    query: string
    keyInput: string
    valueInput: string
    fallbackInput: string
    mode: VariableMode
  }>>
  variableSuggestions: Array<{ key: string; value?: string | null; source?: string }>
  applyVariableToken: (mode: VariableMode, forcedKey?: string) => void
  floatingMenuLeftW220ClassName: string
  floatingMenuButtonClassName: string
  floatingMenuButtonDangerClassName: string
  floatingPopoverPanelClassName: string
  floatingPopoverInputClassName: string
  floatingBubbleButtonClassName: string
  onLinkSubmit: (event: React.FormEvent) => void
  onLinkHrefChange: (value: string) => void
  onLinkInputKeyDown: (event: React.KeyboardEvent<HTMLInputElement>) => void
  onLinkCancel: () => void
}) => {
  return (
    <>
      {!props.editDisableRichUi && props.slashMenu.show ? (
        <AnchorOverlay anchorRef={props.slashAnchorRef} open={props.slashMenu.show} align="bottom-left" className={props.floatingMenuLeftW220ClassName}>
          <menu className={UI_RESPONSIVE_MARKDOWN_INLINE_MENU_LIST_CLASSNAME} aria-label="Slash commands" onMouseDownCapture={props.onToolbarInteract}>
            <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => { props.applyDraftAction('heading2'); props.setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>Heading</button></li>
            <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => { props.applyDraftAction('bulletList'); props.setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>Bulleted list</button></li>
            <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => { props.applyDraftAction('numberedList'); props.setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>Numbered list</button></li>
            <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => { props.applyDraftAction('blockquote'); props.setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>Quote</button></li>
            <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => { props.applyToggleHeading(1); props.setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>H1</button></li>
            <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => { props.applyToggleHeading(2); props.setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>H2</button></li>
            <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => { props.applyToggleHeading(3); props.setSlashMenuStable({ show: false, leftPx: 0, topPx: 0 }) }}>H3</button></li>
          </menu>
        </AnchorOverlay>
      ) : null}
      {!props.editDisableRichUi && props.variableMenu.show ? (
        <AnchorOverlay anchorRef={props.variableAnchorRef} open={props.variableMenu.show} align="bottom-left" className={props.floatingMenuLeftW220ClassName}>
          <section ref={props.variableMenuRef} aria-label="Variable toolbar" onMouseDownCapture={props.onVariableMenuMouseDownCapture}>
            <menu className={`${uiToolbarRowScrollListClassName} gap-1 mb-2`}>
              <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.setVariableMenu(prev => ({ ...prev, mode: 'ref' }))}>Browse</button></li>
              <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.setVariableMenu(prev => ({ ...prev, mode: 'create' }))}>New Variable</button></li>
              <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.setVariableMenu(prev => ({ ...prev, mode: 'update' }))}>Edit Key</button></li>
              <li className="list-none"><button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.setVariableMenu(prev => ({ ...prev, mode: 'fallback' }))}>Reference</button></li>
            </menu>
            <input className={props.floatingPopoverInputClassName} placeholder="variable key" value={props.variableMenu.keyInput} onChange={(event) => props.setVariableMenu(prev => ({ ...prev, keyInput: event.target.value }))} />
            {(props.variableMenu.mode === 'create' || props.variableMenu.mode === 'update') ? (
              <input className={`${props.floatingPopoverInputClassName} mt-2`} placeholder="value" value={props.variableMenu.valueInput} onChange={(event) => props.setVariableMenu(prev => ({ ...prev, valueInput: event.target.value }))} />
            ) : null}
            {props.variableMenu.mode === 'fallback' ? (
              <input className={`${props.floatingPopoverInputClassName} mt-2`} placeholder="fallback key or value" value={props.variableMenu.fallbackInput} onChange={(event) => props.setVariableMenu(prev => ({ ...prev, fallbackInput: event.target.value }))} />
            ) : null}
            {props.variableSuggestions.length > 0 ? (
              <menu className={`mt-2 ${UI_RESPONSIVE_MARKDOWN_INLINE_MENU_LIST_CLASSNAME}`}>
                {props.variableSuggestions.map(suggestion => (
                  <li key={suggestion.key} className="list-none">
                    <button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.setVariableMenu(prev => ({ ...prev, keyInput: suggestion.key, query: suggestion.key }))}>
                      {`${suggestion.key}${suggestion.value != null ? ` = ${suggestion.value}` : ''}${suggestion.source === 'frontmatter' ? ' (fm)' : suggestion.source === 'inline' ? ' (inline)' : ''}`}
                    </button>
                  </li>
                ))}
              </menu>
            ) : null}
            <menu className={`${uiToolbarRowScrollListClassName} mt-2 gap-2`}>
              <li className="list-none">
                <button type="button" className={props.floatingMenuButtonClassName} onMouseDown={preventDefaultMouseDown} onClick={() => {
                  const forcedKey = props.variableMenu.mode === 'ref' ? (props.variableSuggestions[0]?.key || props.variableMenu.keyInput || props.variableMenu.query) : undefined
                  props.applyVariableToken(props.variableMenu.mode, forcedKey)
                }}>
                  Apply
                </button>
              </li>
              <li className="list-none">
                <button type="button" className={props.floatingMenuButtonDangerClassName} onMouseDown={preventDefaultMouseDown} onClick={() => props.applyVariableToken('delete')}>
                  Delete
                </button>
              </li>
            </menu>
          </section>
        </AnchorOverlay>
      ) : null}
      {!props.editDisableRichUi && props.linkPopover.show ? (
        <AnchorOverlay anchorRef={props.linkAnchorRef} open={props.linkPopover.show} align="bottom-left" className={props.floatingPopoverPanelClassName}>
          <section onMouseDownCapture={props.onToolbarInteract} aria-label="Edit link">
            <form onSubmit={props.onLinkSubmit}>
              <input
                type="url"
                autoFocus
                placeholder="https://example.com"
                className={props.floatingPopoverInputClassName}
                value={props.linkPopover.href}
                onChange={(event) => props.onLinkHrefChange(event.target.value)}
                onKeyDown={props.onLinkInputKeyDown}
              />
              <menu className={`${uiToolbarRowScrollListClassName} mt-2 gap-2`}>
                <button type="submit" className={props.floatingBubbleButtonClassName}>Apply Link</button>
                <button type="button" className={props.floatingBubbleButtonClassName} onClick={props.onLinkCancel}>Cancel</button>
              </menu>
            </form>
          </section>
        </AnchorOverlay>
      ) : null}
    </>
  )
}
