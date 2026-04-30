import { useEffect, useState } from 'react';

import { useIsomorphicLayoutEffect } from '@/lib/react/useIsomorphicLayoutEffect';

export interface ContainerDims {
  width: number;
  height: number;
  left: number;
  top: number;
  dpr: number;
}

type UseContainerDimsOptions = {
  resolveMeasureElement?: (self: HTMLElement | null) => HTMLElement | null;
}

function readContainerDims(el: HTMLElement | null): ContainerDims {
  if (!el) {
    return {
      width: 800,
      height: 600,
      left: 0,
      top: 0,
      dpr: typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1,
    };
  }
  const rect = el.getBoundingClientRect();
  return {
    width: Math.max(1, rect.width),
    height: Math.max(1, rect.height),
    left: rect.left,
    top: rect.top,
    dpr: typeof window !== 'undefined' ? Math.max(1, window.devicePixelRatio || 1) : 1,
  };
}

function isSameDims(a: ContainerDims, b: ContainerDims): boolean {
  const eq = (x: number, y: number) => Math.abs(x - y) < 0.01;
  return eq(a.width, b.width) && eq(a.height, b.height) && eq(a.left, b.left) && eq(a.top, b.top) && eq(a.dpr, b.dpr);
}

function resolveMeasureElement(
  ref: React.RefObject<HTMLElement | null>,
  options?: UseContainerDimsOptions,
): HTMLElement | null {
  const self = ref.current;
  const resolved = options?.resolveMeasureElement?.(self) || null;
  return resolved || self;
}

export function useContainerDims(ref: React.RefObject<HTMLElement | null>, options?: UseContainerDimsOptions): ContainerDims {
  const [dims, setDims] = useState<ContainerDims>(() => readContainerDims(resolveMeasureElement(ref, options)));

  useIsomorphicLayoutEffect(() => {
    if (!ref.current) return;
    const next = readContainerDims(resolveMeasureElement(ref, options));
    setDims(prev => (isSameDims(prev, next) ? prev : next));
  }, [options, ref]);

  useEffect(() => {
    if (!ref.current) return;
    const sync = () => {
      const el = resolveMeasureElement(ref, options);
      if (!el) return;
      const next = readContainerDims(el);
      setDims(prev => (isSameDims(prev, next) ? prev : next));
    };
    sync();
    const ro = new ResizeObserver(() => {
      sync();
    });
    const self = ref.current;
    const target = resolveMeasureElement(ref, options);
    if (self) ro.observe(self);
    if (target && target !== self) ro.observe(target);
    if (typeof window !== 'undefined') window.addEventListener('resize', sync);
    return () => {
      ro.disconnect();
      if (typeof window !== 'undefined') window.removeEventListener('resize', sync);
    };
  }, [options, ref]);

  return dims;
}
