export const isRecordType = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);

const wrapCache = new Map<string, string>();
const truncateCache = new Map<string, string>();

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

export const truncateTextWithEllipsis = (raw: string, maxChars: number): string => {
  const max = Number.isFinite(maxChars) && maxChars > 0 ? Math.floor(maxChars) : 0
  const input = String(raw || '')
  if (max <= 0) return ''
  if (input.length <= max) return input
  if (max <= 1) return '…'
  const key = `${input}:${max}`
  const cached = truncateCache.get(key)
  if (cached) return cached
  const out = `${input.slice(0, Math.max(0, max - 1))}…`
  truncateCache.set(key, out)
  return out
}

export const estimateLabelCharWidthPx = (fontSizePx: number): number => {
  const fs = typeof fontSizePx === 'number' && Number.isFinite(fontSizePx) ? fontSizePx : 12
  return Math.max(4, Math.min(14, fs * 0.6))
}

export const estimateMaxCharsForWidthPx = (widthPx: number, fontSizePx: number): number => {
  const w = typeof widthPx === 'number' && Number.isFinite(widthPx) ? widthPx : 0
  const charW = estimateLabelCharWidthPx(fontSizePx)
  return Math.max(1, Math.floor(Math.max(0, w) / Math.max(1, charW)))
}
