import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type FlowEditorInspectorJsonTarget =
  | 'nodeProps'
  | 'nodeMeta'
  | 'edgeProps'
  | 'edgeMeta'
  | 'workflowMeta'
  | 'workflowContext'

export function FlowEditorInspectorJsonButton({
  label,
  target,
  disabled,
  onApplyJson,
}: {
  label: string
  target: FlowEditorInspectorJsonTarget
  disabled?: boolean
  onApplyJson: (target: FlowEditorInspectorJsonTarget) => void
}) {
  return (
    <button
      type="button"
      className={`mt-2 App-toolbar__btn ${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`}
      onClick={() => onApplyJson(target)}
      disabled={disabled}
    >
      {label}
    </button>
  )
}
