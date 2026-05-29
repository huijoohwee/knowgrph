import React, { useEffect, useRef, useState } from 'react'
import { Rocket } from 'lucide-react'
import IconButton from '@/components/IconButton'
import { useToolMenuShortcuts } from '@/features/toolbar/useToolMenuShortcuts'
import { useToolMenuState } from '@/features/toolbar/useToolMenuState'
import { useGraphStore } from '@/hooks/useGraphStore'
import type { PropsPanelOpenEventDetail, FloatingPanelOpenEventDetail } from '@/features/canvas/utils'
import { LS_KEYS } from '@/lib/config'
import { UI_THEME_TOKENS } from '@/lib/ui/theme-tokens'
import { getIconSizeClass } from '@/lib/ui'
import { lsBool } from '@/lib/persistence'
import type { ToolMenuAction, ToolMenuArea } from '@/features/toolbar/toolMenu'
import { createNewMarkdownSourceFileAndOpenViewer } from '@/features/source-files/createNewMarkdownSourceFile'
import type { MainPanelTabKey } from '@/features/toolbar/hooks/useMainPanelDrag'
import { installFloatingPanelBridge, type FloatingPanelRequestedView } from '@/features/toolbar/floatingPanelBridge'

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
      view: 'propsPanel' | 'view' | 'interaction' | 'design' | 'chat' | 'geo' | 'renderer' | 'storybldr' | 'graphTraversal'
      seq: number
    } | null
  >(null)

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
    if (typeof window === 'undefined') return

    const openRequestedFloatingPanel = (view: FloatingPanelRequestedView) => {
      floatingPanelRequestSeqRef.current += 1
      setFloatingPanelRequestedView({
        view,
        seq: floatingPanelRequestSeqRef.current,
      })
      setIsToolMenuOpen(true)
    }

    const openPropsPanel = (detail?: PropsPanelOpenEventDetail) => {
      try {
        const isPinned = lsBool(LS_KEYS.floatingPanelPinned, false)
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
      openRequestedFloatingPanel('propsPanel')
    }

    const openRendererPanel = () => {
      openRequestedFloatingPanel('renderer')
    }

    const openFloatingPanel = (detail?: FloatingPanelOpenEventDetail) => {
      const tab = detail?.tab
      if (tab === 'inspector' || tab === 'node') {
        if (detail?.open === false) return
        _onOpenMainPanel('workflowManager')
        closeToolMenu()
        return
      }
      const requested =
        tab === 'view'
          ? 'view'
          : tab === 'chat'
          ? 'chat'
          : tab === 'geo'
            ? 'geo'
            : tab === 'storybldr'
              ? 'storybldr'
            : null
      if (!requested) return
      if (detail?.open === false) {
        closeToolMenu()
        return
      }
      openRequestedFloatingPanel(requested)
    }

    return installFloatingPanelBridge({
      openPropsPanel,
      openFloatingPanel,
      openRendererPanel,
    })
  }, [_onOpenMainPanel, closeToolMenu, setIsToolMenuOpen, setToolMenuDragPos])

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
