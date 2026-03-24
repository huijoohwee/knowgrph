import { useEffect, useState } from 'react';

export interface ContainerDims {
  width: number;
  height: number;
  left: number;
  top: number;
  dpr: number;
}

export function useContainerDims(ref: React.RefObject<HTMLElement | null>): ContainerDims {
  const [dims, setDims] = useState<ContainerDims>(() => ({
    width: 800,
    height: 600,
    left: 0,
    top: 0,
    dpr: typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1,
  }));

  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const next = {
        width: Math.max(1, rect.width),
        height: Math.max(1, rect.height),
        left: rect.left,
        top: rect.top,
        dpr: Math.max(1, window.devicePixelRatio || 1),
      };
      const eq = (a: number, b: number) => Math.abs(a - b) < 0.01;
      setDims(prev =>
        eq(prev.width, next.width) &&
        eq(prev.height, next.height) &&
        eq(prev.left, next.left) &&
        eq(prev.top, next.top) &&
        eq(prev.dpr, next.dpr)
          ? prev
          : next,
      );
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, [ref]);

  return dims;
}
