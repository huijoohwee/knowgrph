/**
 * Legacy compatibility only.
 *
 * New multidimensional tables are authored with
 * `serializeMarkdownPipeTable`; this helper remains solely for safely
 * enhancing links inside already-persisted HTML table srcdocs.
 */
export const escapeLegacyRichMediaTableHtml = (value: unknown): string => String(value ?? '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#39;')
