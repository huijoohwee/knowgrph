
import { GraphNode } from '@/lib/graph/types';

export const calculateNodeDimensions = (
  node: GraphNode,
  options: {
    charWidth?: number;
    lineHeight?: number;
    paddingX?: number;
    paddingY?: number;
    minWidth?: number;
    minHeight?: number;
  } = {}
): { width: number; height: number } => {
  const {
    charWidth = 9,
    lineHeight = 20,
    paddingX = 32,
    paddingY = 20,
    minWidth = 40,
    minHeight = 20,
  } = options;

  const label = String(node.label || node.id || '');
  const lines = label.split('\n');
  const maxLineLength = Math.max(...lines.map(l => l.length));

  const isMarkdown = /[*_[\]]/.test(label);
  const widthMultiplier = isMarkdown ? 1.1 : 1.0;

  const textWidth = Math.max(minWidth, maxLineLength * charWidth * widthMultiplier);
  const textHeight = Math.max(minHeight, lines.length * lineHeight);

  return {
    width: textWidth + paddingX,
    height: textHeight + paddingY,
  };
};
