import { useState, useRef, useCallback, useEffect } from 'react';
import { LS_KEYS, UI_LAYOUT } from '@/lib/config';
import { lsBool, lsNum, lsSetBool, lsSetNum } from '@/lib/persistence';
import { usePinnedLs } from '@/lib/ui/panelPinned';
import { clampOverlayCenterToViewport } from '@/lib/ui/overlayClamp';
import { beginOverlayPanelPositionDrag } from '@/lib/ui/overlayPanelDrag';
import { createRafValueScheduler } from '@/lib/react/rafValueScheduler';
import type { MainPanelTabKey } from '@/features/panels/mainPanelTabs';

export type { MainPanelTabKey } from '@/features/panels/mainPanelTabs';

export type WorkflowManagerTabKey = 'graph' | 'mapping'

export type MainPanelOpenOptions = {
  searchQuery?: string;
  workflowManagerTab?: WorkflowManagerTabKey;
  anchorId?: string;
};

export function useMainPanelDrag() {
  const [isMainPanelOpen, setIsMainPanelOpen] = useState(false);
  const [mainPanelRequestedTab, setMainPanelRequestedTab] = useState<MainPanelTabKey>('help');
  const [mainPanelRequestedSearchQuery, setMainPanelRequestedSearchQuery] = useState('');
  const [mainPanelRequestedAnchorId, setMainPanelRequestedAnchorId] = useState('');
  const [mainPanelRequestedAnchorSeq, setMainPanelRequestedAnchorSeq] = useState(0);
  const [mainPanelRequestedWorkflowManagerTab, setMainPanelRequestedWorkflowManagerTab] = useState<WorkflowManagerTabKey>('graph');
  const mainPanelCardRef = useRef<HTMLElement>(null);
  const mainPanelDragPosRef = useRef<{ top: number; left: number } | null>(null);
  const dragSchedulerRef = useRef(createRafValueScheduler((pos: { top: number; left: number }) => setMainPanelDragPosSynced(pos)));
  const { pinned: mainPanelPinned, setPinned: setMainPanelPinned } = usePinnedLs(LS_KEYS.mainPanelPinned, true);
  const [mainPanelCollapsed, setMainPanelCollapsed] = useState<boolean>(() => lsBool(LS_KEYS.mainPanelCollapsed, false));
  const [mainPanelDragPos, setMainPanelDragPos] = useState<{ top: number; left: number }>(() => {
    const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx;
    const topFallback = (() => {
      if (typeof window === 'undefined') return 240;
      const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar');
      const toolbarBottomPx = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx;
      const expectedHeightPx = mainPanelCollapsed
        ? 240
        : Math.min(Math.round(window.innerHeight * 0.8), 800);
      const halfHeightPx = Math.round(expectedHeightPx / 2);
      return toolbarBottomPx + toolbarOffsetPx + halfHeightPx;
    })();
    const leftFallback = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 240;
    const initial = {
      top: lsNum(LS_KEYS.mainPanelTop, topFallback),
      left: lsNum(LS_KEYS.mainPanelLeft, leftFallback),
    };
    mainPanelDragPosRef.current = initial;
    return initial;
  });

  useEffect(() => {
    lsSetBool(LS_KEYS.mainPanelCollapsed, mainPanelCollapsed);
  }, [mainPanelCollapsed]);

  const clampMainPanelPos = useCallback((pos: { top: number; left: number }) => {
    if (typeof window === 'undefined') return pos;

    const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar');
    const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx;
    const toolbarBottomPx = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx;

    const rect = mainPanelCardRef.current?.getBoundingClientRect();
    const fallbackW = Math.min(Math.round(window.innerWidth * 0.8), 960);
    const fallbackH = mainPanelCollapsed ? 240 : Math.min(Math.round(window.innerHeight * 0.8), 800);
    const width = rect ? Math.max(1, Math.round(rect.width)) : fallbackW;
    const height = rect ? Math.max(1, Math.round(rect.height)) : fallbackH;
    return clampOverlayCenterToViewport({
      pos,
      size: { width, height },
      viewport: { width: window.innerWidth, height: window.innerHeight },
      visiblePx: 32,
      inset: { top: toolbarBottomPx + toolbarOffsetPx },
    });
  }, [mainPanelCollapsed]);

  const openMainPanel = useCallback(
    (tab: MainPanelTabKey, options?: MainPanelOpenOptions) => {
      setIsMainPanelOpen(true);
      setMainPanelRequestedTab(tab);
      const requestedSearch = typeof options?.searchQuery === 'string' ? options.searchQuery : '';
      const requestedAnchorId = typeof options?.anchorId === 'string' ? options.anchorId : '';
      setMainPanelRequestedSearchQuery(prev => (prev === requestedSearch ? prev : requestedSearch));
      setMainPanelRequestedAnchorId(prev => (prev === requestedAnchorId ? prev : requestedAnchorId));
      setMainPanelRequestedAnchorSeq(prev => prev + 1);
      const requestedWorkflowManagerTab =
        options?.workflowManagerTab === 'mapping' ? 'mapping' : 'graph'
      setMainPanelRequestedWorkflowManagerTab(prev =>
        prev === requestedWorkflowManagerTab ? prev : requestedWorkflowManagerTab,
      )
      const fallbackPos = (() => {
        if (typeof window === 'undefined') return { top: 240, left: 240 };
        return {
          top: Math.round(window.innerHeight / 2),
          left: Math.round(window.innerWidth / 2),
        };
      })();
      const nextPos = clampMainPanelPos(mainPanelDragPosRef.current || mainPanelDragPos || fallbackPos);
      mainPanelDragPosRef.current = nextPos;
      setMainPanelDragPos(nextPos);
    },
    [clampMainPanelPos, mainPanelDragPos],
  );

  const setMainPanelDragPosSynced = useCallback((pos: { top: number; left: number }) => {
    mainPanelDragPosRef.current = pos;
    setMainPanelDragPos(pos);
  }, []);

  useEffect(() => {
    dragSchedulerRef.current = createRafValueScheduler((pos: { top: number; left: number }) => setMainPanelDragPosSynced(pos));
  }, [setMainPanelDragPosSynced]);

  const persistMainPanelPos = useCallback((pos: { top: number; left: number }) => {
    const clamped = clampMainPanelPos(pos);
    setMainPanelDragPosSynced(clamped);
    lsSetNum(LS_KEYS.mainPanelTop, clamped.top);
    lsSetNum(LS_KEYS.mainPanelLeft, clamped.left);
  }, [clampMainPanelPos, setMainPanelDragPosSynced]);

  const handleMainPanelHeaderDragStart = useCallback((event: React.PointerEvent<HTMLElement>) => {
    const el = mainPanelCardRef.current;
    if (!el) return;

    const scheduler = dragSchedulerRef.current;

    beginOverlayPanelPositionDrag({
      event,
      cursor: 'grabbing',
      readStartPosition: () => {
        const rect = el.getBoundingClientRect();
        return {
          top: rect.top + rect.height / 2,
          left: rect.left + rect.width / 2,
        };
      },
      clampPosition: clampMainPanelPos,
      schedulePosition: position => scheduler.schedule(position),
      flushPosition: () => scheduler.flush(),
      cancelPosition: () => scheduler.cancel(),
      onDragStart: position => setMainPanelDragPosSynced(position),
      onDragEnd: () => {
        const pos = mainPanelDragPosRef.current;
        if (!pos) return;
        persistMainPanelPos(pos);
      },
    });
  }, [clampMainPanelPos, persistMainPanelPos, setMainPanelDragPosSynced]);

  const handleMainPanelRestore = useCallback(() => {
    setMainPanelCollapsed(false);
    const top = (() => {
      if (typeof window === 'undefined') return 240;
      const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar');
      const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx;
      const toolbarBottomPx = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx;
      const expectedHeightPx = Math.min(Math.round(window.innerHeight * 0.8), 800);
      const halfHeightPx = Math.round(expectedHeightPx / 2);
      return toolbarBottomPx + toolbarOffsetPx + halfHeightPx;
    })();
    const left = typeof window !== 'undefined' ? Math.round(window.innerWidth * 0.5) : 240;
    persistMainPanelPos({ top, left });
  }, [persistMainPanelPos]);

  return {
    isMainPanelOpen,
    setIsMainPanelOpen,
    mainPanelRequestedTab,
    mainPanelRequestedSearchQuery,
    mainPanelRequestedAnchorId,
    mainPanelRequestedAnchorSeq,
    mainPanelRequestedWorkflowManagerTab,
    setMainPanelRequestedTab,
    mainPanelCardRef,
    mainPanelPinned,
    setMainPanelPinned,
    mainPanelCollapsed,
    setMainPanelCollapsed,
    mainPanelDragPos,
    openMainPanel,
    handleMainPanelHeaderDragStart,
    handleMainPanelRestore,
    clampMainPanelPos,
  };
}
