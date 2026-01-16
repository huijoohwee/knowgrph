
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

export const isRecordType = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const wrapCache = new Map<string, string>();

export const wrapTextByMaxChars = (raw: string, maxCharsPerLine: number): string => {
  const key = `${raw}:${maxCharsPerLine}`;
  if (wrapCache.has(key)) return wrapCache.get(key)!;

  const maxChars = Number.isFinite(maxCharsPerLine) && maxCharsPerLine > 1 ? Math.floor(maxCharsPerLine) : 1;
  const normalized = String(raw || '').replace(/<br\s*\/?>/gi, '\n').replace(/\r\n?/g, '\n');
  const inputLines = normalized.split('\n');

  const chunkWord = (word: string): string[] => {
    const out: string[] = [];
    const w = String(word || '');
    if (!w) return [''];
    for (let i = 0; i < w.length; i += maxChars) out.push(w.slice(i, i + maxChars));
    return out;
  };

  const wrapLine = (line: string): string[] => {
    const rawLine = String(line || '');
    const trimmed = rawLine.trim();
    if (!trimmed) return [''];
    if (!/\s/.test(trimmed)) {
      if (trimmed.length <= maxChars) return [trimmed];
      return chunkWord(trimmed);
    }
    const words = trimmed.split(/\s+/).filter(Boolean);
    const out: string[] = [];
    let current = '';
    for (let i = 0; i < words.length; i += 1) {
      const word = words[i];
      if (!current) {
        if (word.length <= maxChars) {
          current = word;
        } else {
          const chunks = chunkWord(word);
          if (chunks.length > 1) out.push(...chunks.slice(0, -1));
          current = chunks[chunks.length - 1] || '';
        }
        continue;
      }
      if (current.length + 1 + word.length <= maxChars) {
        current = `${current} ${word}`;
        continue;
      }
      out.push(current);
      if (word.length <= maxChars) {
        current = word;
      } else {
        const chunks = chunkWord(word);
        if (chunks.length > 1) out.push(...chunks.slice(0, -1));
        current = chunks[chunks.length - 1] || '';
      }
    }
    if (current) out.push(current);
    return out.length ? out : [''];
  };

  const outLines: string[] = [];
  for (let i = 0; i < inputLines.length; i += 1) outLines.push(...wrapLine(inputLines[i]));
  const result = outLines.join('\n');
  wrapCache.set(key, result);
  return result;
};
