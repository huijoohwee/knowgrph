import React, { useEffect, useRef, useState } from 'react'
import { Upload, CheckCircle, XCircle } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useParserUIState } from '@/features/parsers/uiState'
import { useToolMenuShortcuts } from '@/features/toolbar/useToolMenuShortcuts'
import { useToolMenuState } from '@/features/toolbar/useToolMenuState'
import { ToolbarToolMenu } from '@/features/toolbar/ToolbarToolMenu'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  DESIGN_LAYERS_PANEL_OPEN_EVENT,
  PROPS_PANEL_OPEN_EVENT,
  RENDERER_FLOATING_PANEL_OPEN_EVENT,
  RENDERER_PANEL_OPEN_EVENT,
  SIDE_PANEL_OPEN_EVENT,
  type PropsPanelOpenEventDetail,
  type SidePanelOpenEventDetail,
} from '@/features/canvas/utils'
import { LS_KEYS, UI_LABELS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass } from '@/lib/ui'
import { lsBool } from '@/lib/persistence'
import type { ToolMenuAction, ToolMenuArea } from '@/features/toolbar/toolMenu'
import { createNewMarkdownSourceFileAndOpenViewer } from '@/features/source-files/createNewMarkdownSourceFile'
import { onGeospatialModeChanged } from '@/features/geospatial/events'

type ToolbarMenuLauncherProps = {
  onOpenMainPanel: (tab: 'workflow' | 'help' | 'graphFields' | 'settings') => void
}

export function ToolbarMenuLauncher({ onOpenMainPanel: _onOpenMainPanel }: ToolbarMenuLauncherProps) {
  const dataLoadOk = useParserUIState(s => s.dataLoadOk)
  const dataLoadMsg = useParserUIState(s => s.dataLoadMsg)

  const floatingPanelRequestSeqRef = useRef(0)
  const [floatingPanelRequestedView, setFloatingPanelRequestedView] = useState<
    {
      view: 'propsPanel' | 'interaction' | 'designLayers' | 'domTree' | 'domInspect' | 'inspector' | 'chat' | 'geo' | 'renderer' | 'graphTraversal'
      seq: number
    } | null
  >(null)

  const [geospatialModeEnabled, setGeospatialModeEnabled] = React.useState<boolean>(() => {
    try {
      return lsBool(LS_KEYS.geospatialOverlayEnabled, false)
    } catch {
      return false
    }
  })

  const {
    isToolMenuOpen,
    setIsToolMenuOpen,
    toolMenuButtonRef,
    toolMenuCardRef,
    toolMenuCardStyle,
    setToolMenuDragPos,
    handleToolMenuCardPointerDown,
    closeToolMenu,
  } = useToolMenuState()

  const handleToolMenuShortcutAction = React.useCallback((area: ToolMenuArea, action: ToolMenuAction) => {
    if (area !== 'sourceFiles' || action !== 'new') return
    try {
      createNewMarkdownSourceFileAndOpenViewer()
    } catch {
      void 0
    }
  }, [])

  useToolMenuShortcuts(handleToolMenuShortcutAction)

  useEffect(() => {
    return onGeospatialModeChanged(detail => {
      const enabled = typeof detail.enabled === 'boolean' ? detail.enabled : null
      if (enabled == null) return
      setGeospatialModeEnabled(enabled)
    })
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return

    const handleOpenPropsPanel = (event: Event) => {
      floatingPanelRequestSeqRef.current += 1
      setFloatingPanelRequestedView({
        view: 'propsPanel',
        seq: floatingPanelRequestSeqRef.current,
      })
      try {
        const isPinned = lsBool(LS_KEYS.floatingPanelPinned, false)
        const custom = event as CustomEvent<PropsPanelOpenEventDetail>
        const detail = custom.detail
        const clientX = detail && typeof detail.clientX === 'number' ? detail.clientX : null
        const clientY = detail && typeof detail.clientY === 'number' ? detail.clientY : null
        if (!isPinned && clientX !== null && clientY !== null && Number.isFinite(clientX) && Number.isFinite(clientY)) {
          const padding = 8
          const estimatedWidth = 320
          const estimatedHeight = 420
          const maxLeft = Math.max(padding, window.innerWidth - estimatedWidth - padding)
          const maxTop = Math.max(padding, window.innerHeight - estimatedHeight - padding)
          setToolMenuDragPos({
            top: Math.min(Math.max(padding, clientY), maxTop),
            left: Math.min(Math.max(padding, clientX), maxLeft),
          })
        }
      } catch {
        void 0
      }
      setIsToolMenuOpen(true)
    }

    const handleOpenDesignLayersPanel = (event: Event) => {
      floatingPanelRequestSeqRef.current += 1
      setFloatingPanelRequestedView({
        view: 'designLayers',
        seq: floatingPanelRequestSeqRef.current,
      })
      try {
        const isPinned = lsBool(LS_KEYS.floatingPanelPinned, false)
        const custom = event as CustomEvent<PropsPanelOpenEventDetail>
        const detail = custom.detail
        const clientX = detail && typeof detail.clientX === 'number' ? detail.clientX : null
        const clientY = detail && typeof detail.clientY === 'number' ? detail.clientY : null
        if (!isPinned && clientX !== null && clientY !== null && Number.isFinite(clientX) && Number.isFinite(clientY)) {
          const padding = 8
          const estimatedWidth = 320
          const estimatedHeight = 420
          const maxLeft = Math.max(padding, window.innerWidth - estimatedWidth - padding)
          const maxTop = Math.max(padding, window.innerHeight - estimatedHeight - padding)
          setToolMenuDragPos({
            top: Math.min(Math.max(padding, clientY), maxTop),
            left: Math.min(Math.max(padding, clientX), maxLeft),
          })
        }
      } catch {
        void 0
      }
      setIsToolMenuOpen(true)
    }

    const handleOpenRenderer = () => {
      floatingPanelRequestSeqRef.current += 1
      setFloatingPanelRequestedView({
        view: 'renderer',
        seq: floatingPanelRequestSeqRef.current,
      })
      setIsToolMenuOpen(true)
    }

    const handleOpenSidePanel = (ev: Event) => {
      const e = ev as CustomEvent<SidePanelOpenEventDetail | undefined>
      const tab = e.detail?.tab
      const requested =
        tab === 'chat'
          ? 'chat'
          : tab === 'geo'
            ? 'geo'
            : tab === 'inspector' || tab === 'node'
              ? 'inspector'
              : null
      if (!requested) return
      floatingPanelRequestSeqRef.current += 1
      setFloatingPanelRequestedView({
        view: requested === 'geo' && !geospatialModeEnabled ? 'inspector' : requested,
        seq: floatingPanelRequestSeqRef.current,
      })
      if (e.detail?.open === false) {
        closeToolMenu()
        return
      }
      setIsToolMenuOpen(true)
    }

    window.addEventListener(PROPS_PANEL_OPEN_EVENT, handleOpenPropsPanel)
    window.addEventListener(DESIGN_LAYERS_PANEL_OPEN_EVENT, handleOpenDesignLayersPanel)
    window.addEventListener(RENDERER_PANEL_OPEN_EVENT, handleOpenRenderer)
    window.addEventListener(RENDERER_FLOATING_PANEL_OPEN_EVENT, handleOpenRenderer)
    window.addEventListener(SIDE_PANEL_OPEN_EVENT, handleOpenSidePanel as EventListener)
    return () => {
      window.removeEventListener(PROPS_PANEL_OPEN_EVENT, handleOpenPropsPanel)
      window.removeEventListener(DESIGN_LAYERS_PANEL_OPEN_EVENT, handleOpenDesignLayersPanel)
      window.removeEventListener(RENDERER_PANEL_OPEN_EVENT, handleOpenRenderer)
      window.removeEventListener(RENDERER_FLOATING_PANEL_OPEN_EVENT, handleOpenRenderer)
      window.removeEventListener(SIDE_PANEL_OPEN_EVENT, handleOpenSidePanel as EventListener)
    }
  }, [closeToolMenu, geospatialModeEnabled, setIsToolMenuOpen, setToolMenuDragPos])

  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <>
      <IconButton
        ref={toolMenuButtonRef}
        className={`App-toolbar__btn ${
          dataLoadOk === true
            ? UI_THEME_TOKENS.status.success
            : dataLoadOk === false
              ? UI_THEME_TOKENS.status.error
              : UI_THEME_TOKENS.icon.color
        }`}
        title={dataLoadOk === true ? UI_LABELS.openData : UI_LABELS.loadStatus}
        onClick={() => {
          closeToolMenu()
          _onOpenMainPanel('workflow')
        }}
      >
        {dataLoadOk === true ? (
          <div className="flex items-center gap-1">
            <CheckCircle className={iconSizeClass} />
            <span className="text-xs max-w-20 truncate">{dataLoadMsg}</span>
          </div>
        ) : dataLoadOk === false ? (
          <div className="flex items-center gap-1">
            <XCircle className={iconSizeClass} />
            <span className="text-xs max-w-20 truncate">{dataLoadMsg}</span>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <Upload className={iconSizeClass} />
            <span className="text-xs max-w-20 truncate">{UI_LABELS.openData}</span>
          </div>
        )}
      </IconButton>
      {isToolMenuOpen && (
        <ToolbarToolMenu
          toolMenuCardRef={toolMenuCardRef}
          toolMenuCardStyle={toolMenuCardStyle}
          onHeaderPointerDown={handleToolMenuCardPointerDown}
          requestedFloatingPanelView={floatingPanelRequestedView?.view}
          requestedFloatingPanelViewSeq={floatingPanelRequestedView?.seq}
          pipelineStatus={null}
          exportStatus={null}
          onClose={closeToolMenu}
        />
      )}
    </>
  )
}
