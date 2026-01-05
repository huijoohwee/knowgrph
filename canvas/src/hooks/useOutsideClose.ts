import { useEffect } from 'react';

export function useOutsideClose(
  open: boolean,
  setOpen: (v: boolean) => void,
  containerRef?: React.MutableRefObject<HTMLElement | null>,
  ignoreRefs?: Array<React.MutableRefObject<HTMLElement | null>>,
) {
  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      const container = (containerRef && containerRef.current) ? (containerRef.current as unknown as Node | null) : null;
      if (container && target && container.contains(target)) return;
      if (ignoreRefs && ignoreRefs.some(r => r.current && target && (r.current as unknown as Node).contains(target))) return;
      setOpen(false);
    };
    const opts: AddEventListenerOptions = { capture: true }
    document.addEventListener('pointerdown', onDocPointerDown, opts);
    return () => document.removeEventListener('pointerdown', onDocPointerDown, opts);
  }, [open, setOpen, containerRef, ignoreRefs]);
}
