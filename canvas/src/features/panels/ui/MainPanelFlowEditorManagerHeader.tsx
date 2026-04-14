import React from 'react'

import Tooltip from '@/features/panels/ui/Tooltip'
import { MAIN_PANEL_OPEN_EVENT } from '@/features/panels/utils/useMainPanelRect'
import { parseIntegrationConfigsJson } from '@/features/integrations/config'
import { useGraphStore } from '@/hooks/useGraphStore'
import { UI_COPY, UI_LABELS } from '@/lib/config'
import { getChatProviderLabel, getChatProviderRegionLabel } from '@/lib/chatEndpoint'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'

export type FlowEditorManagerTabKey = 'mapping' | 'specification' | 'graph'

export default function MainPanelFlowEditorManagerHeader(props: {
  activeTab: FlowEditorManagerTabKey
  onTabChange: (tab: FlowEditorManagerTabKey) => void
}) {
  const { activeTab, onTabChange } = props

  const uiSectionHeaderRowHeightClass = useGraphStore(
    s => s.uiSectionHeaderRowHeightClass || 'min-h-[36px]',
  )
  const uiSectionHeaderRowPaddingClass = useGraphStore(
    s => s.uiSectionHeaderRowPaddingClass || 'py-1',
  )
  const uiPanelMicroLabelTextSizeClass = useGraphStore(
    s => s.uiPanelMicroLabelTextSizeClass || 'text-xs',
  )
  const chatProvider = useGraphStore(s => s.chatProvider)
  const chatEndpointUrl = useGraphStore(s => s.chatEndpointUrl)
  const chatModel = useGraphStore(s => s.chatModel)
  const integrationConfigsJson = useGraphStore(s => s.integrationConfigsJson)
  const aiChatEnabled = React.useMemo(
    () => parseIntegrationConfigsJson(integrationConfigsJson).aiChat.enabled,
    [integrationConfigsJson],
  )
  const chatProviderLabel = React.useMemo(
    () => getChatProviderLabel(chatProvider),
    [chatProvider],
  )
  const chatRegionLabel = React.useMemo(
    () => getChatProviderRegionLabel(chatProvider, chatEndpointUrl),
    [chatEndpointUrl, chatProvider],
  )
  const openChatSettings = React.useCallback(() => {
    if (typeof window === 'undefined') return
    window.dispatchEvent(
      new CustomEvent(MAIN_PANEL_OPEN_EVENT, {
        detail: {
          tab: 'settings' as const,
          searchQuery: 'chat',
        },
      }),
    )
  }, [])

  return (
    <header
      className={[
        `mt-4 border-t ${UI_THEME_TOKENS.panel.divider} flex items-center justify-between mb-1`,
        uiSectionHeaderRowHeightClass,
        uiSectionHeaderRowPaddingClass,
      ].join(' ')}
      aria-label={UI_LABELS.flowEditorManager}
    >
      <section
        className={[
          `text-left flex items-center gap-1 ${UI_THEME_TOKENS.text.secondary}`,
          uiPanelMicroLabelTextSizeClass,
        ].join(' ')}
        aria-label="Title"
      >
        <Tooltip
          content={UI_COPY.flowEditorManagerHeaderTooltip}
          maxWidthPx={320}
          contentClassName={UI_THEME_TOKENS.tooltip.bg}
        >
          <span>{UI_LABELS.flowEditorManager}</span>
        </Tooltip>
      </section>

      <section className="flex items-center gap-2">
        <button
          type="button"
          className={`inline-flex items-center rounded-full border px-2 ${UI_THEME_TOKENS.panel.border} ${UI_THEME_TOKENS.panel.bg} ${UI_THEME_TOKENS.text.secondary} ${uiPanelMicroLabelTextSizeClass}`}
          onClick={openChatSettings}
        >
          {aiChatEnabled ? 'AI on' : 'AI off'}
          {' · '}
          {chatProviderLabel}
          {' · '}
          {chatRegionLabel}
          {chatModel ? ` · ${chatModel}` : ''}
        </button>
        <nav className="flex items-center gap-1" aria-label="Flow Editor Manager tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'mapping'}
          className={`App-toolbar__btn text-xs ${
            activeTab === 'mapping'
              ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
              : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
          }`}
          onClick={() => onTabChange('mapping')}
        >
          {UI_LABELS.flowEditorMapping}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'specification'}
          className={`App-toolbar__btn text-xs ${
            activeTab === 'specification'
              ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
              : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
          }`}
          onClick={() => onTabChange('specification')}
        >
          {UI_LABELS.flowEditorSpecification}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'graph'}
          className={`App-toolbar__btn text-xs ${
            activeTab === 'graph'
              ? `${UI_THEME_TOKENS.button.activeBg} ${UI_THEME_TOKENS.button.activeText}`
              : `${UI_THEME_TOKENS.button.text} ${UI_THEME_TOKENS.button.hoverBg}`
          }`}
          onClick={() => onTabChange('graph')}
        >
          {UI_LABELS.flowEditorGraph}
        </button>
        </nav>
      </section>
    </header>
  )
}
