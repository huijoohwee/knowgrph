export type LineTok = { num: number; raw: string; indent: number; text: string };

const trimIndent = (line: string) => {
  const m = /^(\s*)(.*)$/.exec(line || '');
  const indent = m ? (m[1] || '') : '';
  const text = m ? (m[2] || '') : '';
  return { indent: indent.length, text };
};

export const toLines = (body: string): LineTok[] => {
  const out: LineTok[] = [];
  const arr = String(body || '').split(/\r?\n/);
  for (let i = 0; i < arr.length; i++) {
    const raw = arr[i];
    const { indent, text } = trimIndent(raw);
    out.push({ num: i + 1, raw, indent, text });
  }
  return out;
};

export const isBlankOrComment = (t: string): boolean => {
  const s = String(t || '').trim();
  return s === '' || s.startsWith('#');
};

export const matchClass = (t: string) => /^class\s+([A-Za-z_][A-Za-z0-9_]*)(?:\s*\(([^)]*)\))?\s*:\s*$/.exec(t);
export const matchDef = (t: string) => /^def\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(([^)]*)\)\s*:\s*$/.exec(t);
export const matchImport = (t: string) => /^import\s+(.+)$/.exec(t);
export const matchFromImport = (t: string) => /^from\s+([\w_.]+|\.+)\s+import\s+(.+)$/.exec(t);

export const findCallsInLine = (t: string): string[] => {
  const res: string[] = [];
  const s = String(t || '');
  let i = 0;
  while (i < s.length) {
    while (i < s.length && /[\s]/.test(s[i])) i++;
    const start = i;
    while (i < s.length && /[A-Za-z0-9_.]/.test(s[i])) i++;
    const ident = s.slice(start, i);
    if (ident && s[i] === '(') {
      res.push(ident);
      let depth = 0;
      while (i < s.length) {
        const ch = s[i++];
        if (ch === '(') depth++;
        else if (ch === ')') { depth--; if (depth <= 0) break; }
      }
    } else {
      i++;
    }
  }
  return res;
};
