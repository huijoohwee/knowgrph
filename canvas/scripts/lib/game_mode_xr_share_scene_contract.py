from __future__ import annotations

from typing import Any

from playwright.sync_api import Page


AUTHORED_XR_NODES = {
    "kg_graph_xr_stage",
    "kg_xr_native_controller_demo",
    "kg_xr_stage_preset_singapore",
    "kg_xr_playground_treasure",
}
GAME_NODES = {
    "kg_game_fps_mission",
    "kg_game_fps_npc_npc-scout",
    "kg_game_fps_npc_npc-west",
    "kg_game_fps_npc_npc-east",
    "kg_game_fps_npc_npc-guard",
}


def read_xr_state(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        async () => {
          const runtime = await import('/src/features/three/xrNativeControllerDemoRuntime.ts')
          return {
            snapshot: runtime.readXrNativeControllerDemo(),
            frame: runtime.readSharedXrNativeControllerDemoFrame(),
          }
        }
        """
    )


def assert_stable_renderer_canvas(page: Page) -> None:
    state = page.evaluate(
        """
        () => {
          const canvases = Array.from(document.querySelectorAll('[data-kg-xr-scene-media-drop="1"] canvas'))
          return {
            count: canvases.length,
            same: canvases.length === 1 && window.__kgGameModeXrShareCanvas === canvases[0],
          }
        }
        """
    )
    if state != {"count": 1, "same": True}:
        raise AssertionError(f"shared XR/Game Mode renderer canvas was not stable: {state}")


def install_restored_frame_capture(page: Page) -> None:
    page.evaluate(
        """
        async () => {
          const runtime = await import('/src/features/three/xrNativeControllerDemoRuntime.ts')
          window.__kgGameModeXrRestoredFrame = null
          const unsubscribe = runtime.subscribeXrNativeControllerDemo(() => {
            if (runtime.readXrNativeControllerDemo().phase !== 'running') return
            window.__kgGameModeXrRestoredFrame = JSON.parse(JSON.stringify(
              runtime.readSharedXrNativeControllerDemoFrame(),
            ))
            unsubscribe()
          })
          window.__kgGameModeXrRestoredFrameCancel = unsubscribe
        }
        """
    )


def read_scene_contract(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        async () => {
          const store = await import('/src/hooks/useGraphStore.ts')
          const blob = await store.useGraphStore.getState().captureThreeGltfSnapshot()
          if (!blob) return { ready: false, names: [] }
          const gltf = JSON.parse(await blob.text())
          const root = document.querySelector('[data-kg-xr-scene-media-drop="1"]')
          const canvas = root?.querySelector('canvas')
          const nodes = gltf.nodes || []
          const nativeStage = nodes.find(node => node.name === 'kg_xr_native_controller_demo')
          const gameStage = nodes.find(node => node.name === 'kg_game_fps_mission')
          return {
            ready: true,
            names: Array.from(new Set(nodes.map(node => String(node.name || '')).filter(Boolean))).sort(),
            retained: root?.getAttribute('data-kg-authored-xr-scene-retained') || '',
            presentation: root?.getAttribute('data-kg-game-mode-scene') || '',
            cameraFov: canvas?.getAttribute('data-kg-game-fps-camera-fov') || '',
            spatialProfile: canvas?.getAttribute('data-kg-game-fps-spatial-profile') || '',
            nativeStageScale: Number(nativeStage?.extras?.stageScale || 0),
            gameStageScale: Number(gameStage?.extras?.coordinateScale || 0),
          }
        }
        """
    )


def assert_scene_contract(contract: dict[str, Any], *, game_active: bool) -> None:
    if contract.get("ready") is not True:
        raise AssertionError(f"Three scene snapshot was unavailable: {contract}")
    names = set(contract.get("names") or [])
    missing_xr = sorted(AUTHORED_XR_NODES - names)
    if missing_xr:
        raise AssertionError(f"authored XR scene nodes were missing: {missing_xr}")
    if not game_active:
        return
    missing_game = sorted(GAME_NODES - names)
    if missing_game:
        raise AssertionError(f"Game Mode overlay nodes were missing: {missing_game}")
    if "kg_game_fps_arena" in names:
        raise AssertionError("XR Game Mode mounted the fallback procedural arena")
    if contract.get("retained") != "1" or contract.get("presentation") != "xr-authored":
        raise AssertionError(f"XR Game Mode did not report authored-scene composition: {contract}")
    if contract.get("spatialProfile") != "xr-authored":
        raise AssertionError(f"XR Game Mode did not reuse the authored collision profile: {contract}")
    if not contract.get("nativeStageScale") or contract.get("gameStageScale") != contract.get("nativeStageScale"):
        raise AssertionError(f"XR Game Mode did not share authored-stage coordinates: {contract}")
    if not str(contract.get("cameraFov") or "").strip():
        raise AssertionError("Game Mode first-person camera did not publish its framing contract")
