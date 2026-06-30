import { normalizeRichMediaPanelInlineSrcDoc } from '@/lib/render/richMediaPanelSrcDoc'

export function testRichMediaPanelSrcDocBridgeControlsVideoAgentSourcePlaybackAudio() {
  const normalized = normalizeRichMediaPanelInlineSrcDoc({
    title: 'Video Agent Stream Output',
    srcDoc: [
      '<main data-kg-video-agent-stream-panel="1" aria-label="Video agent stream output">',
      '<section data-kg-video-agent-source-playback="1" aria-label="Audio-capable source playback">',
      '<iframe title="Audio-capable source video playback" src="https://www.youtube-nocookie.com/embed/source-video?enablejsapi=1&playsinline=1"></iframe>',
      '</section>',
      '</main>',
    ].join(''),
  })

  for (const token of [
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
}
