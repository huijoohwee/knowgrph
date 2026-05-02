import React from 'react'
import { Search } from 'lucide-react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { ExplorerToolbarIconButton } from './ExplorerToolbarIconButton'

type ExplorerSearchControlProps = {
  search: string
  setSearch: (next: string) => void
  panelTextClass: string
}

export const ExplorerSearchControl = React.memo(function ExplorerSearchControl(props: ExplorerSearchControlProps) {
  const { search, setSearch, panelTextClass } = props
  const [searchExpanded, setSearchExpanded] = React.useState(() => search.trim().length > 0)
  const searchInputRef = React.useRef<HTMLInputElement | null>(null)

  React.useEffect(() => {
    if (!searchExpanded) return
    const t = window.setTimeout(() => {
      searchInputRef.current?.focus()
      try {
        const len = searchInputRef.current?.value.length ?? 0
        searchInputRef.current?.setSelectionRange(len, len)
      } catch {
        void 0
      }
    }, 0)
    return () => window.clearTimeout(t)
  }, [searchExpanded])

  React.useEffect(() => {
    if (search.trim().length === 0 || searchExpanded) return
    setSearchExpanded(true)
  }, [search, searchExpanded])

  return (
    <label className="flex items-center gap-1" aria-label="Search files">
      <input
        ref={searchInputRef}
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search"
        className={[
          'min-w-0 h-[var(--kg-control-height,28px)] rounded border',
          UI_THEME_TOKENS.input.border,
          UI_THEME_TOKENS.input.bg,
          UI_THEME_TOKENS.input.text,
          panelTextClass,
          'px-2 transition-[width,opacity,padding] duration-150',
          searchExpanded ? 'w-40 opacity-100' : 'w-0 opacity-0 px-0 border-transparent',
        ].join(' ')}
        onKeyDown={e => {
          if (e.key !== 'Escape') return
          if (search.trim().length > 0) {
            setSearch('')
            return
          }
          setSearchExpanded(false)
        }}
        onBlur={() => {
          if (search.trim().length > 0) return
          setSearchExpanded(false)
        }}
      />
      <ExplorerToolbarIconButton
        ariaLabel={searchExpanded ? 'Hide search' : 'Show search'}
        title="Search"
        onClick={() => {
          setSearchExpanded(prev => {
            if (prev && search.trim().length === 0) return false
            return true
          })
        }}
      >
        <Search className="w-4 h-4 shrink-0" />
      </ExplorerToolbarIconButton>
    </label>
  )
})
