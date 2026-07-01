import React from 'react'

const safeImageSrc = (raw: string): string | null => {
  const value = String(raw || '').trim()
  if (!value) return null
  const lower = value.toLowerCase()
  if (
    lower.startsWith('http://') ||
    lower.startsWith('https://') ||
    lower.startsWith('data:image/') ||
    lower.startsWith('blob:') ||
    value.startsWith('/') ||
    value.startsWith('./') ||
    value.startsWith('../')
  ) return value
  return null
}

export const readWholeCellMarkdownImage = (raw: string): { alt: string; src: string } | null => {
  const match = /^!\[([^\]\r\n]*)\]\(([^)\s]+)(?:\s+["'][^"']*["'])?\)$/.exec(String(raw || '').trim())
  if (!match) return null
  const src = safeImageSrc(match[2] || '')
  if (!src) return null
  return {
    alt: (match[1] || 'Thumbnail').replace(/\\]/g, ']').trim() || 'Thumbnail',
    src,
  }
}

export const renderMarkdownDataViewTableCellImage = (raw: string): React.ReactNode | null => {
  const image = readWholeCellMarkdownImage(raw)
  if (!image) return null
  return (
    <figure className="m-0 flex min-w-[7rem] items-center">
      <img
        src={image.src}
        alt={image.alt}
        loading="lazy"
        className="block h-14 w-24 rounded border border-[color:var(--kg-border)] bg-[color:var(--kg-code-bg)] object-cover"
      />
    </figure>
  )
}
