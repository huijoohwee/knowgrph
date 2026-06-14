export type VideoFormatId = string
export type VideoDownloadMediaKind = 'video-audio' | 'audio'
export type VideoDownloadQualityId = 'best' | '1080p' | '720p' | '480p' | '360p' | 'audio-best' | 'audio-compact'

export type VideoDownloadOptions = {
  format?: VideoFormatId
  mediaKind?: VideoDownloadMediaKind
  quality?: VideoDownloadQualityId
  subtitleLang?: string
  outputDir?: string
}

export type VideoDownloadRequest = {
  url: string
  format?: VideoFormatId
  mediaKind?: VideoDownloadMediaKind
  quality?: VideoDownloadQualityId
  subtitleLang?: string
  outputDir?: string
}

export type VideoDownloadResultOk = {
  ok: true
  filePath: string
  fileName: string
  mimeType: string
  sizeBytes: number
  sourceUrl: string
  fileUrl?: string
}

export type VideoDownloadResultErr = {
  ok: false
  error: string
  errorCode?: string
}

export type VideoDownloadResult = VideoDownloadResultOk | VideoDownloadResultErr

export type VideoDownloadParseError = {
  kind: 'parse_error'
  reason: string
  missingFields?: string[]
  offset?: number
}

export type VideoDownloadResolverResult =
  | { ok: true; result: VideoDownloadResultOk }
  | { ok: false; error: string; errorCode?: string }
