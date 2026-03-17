export const HLJS_STYLE_ID = 'kg-hljs-theme'

export const HLJS_THEME_CSS = `
/* Light Theme (GitHub-like) */
.hljs { color: #24292f; background: transparent; }
.hljs-comment, .hljs-quote { color: #6e7781; font-style: italic; }
.hljs-keyword, .hljs-selector-tag, .hljs-literal, .hljs-title, .hljs-section { color: #cf222e; }
.hljs-string, .hljs-attribute, .hljs-symbol, .hljs-bullet { color: #0a3069; }
.hljs-number, .hljs-meta, .hljs-built_in { color: #953800; }
.hljs-function, .hljs-params { color: #8250df; }
.hljs-addition { color: #1a7f37; background-color: #dafbe1; }
.hljs-deletion { color: #cf222e; background-color: #ffebe9; }

/* Dark Theme (GitHub Dark-like) */
.dark .hljs { color: #c9d1d9; background: transparent; }
.dark .hljs-comment, .dark .hljs-quote { color: #8b949e; }
.dark .hljs-keyword, .dark .hljs-selector-tag, .dark .hljs-literal, .dark .hljs-title, .dark .hljs-section { color: #ff7b72; }
.dark .hljs-string, .dark .hljs-attribute, .dark .hljs-symbol, .dark .hljs-bullet { color: #a5d6ff; }
.dark .hljs-number, .dark .hljs-meta, .dark .hljs-built_in { color: #d2a8ff; }
.dark .hljs-function, .dark .hljs-params { color: #d2a8ff; }
.dark .hljs-addition { color: #3fb950; background-color: rgba(46, 160, 67, 0.15); }
.dark .hljs-deletion { color: #f85149; background-color: rgba(218, 54, 51, 0.15); }
`

export function ensureHljsThemeStyle() {
  if (typeof document === 'undefined') return
  if (document.getElementById(HLJS_STYLE_ID)) return
  const styleEl = document.createElement('style')
  styleEl.id = HLJS_STYLE_ID
  styleEl.textContent = HLJS_THEME_CSS
  document.head.appendChild(styleEl)
}

