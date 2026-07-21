export function resolveAuthoredWorldPaused(paused: boolean, gameFpsActive: boolean): boolean {
  return paused || gameFpsActive
}
