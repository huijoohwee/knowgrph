import { useState, useRef, useCallback, useEffect } from 'react';
import { LS_KEYS, UI_LAYOUT } from '@/lib/config';
import { lsBool, lsNum, lsSetBool, lsSetNum } from '@/lib/persistence';
import { usePinnedLs } from '@/lib/ui/panelPinned';
import { clampOverlayCenterToViewport } from '@/lib/ui/overlayClamp';
import { startPointerDrag } from 'grph-shared/dom/pointerDrag';

export type MainPanelTabKey =
  | 'workflow'
  | 'flowEditorManager'
  | 'help'
  | 'graphFields'
  | 'dashboard'
  | 'preview'
  | 'settings'
  | 'history';

export function useMainPanelDrag() {
  const [isMainPanelOpen, setIsMainPanelOpen] = useState(false);
  const [mainPanelRequestedTab, setMainPanelRequestedTab] = useState<MainPanelTabKey>('help');
  const mainPanelCardRef = useRef<HTMLDivElement>(null);
  const mainPanelDragStateRef = useRef<{
    startX: number;
    startY: number;
    startTop: number;
    startLeft: number;
  } | null>(null);
  const mainPanelDragPosRef = useRef<{ top: number; left: number } | null>(null);
  const dragRafRef = useRef<number | null>(null);
  const pendingDragPosRef = useRef<{ top: number; left: number } | null>(null);
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

  const openMainPanel = useCallback(
    (tab: MainPanelTabKey) => {
      setIsMainPanelOpen(true);
      setMainPanelRequestedTab(tab);
      if (typeof window !== 'undefined') {
        const pos = {
          top: Math.round(window.innerHeight / 2),
          left: Math.round(window.innerWidth / 2),
        };
        mainPanelDragPosRef.current = pos;
        setMainPanelDragPos(pos);
      }
    },
    [],
  );

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

  const setMainPanelDragPosSynced = useCallback((pos: { top: number; left: number }) => {
    mainPanelDragPosRef.current = pos;
    setMainPanelDragPos(pos);
  }, []);

  const persistMainPanelPos = useCallback((pos: { top: number; left: number }) => {
    const clamped = clampMainPanelPos(pos);
    setMainPanelDragPosSynced(clamped);
    lsSetNum(LS_KEYS.mainPanelTop, clamped.top);
    lsSetNum(LS_KEYS.mainPanelLeft, clamped.left);
  }, [clampMainPanelPos, setMainPanelDragPosSynced]);

  const handleMainPanelHeaderDragStart = useCallback((event: React.PointerEvent<HTMLElement>) => {
    if (event.button !== 0) return;
    const el = mainPanelCardRef.current;
    if (!el) return;
    const native = event.nativeEvent;
    try {
      event.preventDefault();
    } catch {
      void 0;
    }
    const rect = el.getBoundingClientRect();
    const startTop = rect.top + rect.height / 2;
    const startLeft = rect.left + rect.width / 2;
    mainPanelDragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      startTop,
      startLeft,
    };
    setMainPanelDragPosSynced(clampMainPanelPos({ top: startTop, left: startLeft }));

    const flush = () => {
      const next = pendingDragPosRef.current;
      pendingDragPosRef.current = null;
      dragRafRef.current = null;
      if (!next) return;
      setMainPanelDragPosSynced(next);
    };

    startPointerDrag({
      ev: native,
      cursor: 'grabbing',
      onMove: e => {
        const state = mainPanelDragStateRef.current;
        if (!state) return;
        const dx = e.clientX - state.startX;
        const dy = e.clientY - state.startY;
        pendingDragPosRef.current = clampMainPanelPos({ top: state.startTop + dy, left: state.startLeft + dx });
        if (dragRafRef.current == null) dragRafRef.current = window.requestAnimationFrame(flush);
      },
      onEnd: () => {
        mainPanelDragStateRef.current = null;
        if (dragRafRef.current != null) {
          window.cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        if (pendingDragPosRef.current) {
          setMainPanelDragPosSynced(pendingDragPosRef.current);
          pendingDragPosRef.current = null;
        }
        const pos = mainPanelDragPosRef.current;
        if (!pos) return;
        persistMainPanelPos(pos);
      },
      onCancel: () => {
        mainPanelDragStateRef.current = null;
        if (dragRafRef.current != null) {
          window.cancelAnimationFrame(dragRafRef.current);
          dragRafRef.current = null;
        }
        pendingDragPosRef.current = null;
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
