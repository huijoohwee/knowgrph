import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { buildRichMediaWidgetOutputPatch } from '@/features/chat/richMediaRun'
import { hasIsoBmffAudioTrackBytes, hasMediaAudioTrack, MEDIA_AUDIO_PROBE_SLICE_BYTES } from '@/features/chat/mediaAudioTrackProbe'
import { resolveMediaPatchActiveTab } from '@/components/StoryboardWidgetCanvas/runtime/storyboardWidgetWorkflowRichMediaPublication'

const buildIsoBox = (type: string, children: Uint8Array[]): Uint8Array => {
  const payloadSize = children.reduce((size, child) => size + child.length, 0)
  const bytes = new Uint8Array(8 + payloadSize)
  new DataView(bytes.buffer).setUint32(0, bytes.length)
  for (let index = 0; index < 4; index += 1) bytes[4 + index] = type.charCodeAt(index)
  let offset = 8
  for (const child of children) {
    bytes.set(child, offset)
    offset += child.length
  }
  return bytes
}

const buildMediaContainer = (handlerType: 'soun' | 'vide'): Uint8Array => {
  const handlerPayload = new Uint8Array(12)
  for (let index = 0; index < 4; index += 1) handlerPayload[8 + index] = handlerType.charCodeAt(index)
  return buildIsoBox('moov', [buildIsoBox('trak', [buildIsoBox('mdia', [buildIsoBox('hdlr', [handlerPayload])])])])
}

export async function testVideoWidgetOutputPatchProjectsOnePersistedAssetToVideoAndAudio() {
  const patch = buildRichMediaWidgetOutputPatch({
    kind: 'video',
    asset: {
      blob: new Blob(['video'], { type: 'video/mp4' }),
      renderUrl: '/api/storage/blob/workspace/demo/master.mp4',
      model: 'provider-selected-video-model',
    },
    hasAudioTrack: true,
    outputPath: '/workspace/master.mp4',
  })
  if (patch.videoUrl !== patch.audioUrl || patch.videoUrl !== '/api/storage/blob/workspace/demo/master.mp4') {
    throw new Error(`expected the generated master identity to feed both video and audio projections, got ${JSON.stringify(patch)}`)
  }
  const audioContainer = buildMediaContainer('soun')
  if (!hasIsoBmffAudioTrackBytes(audioContainer) || !await hasMediaAudioTrack(new Blob([audioContainer], { type: 'video/mp4' }))) {
    throw new Error('expected the returned MP4 container to prove its audio track before audio projection')
  }
  if (hasIsoBmffAudioTrackBytes(buildMediaContainer('vide'))) {
    throw new Error('expected a video-only MP4 track to remain insufficient audio proof')
  }
  const tailAudioContainer = new Blob([
    new Uint8Array(MEDIA_AUDIO_PROBE_SLICE_BYTES + 32),
    audioContainer,
  ], { type: 'video/mp4' })
  if (!await hasMediaAudioTrack(tailAudioContainer)) {
    throw new Error('expected the bounded tail probe to find a media audio track without reading the whole MP4')
  }
  if (resolveMediaPatchActiveTab({ existingActiveTab: 'text', patch }) !== 'video') {
    throw new Error('expected stale panel tabs to yield to newly generated video')
  }
  if (resolveMediaPatchActiveTab({ existingActiveTab: 'audio', patch }) !== 'audio') {
    throw new Error('expected an audio panel to keep its tab only when the generated patch proves audio')
  }
  const silentVideoPatch = buildRichMediaWidgetOutputPatch({
    kind: 'video',
    asset: { blob: new Blob(['video']), renderUrl: '/master.mp4', model: 'video-model' },
    hasAudioTrack: false,
    outputPath: '/master.mp4',
  })
  if (silentVideoPatch.audioUrl || resolveMediaPatchActiveTab({ existingActiveTab: 'audio', patch: silentVideoPatch }) !== 'video') {
    throw new Error('expected silent video to avoid audio projection and select the visible video tab')
  }

  const workflowMediaHandlers = readFileSync(resolve(process.cwd(), 'src', 'components', 'StoryboardWidgetCanvas', 'runtime', 'storyboardWidgetWorkflowMediaRunHandlers.ts'), 'utf8')
  if (!workflowMediaHandlers.includes('publishMediaRunOutputToRichMediaPanel({ anchorNode: args.node, patch: outputPatch })')) {
    throw new Error('expected image/video generation success to materialize through the shared downstream Rich Media Panel owner')
  }
}
