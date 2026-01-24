export type SanitizeMessageTextOptions = {
  maxLines?: number;
  stripErrorPrefix?: boolean;
};

export function sanitizeMessageText(raw: unknown, opts?: SanitizeMessageTextOptions): string {
  const maxLinesRaw = opts?.maxLines;
  const maxLines =
    typeof maxLinesRaw === 'number' && Number.isFinite(maxLinesRaw)
      ? Math.max(1, Math.floor(maxLinesRaw))
      : 4;
  const stripErrorPrefix = !!opts?.stripErrorPrefix;

  const text = raw instanceof Error ? raw.message : String(raw ?? '');
  const lines = text.split('\n').map(l => l.trimEnd());
  const out: string[] = [];

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i]?.trim() || '';
    if (!line) continue;
    if (/^at\s+/i.test(line)) continue;
    if (stripErrorPrefix && /^error:\s*/i.test(line)) {
      line = line.replace(/^error:\s*/i, '').trim();
      if (!line) continue;
    }
    out.push(line);
    if (out.length >= maxLines) break;
  }

  return out.join('\n').trim();
}

