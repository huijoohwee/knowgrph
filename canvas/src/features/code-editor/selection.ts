import { findNearestIdBeforePos, findEnclosingBlockBounds, findIdInBlock } from '@/lib/editor';

export const detectIdAroundSelection = (text: string, pos: number, end: number) => {
  const findIdInRange = (t: string, a: number, b: number) => {
    const sub = t.slice(a, b);
    const m = sub.match(/"id"\s*:\s*"([^"]+)"/);
    return m ? m[1] : null;
  };
  let id: string | null = null;
  if (end > pos + 2) {
    id = findIdInRange(text, pos, end) || findNearestIdBeforePos(text, pos);
  } else {
    id = findNearestIdBeforePos(text, pos);
    if (!id) {
      const b = findEnclosingBlockBounds(text, pos);
      if (b) id = findIdInBlock(text, b.start, b.end);
    }
  }
  return id;
};

