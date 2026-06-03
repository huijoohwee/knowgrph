import React from 'react'

import { RotateCcw, Save } from 'lucide-react'

import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { usePanelTypography } from '@/lib/ui/panelTypography'
import { getIconSizeClass } from '@/lib/ui'
import { PlainTextInputEditor } from '@/components/ui/PlainTextInputEditor'
import { ToolbarDropdownSelect } from '@/components/toolbar/ToolbarDropdownSelect'
import {
  UI_RESPONSIVE_FLOW_MANAGER_ACTION_MENU_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_PANEL_BODY_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_PANEL_HEADER_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_SPEC_EDITOR_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_STATUS_TEXT_CLASSNAME,
  UI_RESPONSIVE_FLOW_MANAGER_TOOLBAR_ROW_CLASSNAME,
  UI_RESPONSIVE_SLIM_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME,
} from '@/lib/ui/responsiveElementClasses'

import {
  buildDefaultFlowNodeSpec,
  buildDefaultFlowWorkflowSpec,
  validateFlowNodeSpec,
  validateFlowWorkflowSpec,
} from '@/features/flow-editor-manager/spec/specValidation'
import {
  readFlowNodeSpecFromStorage,
  readFlowWorkflowSpecFromStorage,
  writeFlowNodeSpecToStorage,
  writeFlowWorkflowSpecToStorage,
} from '@/features/flow-editor-manager/spec/specStorage'

type SpecTab = 'node' | 'workflow'

export default function FlowEditorSpecificationTab({
  onRegisterActions,
}: {
  onRegisterActions?: (actions: {
    apply?: () => void
    reset?: () => void
    applyDisabled?: boolean
    resetDisabled?: boolean
  }) => void
}) {
  const panelTypography = usePanelTypography()
  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const uiIconStrokeWidth = useGraphStore(s => s.uiIconStrokeWidth)
  const uiPanelKeyValueInputClass = useGraphStore(s => s.uiPanelKeyValueInputClass)
  const uiPanelTextFontClass = useGraphStore(s => s.uiPanelTextFontClass)
  const uiPanelKeyValueTextSizeClass = useGraphStore(s => s.uiPanelKeyValueTextSizeClass)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  const [tab, setTab] = React.useState<SpecTab>('node')
  const [nodeText, setNodeText] = React.useState<string>(() => {
    const spec = readFlowNodeSpecFromStorage() || buildDefaultFlowNodeSpec({ nodeTypeId: 'Node' })
    try {
      return JSON.stringify(spec, null, 2)
    } catch {
      return '{}'
    }
  })
  const [workflowText, setWorkflowText] = React.useState<string>(() => {
    const spec = readFlowWorkflowSpecFromStorage() || buildDefaultFlowWorkflowSpec({ workflowId: 'workflow' })
    try {
      return JSON.stringify(spec, null, 2)
    } catch {
      return '{}'
    }
  })
  const [error, setError] = React.useState<string | null>(null)
  const specTabOptions = React.useMemo(
    () =>
      [
        { id: 'node' as const, title: UI_LABELS.node },
        { id: 'workflow' as const, title: UI_LABELS.workflow },
      ] satisfies Array<{ id: SpecTab; title: string }>,
    [],
  )

  const resetNode = React.useCallback(() => {
    setError(null)
    const spec = readFlowNodeSpecFromStorage() || buildDefaultFlowNodeSpec({ nodeTypeId: 'Node' })
    try {
      setNodeText(JSON.stringify(spec, null, 2))
    } catch {
      setNodeText('{}')
    }
  }, [])

  const resetWorkflow = React.useCallback(() => {
    setError(null)
    const spec = readFlowWorkflowSpecFromStorage() || buildDefaultFlowWorkflowSpec({ workflowId: 'workflow' })
    try {
      setWorkflowText(JSON.stringify(spec, null, 2))
    } catch {
      setWorkflowText('{}')
    }
  }, [])

  const saveNode = React.useCallback(() => {
    setError(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(nodeText || '{}')
    } catch (err) {
      setError(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    const res = validateFlowNodeSpec(parsed)
    if (res.ok !== true) {
      setError(res.error)
      return
    }
    writeFlowNodeSpecToStorage(res.value)
  }, [nodeText])

  const saveWorkflow = React.useCallback(() => {
    setError(null)
    let parsed: unknown
    try {
      parsed = JSON.parse(workflowText || '{}')
    } catch (err) {
      setError(`Invalid JSON: ${err instanceof Error ? err.message : String(err)}`)
      return
    }
    const res = validateFlowWorkflowSpec(parsed)
    if (res.ok !== true) {
      setError(res.error)
      return
    }
    writeFlowWorkflowSpecToStorage(res.value)
  }, [workflowText])

  React.useEffect(() => {
    if (!onRegisterActions) return
    onRegisterActions({
      apply: tab === 'node' ? saveNode : saveWorkflow,
      reset: tab === 'node' ? resetNode : resetWorkflow,
      applyDisabled: false,
      resetDisabled: false,
    })
  }, [onRegisterActions, resetNode, resetWorkflow, saveNode, saveWorkflow, tab])

  return (
    <section className="h-full min-h-0 flex flex-col" aria-label="Flow Editor Specification">
      <header className={`${UI_RESPONSIVE_FLOW_MANAGER_PANEL_HEADER_CLASSNAME} ${UI_THEME_TOKENS.panel.border}`}>
        <nav className={`${UI_RESPONSIVE_FLOW_MANAGER_TOOLBAR_ROW_CLASSNAME} flex-wrap`} aria-label="Specification toolbar">
          <menu className={UI_RESPONSIVE_FLOW_MANAGER_ACTION_MENU_CLASSNAME} aria-label="Specification actions">
            <li>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={tab === 'node' ? resetNode : resetWorkflow}
                title={UI_LABELS.reset}
                aria-label={UI_LABELS.reset}
              >
                <RotateCcw className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </button>
            </li>
            <li>
              <button
                type="button"
                className={`App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
                onClick={tab === 'node' ? saveNode : saveWorkflow}
                title={UI_LABELS.save}
                aria-label={UI_LABELS.save}
              >
                <Save className={iconSizeClass} strokeWidth={uiIconStrokeWidth} />
              </button>
            </li>
          </menu>
          <ToolbarDropdownSelect
            value={tab}
            options={specTabOptions}
            title={`Specification section: ${specTabOptions.find(option => option.id === tab)?.title || UI_LABELS.node}`}
            showTooltip={false}
            isButtonActive={true}
            onSelect={id => setTab(id as SpecTab)}
            renderButtonContent={activeOption => <span>{activeOption.title}</span>}
            renderOptionContent={option => <span className="truncate">{option.title}</span>}
            menuWidthClass={UI_RESPONSIVE_SLIM_TOOLBAR_DROPDOWN_WIDTH_CLASSNAME}
          />
        </nav>
      </header>

      {error ? (
        <p className={`${UI_RESPONSIVE_FLOW_MANAGER_STATUS_TEXT_CLASSNAME} ${panelTypography.microLabelClass} text-red-700 dark:text-red-400`} role="status">
          {error}
        </p>
      ) : null}

      <section className={`${UI_RESPONSIVE_FLOW_MANAGER_PANEL_BODY_CLASSNAME} flex-1 min-h-0 overflow-auto`} aria-label="Specification editor">
        <section
          role="tabpanel"
          aria-label="Node spec"
          className={tab === 'node' ? 'block' : 'hidden'}
        >
          <label className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`} htmlFor="flow-node-spec-editor">
            Node spec JSON
          </label>
          <PlainTextInputEditor
            id="flow-node-spec-editor"
            className={`${UI_RESPONSIVE_FLOW_MANAGER_SPEC_EDITOR_CLASSNAME} rounded-md border ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} ${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`}
            value={nodeText}
            onChange={setNodeText}
            multiline
          />
        </section>

        <section
          role="tabpanel"
          aria-label="Workflow spec"
          className={tab === 'workflow' ? 'block' : 'hidden'}
        >
          <label className={`${panelTypography.microLabelClass} ${UI_THEME_TOKENS.text.secondary}`} htmlFor="flow-workflow-spec-editor">
            Workflow spec JSON
          </label>
          <PlainTextInputEditor
            id="flow-workflow-spec-editor"
            className={`${UI_RESPONSIVE_FLOW_MANAGER_SPEC_EDITOR_CLASSNAME} rounded-md border ${uiPanelTextFontClass} ${uiPanelKeyValueTextSizeClass} ${uiPanelKeyValueInputClass} ${UI_THEME_TOKENS.input.bg} ${UI_THEME_TOKENS.input.border} ${UI_THEME_TOKENS.input.text}`}
            value={workflowText}
            onChange={setWorkflowText}
            multiline
          />
        </section>
      </section>
    </section>
  )
}
