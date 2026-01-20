import { useState, useRef, useCallback, useEffect } from 'react';
import { LS_KEYS, UI_LAYOUT } from '@/lib/config';
import { lsBool, lsNum, lsSetBool, lsSetNum } from '@/lib/persistence';

export type MainPanelTabKey = 'workflow' | 'help' | 'graphFields' | 'preview' | 'settings';

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
  const [mainPanelPinned, setMainPanelPinned] = useState<boolean>(() => lsBool(LS_KEYS.mainPanelPinned, true));
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
    lsSetBool(LS_KEYS.mainPanelPinned, mainPanelPinned);
  }, [mainPanelPinned]);

  useEffect(() => {
    lsSetBool(LS_KEYS.mainPanelCollapsed, mainPanelCollapsed);
  }, [mainPanelCollapsed]);

  const clampMainPanelPos = useCallback((pos: { top: number; left: number }) => {
    if (typeof window === 'undefined') return pos;

    const toolbar = typeof document === 'undefined' ? null : document.querySelector('.App-toolbar');
    const toolbarOffsetPx = UI_LAYOUT.toolbarOffsetPx;
    const toolbarBottomPx = toolbar instanceof HTMLElement ? toolbar.getBoundingClientRect().bottom : toolbarOffsetPx;

    const rect = mainPanelCardRef.current?.getBoundingClientRect();
    const defaultHalfWidthPx = Math.round(window.innerWidth * 0.4);
    const defaultHalfHeightPx = Math.round(window.innerHeight * 0.4);
    const halfWidthPx = rect ? Math.round(rect.width / 2) : defaultHalfWidthPx;
    const halfHeightPx = rect
      ? Math.round(rect.height / 2)
      : mainPanelCollapsed
        ? 120
        : defaultHalfHeightPx;

    const visible = 32;

    const minTop = toolbarBottomPx + toolbarOffsetPx + visible - halfHeightPx;
    const maxTop = window.innerHeight - visible + halfHeightPx;
    const minLeft = visible - halfWidthPx;
    const maxLeft = window.innerWidth - visible + halfWidthPx;

    const clampedTop = Math.min(Math.max(pos.top, minTop), maxTop);
    const clampedLeft = Math.min(Math.max(pos.left, minLeft), maxLeft);

    return {
      top: clampedTop,
      left: clampedLeft,
    };
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

  const handleMainPanelHeaderDragStart = useCallback((event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const el = mainPanelCardRef.current;
    if (!el) return;
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
    const handleMove = (e: PointerEvent) => {
      const state = mainPanelDragStateRef.current;
      if (!state) return;
      const dx = e.clientX - state.startX;
      const dy = e.clientY - state.startY;
      setMainPanelDragPosSynced(clampMainPanelPos({ top: state.startTop + dy, left: state.startLeft + dx }));
    };
    const handleUp = () => {
      mainPanelDragStateRef.current = null;
      window.removeEventListener('pointermove', handleMove);
      window.removeEventListener('pointerup', handleUp);
      const pos = mainPanelDragPosRef.current;
      if (!pos) return;
      persistMainPanelPos(pos);
    };
    window.addEventListener('pointermove', handleMove);
    window.addEventListener('pointerup', handleUp);
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
