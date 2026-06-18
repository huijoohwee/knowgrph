import { FileAudio, FileCode2, ImageIcon, Video } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export function resolveMediaKindOverlayIcon(kind: string | null | undefined): LucideIcon {
  const normalizedKind = String(kind || '').trim().toLowerCase()
  if (normalizedKind === 'audio') return FileAudio
  if (normalizedKind === 'image' || normalizedKind === 'svg') return ImageIcon
  if (normalizedKind === 'iframe' || normalizedKind === 'webpage' || normalizedKind === 'tweet') return FileCode2
  return Video
}
