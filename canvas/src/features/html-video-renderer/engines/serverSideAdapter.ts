import type { RenderEngine } from '../htmlVideoRendererSsot'
import { HTML_VIDEO_ENGINE_IDS } from '../htmlVideoRendererSsot'

export const serverSideAdapter: RenderEngine = {
  engineId: HTML_VIDEO_ENGINE_IDS.serverSide,
  async render() {
    throw new Error('server-side adapter not implemented')
  },
}
