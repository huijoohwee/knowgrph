import { normalizeRichMediaPanelInlineSrcDoc, shouldUseViewportRichMediaPanelSrcDocSize } from '@/lib/render/richMediaPanelSrcDoc'

export function testRichMediaPanelSrcDocBridgeControlsVideoAgentSourcePlaybackAudio() {
  const normalized = normalizeRichMediaPanelInlineSrcDoc({
    title: 'Video Agent Stream Output',
    srcDoc: [
      '<main data-kg-video-agent-stream-panel="1" data-kg-rich-media-panel-size="viewport" aria-label="Video agent stream output">',
      '<section data-kg-video-agent-source-playback="1" aria-label="Audio-capable source playback">',
      '<iframe title="Audio-capable source video playback" src="https://www.youtube-nocookie.com/embed/source-video?enablejsapi=1&playsinline=1"></iframe>',
      '</section>',
      '</main>',
    ].join(''),
  })

  for (const token of [
    'data-kg-rich-media-panel-size="viewport"',
    '[data-kg-video-agent-source-playback] iframe',
    'postYouTubeCommand',
    '"seekTo"',
    '"setPlaybackRate"',
    '"playVideo"',
    '"pauseVideo"',
    'sourcePlaybackState',
  ]) {
    if (!normalized.includes(token)) {
      throw new Error(`expected Rich Media srcdoc bridge to expose audio playback sync token ${token}`)
    }
  }
  if (!shouldUseViewportRichMediaPanelSrcDocSize(normalized)) {
    throw new Error('expected video-agent srcdoc to opt out of panel content-height expansion')
  }
}
