import React from 'react'
import { getUiSectionActionClassName } from '@/lib/ui/sectionChipChrome'

type FloatingPanelChatQuickActionGridItem = {
  id: string
  label: string
  prompt: string
  disabled?: boolean
}

type FloatingPanelChatQuickActionGridProps = {
  quickActions: FloatingPanelChatQuickActionGridItem[]
  isLoading: boolean
  uiPanelTextFontClass: string
  uiPanelMicroLabelTextSizeClass: string
  placement: 'thread' | 'footer'
  onQuickAction?: (prompt: string) => void
}

export function FloatingPanelChatQuickActionGrid({
  quickActions,
  isLoading,
  uiPanelTextFontClass,
  uiPanelMicroLabelTextSizeClass,
  placement,
  onQuickAction,
}: FloatingPanelChatQuickActionGridProps) {
  if (quickActions.length === 0) return null
  return (
    <section
      aria-label="Chat prompt actions"
      data-kg-chat-quick-actions="true"
      data-kg-chat-quick-actions-placement={placement}
      className="grid grid-cols-2 gap-1 auto-rows-[2rem]"
    >
      {quickActions.map(action => (
        <button
          key={action.id}
          type="button"
          data-kg-chat-quick-action="true"
          data-kg-chat-quick-action-id={action.id}
          className={getUiSectionActionClassName('secondary', [uiPanelTextFontClass, uiPanelMicroLabelTextSizeClass, 'min-w-0 justify-center truncate px-2 disabled:opacity-50'].join(' '))}
          disabled={isLoading || action.disabled}
          onClick={() => onQuickAction?.(action.prompt)}
          title={action.label}
        >
          {action.label}
        </button>
      ))}
    </section>
  )
}
