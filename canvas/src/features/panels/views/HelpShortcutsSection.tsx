import React from 'react';
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection';
import { HELP_STEP_COPY } from '@/features/panels/config';
import { UI_COPY } from '@/lib/config';
import { useGraphStore } from '@/hooks/useGraphStore';
import { uiPrimaryPillActiveClassName } from '@/features/graph-data-table/ui/GraphDataTableToolbarStyles';
import {
  CANVAS_PRECEDENCE_RULES,
  CANVAS_SHORTCUTS,
  CANVAS_SHORTCUT_CATEGORIES,
  CANVAS_SHORTCUT_COPY_LINES,
  type CanvasShortcutCategory,
  getCanvasShortcutSearchText,
} from '@/lib/canvas/interaction-ssot'
import { normalized as normalizeText } from '@/features/panels/utils/json'

interface HelpShortcutsSectionProps {
  collapsed: boolean;
  onToggle: (next: boolean) => void;
  searchQuery: string;
  shortcuts: string[];
  onCopyAllShortcuts: () => void;
  onLaunchSpotlight: () => void;
}

export function HelpShortcutsSection({
  collapsed,
  onToggle,
  searchQuery,
  shortcuts,
  onCopyAllShortcuts,
  onLaunchSpotlight,
}: HelpShortcutsSectionProps) {
  const uiPanelKeyValueTextSizeClass = useGraphStore(
    s => s.uiPanelKeyValueTextSizeClass || 'text-sm',
  );
  const uiPanelTextFontClass = useGraphStore(
    s => s.uiPanelTextFontClass || 'font-sans',
  );

  const shortcutsText = React.useMemo(() => shortcuts.join('\n'), [shortcuts]);
  const normalizedQuery = React.useMemo(() => normalizeText(searchQuery).trim(), [searchQuery])
  const [category, setCategory] = React.useState<CanvasShortcutCategory | 'All'>('All')

  React.useEffect(() => {
    setCategory('All')
  }, [searchQuery])

  const filteredCanvasShortcuts = React.useMemo(() => {
    const base = category === 'All' ? CANVAS_SHORTCUTS : CANVAS_SHORTCUTS.filter(s => s.category === category)
    if (!normalizedQuery) return base
    return base.filter(s => normalizeText(getCanvasShortcutSearchText(s)).includes(normalizedQuery))
  }, [category, normalizedQuery])

  const otherShortcuts = React.useMemo(() => {
    const canvasSet = new Set(CANVAS_SHORTCUT_COPY_LINES)
    return shortcuts.filter(s => !canvasSet.has(s))
  }, [shortcuts])

  return (
    <CollapsibleSection
      title={HELP_STEP_COPY.shortcuts.title}
      collapsed={collapsed}
      onToggle={onToggle}
    >
      {HELP_STEP_COPY.shortcuts.descriptionShort && (
        <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-2`}>
          {HELP_STEP_COPY.shortcuts.descriptionShort}
        </p>
      )}

      <section className="mb-3" aria-label="Shortcut precedence rules">
        <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-1`}>
          Precedence rules
        </p>
        <ul className={`list-disc pl-5 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700 space-y-1`}>
          {CANVAS_PRECEDENCE_RULES.map(r => (
            <li key={r.id}>
              <span className="font-semibold">{r.rule}</span>{' '}
              <span className="text-gray-600">{r.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Canvas shortcuts" className="mb-3">
        <header className="flex items-center justify-between gap-2 mb-2">
          <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600`}>
            Canvas shortcuts
          </p>
          <nav aria-label="Shortcut categories" className="flex flex-wrap gap-1">
            <button
              type="button"
              className={[
                'App-toolbar__btn text-xs',
                category === 'All' ? uiPrimaryPillActiveClassName : 'bg-gray-100 text-gray-700',
              ].join(' ')}
              onClick={() => setCategory('All')}
              aria-pressed={category === 'All'}
            >
              All
            </button>
            {CANVAS_SHORTCUT_CATEGORIES.map(c => (
              <button
                key={c}
                type="button"
                className={[
                  'App-toolbar__btn text-xs',
                  category === c ? uiPrimaryPillActiveClassName : 'bg-gray-100 text-gray-700',
                ].join(' ')}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
              >
                {c}
              </button>
            ))}
          </nav>
        </header>

        <section className="overflow-auto rounded border border-gray-200" aria-label="Canvas shortcut table">
          <table className={`w-full border-collapse ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}>
            <thead>
              <tr className="bg-gray-50">
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Action</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Input</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Mode(s)</th>
                <th className="text-left px-3 py-2 font-semibold text-gray-700">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredCanvasShortcuts.map(s => (
                <tr key={s.id} className="border-t border-gray-200">
                  <td className="px-3 py-2 text-gray-800">{s.action}</td>
                  <td className="px-3 py-2 text-gray-800 font-mono">{s.input}</td>
                  <td className="px-3 py-2 text-gray-700">{s.modes.join(', ')}</td>
                  <td className="px-3 py-2 text-gray-600">{s.notes || ''}</td>
                </tr>
              ))}
              {filteredCanvasShortcuts.length === 0 && (
                <tr className="border-t border-gray-200">
                  <td className="px-3 py-3 text-gray-600" colSpan={4}>
                    {UI_COPY.helpNoShortcutsMatched}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </section>

      {otherShortcuts.length > 0 && (
        <section aria-label="Other shortcuts" className="mb-3">
          <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-600 mb-1`}>
            Other shortcuts
          </p>
          <ul className={`list-disc pl-5 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-700 space-y-1`}>
            {otherShortcuts.map(shortcut => (
              <li key={shortcut}>{shortcut}</li>
            ))}
          </ul>
        </section>
      )}

      <section className="mb-2 flex items-center gap-2" aria-label="Help shortcut actions">
        <button
          type="button"
          onClick={onCopyAllShortcuts}
          className="App-toolbar__btn text-xs bg-gray-100 text-gray-700"
        >
          Copy All
        </button>
        <button
          type="button"
          onClick={onLaunchSpotlight}
          className={`App-toolbar__btn text-xs ${uiPrimaryPillActiveClassName}`}
        >
          Launch
        </button>
        <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} text-gray-500`}>
          {shortcutsText.length > 0 ? UI_COPY.helpShortcutsCountStatus(shortcuts.length) : UI_COPY.helpNoShortcutsMatched}
        </p>
      </section>
    </CollapsibleSection>
  );
}
