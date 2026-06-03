import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import { UI_RESPONSIVE_TINY_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME } from '@/lib/ui/responsiveElementClasses'

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
    <ToolbarDropdownSelect
      value={tab}
      options={INSPECTOR_TABS.map(item => ({ id: item.id, title: item.label }))}
      title={`Inspector section: ${INSPECTOR_TABS.find(item => item.id === tab)?.label || 'Node'}`}
      showTooltip={false}
      isButtonActive={true}
      disabled={!active}
      onSelect={id => setTab(id as InspectorTab)}
      renderButtonContent={activeOption => <span>{activeOption.title}</span>}
      renderOptionContent={option => <span className="truncate">{option.title}</span>}
      menuWidthClass={UI_RESPONSIVE_TINY_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME}
    />
  )
}
