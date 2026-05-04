import React from 'react';
import CollapsibleSection from '@/features/panels/ui/CollapsibleSection';
import { HELP_STEP_COPY } from '@/features/panels/config';
import { UI_COPY } from '@/lib/config';
import { useGraphStore } from '@/hooks/useGraphStore';
import {
  uiPrimaryPillActiveClassName,
  uiToolbarButtonMutedClassName,
} from '@/features/toolbar/ui/toolbarStyles'
import {
  CANVAS_PRECEDENCE_RULES,
  CANVAS_SHORTCUTS,
  CANVAS_SHORTCUT_CATEGORIES,
  CANVAS_SHORTCUT_COPY_LINES,
  type CanvasShortcutCategory,
  getCanvasShortcutSearchText,
} from '@/lib/canvas/interaction-ssot'
import { normalized as normalizeText } from '@/features/panels/utils/json'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

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
  const shortcutsTableClassName = `overflow-auto rounded border ${UI_THEME_TOKENS.table.cellBorder}`

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
        <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary} mb-2`}>
          {HELP_STEP_COPY.shortcuts.descriptionShort}
        </p>
      )}

      <section className="mb-3" aria-label="Shortcut precedence rules">
        <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary} mb-1`}>
          Precedence rules
        </p>
        <ul className={`list-disc pl-5 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.primary} space-y-1`}>
          {CANVAS_PRECEDENCE_RULES.map(r => (
            <li key={r.id}>
              <span className="font-semibold">{r.rule}</span>{' '}
              <span className={UI_THEME_TOKENS.text.secondary}>{r.detail}</span>
            </li>
          ))}
        </ul>
      </section>

      <section aria-label="Canvas shortcuts" className="mb-3">
        <header className="flex items-center justify-between gap-2 mb-2">
          <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary}`}>
            Canvas shortcuts
          </p>
          <nav aria-label="Shortcut categories" className="flex flex-wrap gap-1">
            <button
              type="button"
              className={[
                'App-toolbar__btn text-xs',
                category === 'All' ? uiPrimaryPillActiveClassName : uiToolbarButtonMutedClassName,
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
                  category === c ? uiPrimaryPillActiveClassName : uiToolbarButtonMutedClassName,
                ].join(' ')}
                onClick={() => setCategory(c)}
                aria-pressed={category === c}
              >
                {c}
              </button>
            ))}
          </nav>
        </header>

        <section className={shortcutsTableClassName} aria-label="Canvas shortcut table">
          <table className={`w-full border-collapse ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass}`}>
            <thead>
              <tr className={UI_THEME_TOKENS.table.headerBg}>
                <th className={`text-left px-3 py-2 font-semibold ${UI_THEME_TOKENS.text.primary}`}>Action</th>
                <th className={`text-left px-3 py-2 font-semibold ${UI_THEME_TOKENS.text.primary}`}>Input</th>
                <th className={`text-left px-3 py-2 font-semibold ${UI_THEME_TOKENS.text.primary}`}>Mode(s)</th>
                <th className={`text-left px-3 py-2 font-semibold ${UI_THEME_TOKENS.text.primary}`}>Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredCanvasShortcuts.map(s => (
                <tr key={s.id} className={`border-t ${UI_THEME_TOKENS.table.cellBorder}`}>
                  <td className={`px-3 py-2 ${UI_THEME_TOKENS.text.primary}`}>{s.action}</td>
                  <td className={`px-3 py-2 ${UI_THEME_TOKENS.text.primary} font-mono`}>{s.input}</td>
                  <td className={`px-3 py-2 ${UI_THEME_TOKENS.text.primary}`}>{s.modes.join(', ')}</td>
                  <td className={`px-3 py-2 ${UI_THEME_TOKENS.text.secondary}`}>{s.notes || ''}</td>
                </tr>
              ))}
              {filteredCanvasShortcuts.length === 0 && (
                <tr className={`border-t ${UI_THEME_TOKENS.table.cellBorder}`}>
                  <td className={`px-3 py-3 ${UI_THEME_TOKENS.text.secondary}`} colSpan={4}>
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
          <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.secondary} mb-1`}>
            Other shortcuts
          </p>
          <ul className={`list-disc pl-5 ${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.primary} space-y-1`}>
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
          className={`App-toolbar__btn text-xs ${uiToolbarButtonMutedClassName}`}
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
        <p className={`${uiPanelKeyValueTextSizeClass} ${uiPanelTextFontClass} ${UI_THEME_TOKENS.text.tertiary}`}>
          {shortcutsText.length > 0 ? UI_COPY.helpShortcutsCountStatus(shortcuts.length) : UI_COPY.helpNoShortcutsMatched}
        </p>
      </section>
    </CollapsibleSection>
  );
}
