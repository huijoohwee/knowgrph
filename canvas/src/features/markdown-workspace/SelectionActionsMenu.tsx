import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_TEXT_TRUNCATE } from '@/lib/ui/textLayout'
import { UI_RESPONSIVE_MENU_ROW_CLASSNAME } from '@/lib/ui/responsiveElementClasses'
import { subscribePointerDownDismiss, subscribeWindowEscapeDismiss } from '@/lib/browser/dismissEvents'
import type { SelectionActionItem } from './selectionActionItems'
import { ExplorerToolbarIconButton } from './ExplorerToolbarIconButton'

type SelectionActionsMenuProps = {
  textSizeClass: string
  activeEntryName: string
  actionItems: SelectionActionItem[]
}

export function SelectionActionsMenu(props: SelectionActionsMenuProps) {
  const { textSizeClass, activeEntryName, actionItems } = props
  const hasSelectionActions = actionItems.length > 0
  const [selectionMenuOpen, setSelectionMenuOpen] = React.useState(false)
  const selectionMenuRootRef = React.useRef<HTMLElement | null>(null)

  React.useEffect(() => {
    if (hasSelectionActions) return
    setSelectionMenuOpen(false)
  }, [hasSelectionActions])

  React.useEffect(() => {
    if (!selectionMenuOpen) return
    return subscribeWindowEscapeDismiss(() => {
      setSelectionMenuOpen(false)
    })
  }, [selectionMenuOpen])

  React.useEffect(() => {
    if (!selectionMenuOpen) return
    return subscribePointerDownDismiss({
      listener: () => {
        setSelectionMenuOpen(false)
      },
      root: selectionMenuRootRef.current,
      target: 'document',
      capture: true,
    })
  }, [selectionMenuOpen])

  if (!hasSelectionActions) return null

  return (
    <li className="list-none relative min-w-0 max-w-full" ref={el => (selectionMenuRootRef.current = el)}>
      <ExplorerToolbarIconButton
        ariaLabel={activeEntryName ? `Actions for ${activeEntryName}` : 'Selection actions'}
        ariaHaspopup="menu"
        ariaExpanded={selectionMenuOpen}
        title="Selection actions"
        onClick={() => setSelectionMenuOpen(v => !v)}
        className="cursor-pointer"
      >
        <MoreHorizontal className="w-4 h-4" />
      </ExplorerToolbarIconButton>
      {selectionMenuOpen ? (
        <section
          className={`kg-selection-actions-menu absolute right-0 mt-1 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md ${textSizeClass} ${UI_THEME_TOKENS.text.primary} p-1 z-50`}
          role="menu"
          aria-label="Selection actions menu"
        >
          <ul className="list-none m-0 p-0">
            {actionItems.map(item => (
              <li key={item.key} className="list-none">
                <button
                  type="button"
                  className={`${UI_RESPONSIVE_MENU_ROW_CLASSNAME} text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  aria-label={item.ariaLabel}
                  role="menuitem"
                  onClick={() => {
                    setSelectionMenuOpen(false)
                    item.onSelect()
                  }}
                >
                  <span className={['min-w-0 flex-1', UI_TEXT_TRUNCATE].join(' ')}>{item.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </li>
  )
}
