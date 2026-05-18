import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type InspectorTab = 'node' | 'edge' | 'workflow' | 'groups'

const INSPECTOR_TABS: ReadonlyArray<{ id: InspectorTab; label: string }> = [
  { id: 'node', label: 'Node' },
  { id: 'edge', label: 'Edge' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'groups', label: 'Groups' },
]

export function FlowEditorInspectorTabs({
  active,
  tab,
  setTab,
}: {
  active: boolean
  tab: InspectorTab
  setTab: (tab: InspectorTab) => void
}) {
  return (
    <menu className="flex items-center gap-1" aria-label="Inspector tabs">
      {INSPECTOR_TABS.map(item => (
        <button
          key={item.id}
          type="button"
          className={`App-toolbar__btn ${
            tab === item.id
              ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
              : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
          }`}
          onClick={() => setTab(item.id)}
          disabled={!active}
        >
          {item.label}
        </button>
      ))}
    </menu>
  )
}
