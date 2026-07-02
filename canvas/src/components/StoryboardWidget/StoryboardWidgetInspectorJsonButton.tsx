import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type StoryboardWidgetInspectorJsonTarget =
  | 'nodeProps'
  | 'nodeMeta'
  | 'edgeProps'
  | 'edgeMeta'
  | 'workflowMeta'
  | 'workflowContext'

export function StoryboardWidgetInspectorJsonButton({
  label,
  target,
  disabled,
  onApplyJson,
}: {
  label: string
  target: StoryboardWidgetInspectorJsonTarget
  disabled?: boolean
  onApplyJson: (target: StoryboardWidgetInspectorJsonTarget) => void
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
