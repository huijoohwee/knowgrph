export function buildNodeShapePathD(args: {
  shape: 'diamond' | 'hex';
  width: number;
  height: number;
}): string {
  const { shape } = args;
  const width = typeof args.width === 'number' && Number.isFinite(args.width) ? args.width : 0;
  const height = typeof args.height === 'number' && Number.isFinite(args.height) ? args.height : 0;
  const halfW = Math.max(0, width / 2);
  const halfH = Math.max(0, height / 2);
  if (halfW <= 0 || halfH <= 0) return '';
  if (shape === 'diamond') {
    return `M0,${-halfH} L${halfW},0 L0,${halfH} L${-halfW},0 Z`;
  }
  const x1 = halfW;
  const x2 = halfW * 0.5;
  const y1 = halfH;
  return `M${-x2},${-y1} L${x2},${-y1} L${x1},0 L${x2},${y1} L${-x2},${y1} L${-x1},0 Z`;
}
