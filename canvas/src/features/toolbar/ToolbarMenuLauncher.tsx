import React, { useEffect, useRef, useState } from 'react'
import { Rocket } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useToolMenuShortcuts } from '@/features/toolbar/useToolMenuShortcuts'
import { useToolMenuState } from '@/features/toolbar/useToolMenuState'
import { useGraphStore } from '@/hooks/useGraphStore'
import {
  PROPS_PANEL_OPEN_EVENT,
  RENDERER_FLOATING_PANEL_OPEN_EVENT,
  RENDERER_PANEL_OPEN_EVENT,
  SIDE_PANEL_OPEN_EVENT,
  type PropsPanelOpenEventDetail,
  type SidePanelOpenEventDetail,
} from '@/features/canvas/utils'
import { LS_KEYS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass } from '@/lib/ui'
import { lsBool } from '@/lib/persistence'
import type { ToolMenuAction, ToolMenuArea } from '@/features/toolbar/toolMenu'
import { createNewMarkdownSourceFileAndOpenViewer } from '@/features/source-files/createNewMarkdownSourceFile'
import { onGeospatialModeChanged } from '@/features/geospatial/events'
import { setGeospatialModeEnabled as enableGeospatialMode } from '@/features/geospatial/gympgrphBridge'
import type { MainPanelTabKey } from '@/features/toolbar/hooks/useMainPanelDrag'

const ToolbarToolMenuLazy = React.lazy(() =>
  import('@/features/toolbar/ToolbarToolMenu').then(mod => ({ default: mod.ToolbarToolMenu })),
)
const LaunchDropdownLazy = React.lazy(() =>
  import('@/features/toolbar/LaunchDropdown').then(mod => ({ default: mod.LaunchDropdown })),
)

type ToolbarMenuLauncherProps = {
  onOpenMainPanel: (tab: MainPanelTabKey) => void
  onLaunchSpotlight?: () => void
  onLaunchStatus?: () => void
  onCloseMainPanel?: () => void
}

export function ToolbarMenuLauncher({
  onOpenMainPanel: _onOpenMainPanel,
  onLaunchSpotlight,
  onLaunchStatus,
  onCloseMainPanel,
}: ToolbarMenuLauncherProps) {
  const [launchOpen, setLaunchOpen] = useState(false)

  const floatingPanelRequestSeqRef = useRef(0)
  const [floatingPanelRequestedView, setFloatingPanelRequestedView] = useState<
    {
      view: 'propsPanel' | 'interaction' | 'domTree' | 'domInspect' | 'chat' | 'geo' | 'renderer' | 'graphTraversal'
      seq: number
    } | null
  >(null)

  const [geospatialModeEnabled, setGeospatialModeEnabled] = React.useState<boolean>(() => {
    try {
      return lsBool(LS_KEYS.geospatialOverlayEnabled, true)
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
      if (tab === 'inspector' || tab === 'node') {
        if (e.detail?.open === false) return
        _onOpenMainPanel('workflowManager')
        closeToolMenu()
        return
      }
      const requested =
        tab === 'chat'
          ? 'chat'
          : tab === 'geo'
            ? 'geo'
            : null
      if (!requested) return
      floatingPanelRequestSeqRef.current += 1
      setFloatingPanelRequestedView({
        view: requested,
        seq: floatingPanelRequestSeqRef.current,
      })
      if (requested === 'geo' && !geospatialModeEnabled) {
        void enableGeospatialMode(true)
          .then(nextEnabled => {
            setGeospatialModeEnabled(nextEnabled)
          })
          .catch((err: unknown) => {
            try {
              const msg =
                err && typeof err === 'object' && 'message' in err ? String((err as { message?: unknown }).message || '').trim() : ''
              useGraphStore.getState().pushUiToast({
                id: 'toolbar-launcher-geo-enable-error',
                kind: 'error',
                message: `Geospatial Mode failed to load: ${msg || 'Unknown error'}`,
              })
            } catch {
              void 0
            }
          })
      }
      if (e.detail?.open === false) {
        closeToolMenu()
        return
      }
      setIsToolMenuOpen(true)
    }

    window.addEventListener(PROPS_PANEL_OPEN_EVENT, handleOpenPropsPanel)
    window.addEventListener(RENDERER_PANEL_OPEN_EVENT, handleOpenRenderer)
    window.addEventListener(RENDERER_FLOATING_PANEL_OPEN_EVENT, handleOpenRenderer)
    window.addEventListener(SIDE_PANEL_OPEN_EVENT, handleOpenSidePanel as EventListener)
    return () => {
      window.removeEventListener(PROPS_PANEL_OPEN_EVENT, handleOpenPropsPanel)
      window.removeEventListener(RENDERER_PANEL_OPEN_EVENT, handleOpenRenderer)
      window.removeEventListener(RENDERER_FLOATING_PANEL_OPEN_EVENT, handleOpenRenderer)
      window.removeEventListener(SIDE_PANEL_OPEN_EVENT, handleOpenSidePanel as EventListener)
    }
  }, [_onOpenMainPanel, closeToolMenu, geospatialModeEnabled, setIsToolMenuOpen, setToolMenuDragPos])

  const uiIconScale = useGraphStore(s => s.uiIconScale)
  const iconSizeClass = getIconSizeClass(uiIconScale)

  return (
    <>
      <IconButton
        ref={toolMenuButtonRef}
        className={`App-toolbar__btn ${UI_THEME_TOKENS.icon.color}`}
        title="Launch"
        tooltipContent="Launch"
        showTooltip
        onClick={() => {
          closeToolMenu()
          setLaunchOpen(v => !v)
        }}
      >
        <Rocket className={iconSizeClass} />
      </IconButton>

      <React.Suspense fallback={null}>
        <LaunchDropdownLazy
          anchorRef={toolMenuButtonRef}
          open={launchOpen}
          onClose={() => setLaunchOpen(false)}
          onOpenWorkflowPanel={() => {
            setLaunchOpen(false)
            _onOpenMainPanel('workflowManager')
          }}
          onLaunchSpotlight={onLaunchSpotlight}
          onLaunchStatus={onLaunchStatus}
          onCloseMainPanel={onCloseMainPanel}
        />
      </React.Suspense>
      {isToolMenuOpen && (
        <React.Suspense fallback={null}>
          <ToolbarToolMenuLazy
            toolMenuCardRef={toolMenuCardRef}
            toolMenuCardStyle={toolMenuCardStyle}
            onHeaderPointerDown={handleToolMenuCardPointerDown}
            requestedFloatingPanelView={floatingPanelRequestedView?.view}
            requestedFloatingPanelViewSeq={floatingPanelRequestedView?.seq}
            pipelineStatus={null}
            exportStatus={null}
            onClose={closeToolMenu}
          />
        </React.Suspense>
      )}
    </>
  )
}
