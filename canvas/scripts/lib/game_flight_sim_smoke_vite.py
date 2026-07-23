from __future__ import annotations

import time

from playwright.sync_api import Error as PlaywrightError
from playwright.sync_api import Page


VITE_WARMUP_MODULES = (
    "/src/hooks/useGraphStore.ts",
    "/src/features/source-files/sourceFilesRuntimeMaterialization.ts",
    "/src/features/workspace-fs/workspaceFs.ts",
    "/src/features/workspace-fs/workspaceCanonicalSeedBundle.ts",
    "/src/features/workspace-fs/workspaceRunReadyDemos.ts",
    "/src/features/three/xrPhysicsRuntime.ts",
    "/src/features/three/xrNativeControllerDemoRuntime.ts",
    "/src/features/three/xrNativeControllerCameraRuntime.ts",
    "/src/features/three/xrNativeControllerCameraCatalog.ts",
    "/src/features/three/xrNativeControllerPresentation.ts",
    "/src/features/three/xrMotionReferenceRuntime.ts",
    "/src/features/three/xrCameraPlaybackControlsRuntime.ts",
    "/src/features/three/xrMotionReferenceTimeline.ts",
    "/src/features/game-flight-sim/flightSimRuntime.ts",
    "/src/features/game-flight-sim/flightSimMcpRuntime.ts",
    "/src/features/agent-ready/flightSimWebMcpTools.ts",
    "/src/features/strybldr/cameraMcpRuntime.ts",
)


def warm_vite_module_graph(page: Page) -> None:
    for attempt in range(1, 13):
        token = f"flight-smoke-warmup-{attempt}-{time.time_ns()}"
        try:
            time_origin = page.evaluate(
                """
                async ({ modules, token }) => {
                  await Promise.all(modules.map(module => import(module)))
                  window.__kgFlightSimWarmupToken = token
                  return performance.timeOrigin
                }
                """,
                {"modules": VITE_WARMUP_MODULES, "token": token},
            )
            page.wait_for_timeout(1_500)
            stable = page.evaluate(
                """
                ({ token, timeOrigin }) => (
                  window.__kgFlightSimWarmupToken === token
                  && performance.timeOrigin === timeOrigin
                )
                """,
                {"token": token, "timeOrigin": time_origin},
            )
            if stable is True:
                return
        except PlaywrightError as error:
            if "Execution context was destroyed" not in str(error):
                raise
        page.wait_for_timeout(500)
    raise AssertionError("Vite module graph did not stabilize after 12 attempts")


def prepare_stable_candidate_page(page: Page, target_url: str) -> None:
    page.goto(target_url, wait_until="domcontentloaded")
    warm_vite_module_graph(page)
    page.reload(wait_until="domcontentloaded")
    warm_vite_module_graph(page)
