import type { Canvas3dModeId } from '@/lib/config'
import type { GameModeSurfaceMode } from './gameModeRuntime'

export type GameFpsScenePresentation = 'arena' | 'xr-authored'

export type GameModeSceneComposition = Readonly<{
  gamePresentation: GameFpsScenePresentation
  renderAuthoredWorld: boolean
  renderOrbitControls: boolean
  retainAuthoredXrScene: boolean
  rendererClearOwner: 'authored-world' | 'game-arena'
}>

export const GAME_FPS_ARENA_CLEAR_COLOR = '#07151b'

export function resolveGameModeSceneComposition(input: Readonly<{
  authoredWorldAvailable: boolean
  canvasMode: Canvas3dModeId
  gameFpsActive: boolean
  gameModeActive: boolean
  gameModeSurface: GameModeSurfaceMode
}>): GameModeSceneComposition {
  const retainAuthoredXrScene = input.gameFpsActive
    && input.gameModeActive
    && input.gameModeSurface === 'xr'
    && input.canvasMode === 'xr'
    && input.authoredWorldAvailable
  return Object.freeze({
    gamePresentation: retainAuthoredXrScene ? 'xr-authored' : 'arena',
    renderAuthoredWorld: !input.gameFpsActive || retainAuthoredXrScene,
    renderOrbitControls: !input.gameFpsActive,
    retainAuthoredXrScene,
    rendererClearOwner: input.gameFpsActive && !retainAuthoredXrScene
      ? 'game-arena'
      : 'authored-world',
  })
}
