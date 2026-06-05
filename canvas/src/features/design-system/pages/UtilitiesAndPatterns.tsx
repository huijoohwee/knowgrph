import React from 'react'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { UI_FOCUS_RING, UI_SURFACE_CARD, UI_TABLE } from '@/lib/ui'
import { cn } from '@/lib/utils'

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={cn('p-4', UI_SURFACE_CARD)}>
      <h3 className="m-0 text-sm font-semibold">{title}</h3>
      <section className="mt-3">{children}</section>
    </section>
  )
}

export default function UtilitiesAndPatterns() {
  const [dense, setDense] = React.useState(false)
  const [selectionMode, setSelectionMode] = React.useState<'single' | 'multi'>('single')
  const [large, setLarge] = React.useState(false)

  const rows = React.useMemo(() => {
    const count = large ? 500 : 12
    return Array.from({ length: count }).map((_, index) => ({
      id: String(index + 1),
      status: index % 3 === 0 ? 'Todo' : index % 3 === 1 ? 'Doing' : 'Done',
      progress: index % 6 === 0 ? 100 : index % 6 === 1 ? 60 : index % 6 === 2 ? 20 : 0,
      tag: index % 2 === 0 ? 'A' : 'B',
    }))
  }, [large])

  return (
    <article className="flex flex-col gap-4" aria-label="Utilities and table patterns">
      <Card title="Utility reference">
        <ul className={cn('m-0 pl-5 text-sm', UI_THEME_TOKENS.text.secondary)}>
          <li>Use `UI_FOCUS_RING` for keyboard-visible focus states across interactive controls.</li>
          <li>Use `UI_SURFACE_CARD` for card-like surfaces; do not restyle ad-hoc per feature.</li>
          <li>Use `UI_TABLE.*` for table/kanban shared styling primitives.</li>
        </ul>
      </Card>

      <Card title="Table patterns (Kanban/Table/Graph)">
        <section className="flex flex-wrap items-center gap-3" aria-label="Demo controls">
          <button
            type="button"
            className={cn('px-3 py-2 rounded-md border text-xs', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_FOCUS_RING)}
            onClick={() => setDense(v => !v)}
          >
            Density: {dense ? 'Dense' : 'Comfortable'}
          </button>
          <button
            type="button"
            className={cn('px-3 py-2 rounded-md border text-xs', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_FOCUS_RING)}
            onClick={() => setSelectionMode(m => (m === 'single' ? 'multi' : 'single'))}
          >
            Selection: {selectionMode === 'single' ? 'Single' : 'Multi'}
          </button>
          <button
            type="button"
            className={cn('px-3 py-2 rounded-md border text-xs', UI_THEME_TOKENS.panel.border, UI_THEME_TOKENS.button.hoverBg, UI_FOCUS_RING)}
            onClick={() => setLarge(v => !v)}
          >
            Dataset: {large ? 'Large' : 'Small'}
          </button>
        </section>

        <section className={cn('mt-3 overflow-auto rounded-md border', UI_THEME_TOKENS.panel.border)} aria-label="Demo table">
          <table className={cn('w-full border-collapse text-sm', UI_TABLE.tableBase)}>
            <thead className={cn(UI_TABLE.headerRow)}>
              <tr>
                <th scope="col" className={cn('text-left', UI_TABLE.headerCell)}>
                  ID
                </th>
                <th scope="col" className={cn('text-left', UI_TABLE.headerCell)}>
                  Status
                </th>
                <th scope="col" className={cn('text-left', UI_TABLE.headerCell)}>
                  Tag
                </th>
                <th scope="col" className={cn('text-left', UI_TABLE.headerCell)}>
                  Progress
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.id}
                  className={cn(UI_TABLE.rowBase, dense ? UI_TABLE.rowDense : UI_TABLE.rowComfortable)}
                >
                  <td className={cn(UI_TABLE.cell)}>{r.id}</td>
                  <td className={cn(UI_TABLE.cell)}>{r.status}</td>
                  <td className={cn(UI_TABLE.cell)}>{r.tag}</td>
                  <td className={cn(UI_TABLE.cell)}>
                    <section className="h-2 rounded bg-[var(--kg-divider)]">
                      <section
                        className="h-2 rounded bg-[var(--kg-focus-ring)]"
                        style={{ width: `${Math.max(0, Math.min(100, r.progress))}%` }}
                      />
                    </section>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <p className={cn('mt-3 mb-0 text-xs', UI_THEME_TOKENS.text.secondary)}>
          This demo illustrates token-backed primitives for density and selection surfaces; feature tables should share selection/keyboard/virtualization logic.
        </p>
      </Card>

      <Card title="Migration guidance">
        <ol className={cn('m-0 pl-5 text-sm', UI_THEME_TOKENS.text.secondary)}>
          <li>Identify local constants and per-feature Tailwind color/spacing utilities.</li>
          <li>Map to semantic token(s) and replace via shared UI utilities.</li>
          <li>Validate theme switching and keyboard focus visibility.</li>
        </ol>
      </Card>
    </article>
  )
}
