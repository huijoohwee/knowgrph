import React from 'react'
import { renderPlainMermaidSvgCached } from '@/lib/mermaid/mermaidSvg'

const normalizeMermaidClickSyntax = (code: string): string => {
  const lines = String(code || '').split('\n')
  for (let i = 0; i < lines.length; i += 1) {
    const line = String(lines[i] || '')
    const match = /^(\s*click\s+([A-Za-z0-9_.:-]+))\s+(".*)$/.exec(line)
    if (!match) continue
    if (/\s+(href|call)\s+/i.test(line)) continue
    lines[i] = `${match[1]} href ${match[3]}`
  }
  return lines.join('\n')
}

const sanitizeMermaidSvg = (raw: string): string => {
  const input = String(raw || '').trim()
  if (!input) return ''
  try {
    const doc = new window.DOMParser().parseFromString(input, 'image/svg+xml')
    const root = doc.documentElement
    if (!root || root.nodeName.toLowerCase() !== 'svg') return input
    const all = root.querySelectorAll('*')
    for (const el of Array.from(all)) {
      const tag = el.tagName.toLowerCase()
      if (tag === 'script') {
        el.remove()
        continue
      }
      const names = el.getAttributeNames()
      for (const name of names) {
        if (name.toLowerCase().startsWith('on')) el.removeAttribute(name)
      }
    }
    return new window.XMLSerializer().serializeToString(root)
  } catch {
    return input
  }
}

const extractMermaidErrorFromSvg = (svg: string): string | null => {
  const raw = String(svg || '')
  if (!raw.trim()) return null
  const hasErrorRole = /aria-roledescription\s*=\s*"error"/i.test(raw)
  const hasErrorTextClass = /class\s*=\s*"[^"]*\berror-text\b[^"]*"/i.test(raw)
  if (!hasErrorRole && !hasErrorTextClass) return null
  const textMatches = Array.from(raw.matchAll(/<text[^>]*>([\s\S]*?)<\/text>/gi))
  for (let i = 0; i < textMatches.length; i += 1) {
    const message = String(textMatches[i]?.[1] || '').replace(/\s+/g, ' ').trim()
    if (!message) continue
    if (/^mermaid version\s+/i.test(message)) continue
    return message
  }
  return 'Mermaid syntax error'
}

export function PlainMermaidDiagram({
  code,
  rootThemeMode,
}: {
  code: string
  rootThemeMode: 'light' | 'dark'
}) {
  const [svg, setSvg] = React.useState('')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const normalized = normalizeMermaidClickSyntax(String(code || '').trim())
        if (!normalized) {
          if (!cancelled) setError('Mermaid diagram code is empty')
          return
        }
        const out = await renderPlainMermaidSvgCached({
          code: normalized,
          theme: rootThemeMode === 'dark' ? 'dark' : 'light',
        })
        if (cancelled) return
        const nextSvg = sanitizeMermaidSvg(out.svg)
        const renderError = extractMermaidErrorFromSvg(nextSvg)
        if (renderError) {
          setError(renderError)
          setSvg('')
          return
        }
        setError(null)
        setSvg(nextSvg)
      } catch (e) {
        if (cancelled) return
        setError(e instanceof Error ? e.message : String(e))
        setSvg('')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [code, rootThemeMode])

  if (error) {
    return <div className="text-xs text-red-600 dark:text-red-400">{error}</div>
  }

  if (!svg) return null

  return (
    <div
      className="overflow-auto rounded border border-gray-200/70 bg-white/70 dark:border-gray-700 dark:bg-gray-950/40"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  )
}

export default PlainMermaidDiagram
