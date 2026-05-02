import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
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
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') setSelectionMenuOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectionMenuOpen])

  React.useEffect(() => {
    if (!selectionMenuOpen) return
    const onDown = (ev: PointerEvent) => {
      const root = selectionMenuRootRef.current
      const target = ev.target as Node | null
      if (!root || !target) return
      if (root.contains(target)) return
      setSelectionMenuOpen(false)
    }
    document.addEventListener('pointerdown', onDown, true)
    return () => document.removeEventListener('pointerdown', onDown, true)
  }, [selectionMenuOpen])

  if (!hasSelectionActions) return null

  return (
    <li className="list-none relative" ref={el => (selectionMenuRootRef.current = el)}>
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
          className={`absolute right-0 mt-1 min-w-40 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md ${textSizeClass} ${UI_THEME_TOKENS.text.primary} p-1 z-50`}
          role="menu"
          aria-label="Selection actions menu"
        >
          <ul className="list-none m-0 p-0">
            {actionItems.map(item => (
              <li key={item.key} className="list-none">
                <button
                  type="button"
                  className={`w-full text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  aria-label={item.ariaLabel}
                  role="menuitem"
                  onClick={() => {
                    setSelectionMenuOpen(false)
                    item.onSelect()
                  }}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </li>
  )
}
