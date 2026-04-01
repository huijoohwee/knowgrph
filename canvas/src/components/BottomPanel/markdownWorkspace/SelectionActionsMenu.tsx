import React from 'react'
import { MoreHorizontal } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

type SelectionActionsMenuProps = {
  textSizeClass: string
  activeEntryName: string
  clearLabel: string
  canClearActiveSelection: boolean
  onClearActiveSelection: () => void
  canRefreshActiveFromSource: boolean
  onRefreshActiveFromSource: () => void
  canDeleteActive: boolean
  onDeleteActive: () => void
}

export function SelectionActionsMenu(props: SelectionActionsMenuProps) {
  const {
    textSizeClass,
    activeEntryName,
    clearLabel,
    canClearActiveSelection,
    onClearActiveSelection,
    canRefreshActiveFromSource,
    onRefreshActiveFromSource,
    canDeleteActive,
    onDeleteActive,
  } = props
  const hasSelectionActions = canClearActiveSelection || canRefreshActiveFromSource || canDeleteActive
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
      <button
        type="button"
        className={`kg-toolbar-btn shrink-0 inline-flex items-center justify-center rounded cursor-pointer ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
        aria-label={activeEntryName ? `Actions for ${activeEntryName}` : 'Selection actions'}
        aria-haspopup="menu"
        aria-expanded={selectionMenuOpen}
        title="Selection actions"
        onClick={() => setSelectionMenuOpen(v => !v)}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {selectionMenuOpen ? (
        <section
          className={`absolute right-0 mt-1 min-w-40 ${UI_THEME_TOKENS.panel.bg} border ${UI_THEME_TOKENS.panel.border} rounded shadow-md ${textSizeClass} ${UI_THEME_TOKENS.text.primary} p-1 z-50`}
          role="menu"
          aria-label="Selection actions menu"
        >
          <ul className="list-none m-0 p-0">
            {canRefreshActiveFromSource ? (
              <li className="list-none">
                <button
                  type="button"
                  className={`w-full text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  aria-label={activeEntryName ? `Refresh ${activeEntryName}` : 'Refresh from URL'}
                  role="menuitem"
                  onClick={() => {
                    setSelectionMenuOpen(false)
                    onRefreshActiveFromSource()
                  }}
                >
                  Refresh from URL
                </button>
              </li>
            ) : null}
            {canClearActiveSelection ? (
              <li className="list-none">
                <button
                  type="button"
                  className={`w-full text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  role="menuitem"
                  onClick={() => {
                    setSelectionMenuOpen(false)
                    onClearActiveSelection()
                  }}
                >
                  {clearLabel}
                </button>
              </li>
            ) : null}
            {canDeleteActive ? (
              <li className="list-none">
                <button
                  type="button"
                  className={`w-full text-left rounded px-2 py-1 ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                  role="menuitem"
                  onClick={() => {
                    setSelectionMenuOpen(false)
                    onDeleteActive()
                  }}
                >
                  Delete
                </button>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}
    </li>
  )
}
