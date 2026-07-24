from __future__ import annotations

from typing import Any, Callable

from playwright.sync_api import Page


def verify_source_file_button_round_trip(
    page: Page,
    expected_source_text: str,
    *,
    flight_basename: str,
    physics_basename: str,
    poll: Callable[..., dict[str, Any]],
    read_source_identity: Callable[[Page, str], dict[str, Any]],
) -> dict[str, Any]:
    flight_button = page.get_by_role(
        "button", name=flight_basename, exact=True
    )
    physics_button = page.get_by_role(
        "button", name=physics_basename, exact=True
    )
    flight_button.wait_for(state="visible", timeout=120_000)
    flight_button.click()
    flight = poll(
        page,
        lambda: read_source_identity(page, expected_source_text),
        lambda value: (
            str(value.get("documentName") or "").endswith(flight_basename)
            and value.get("active") is True
            and value.get("authoredSeedByteIdentical") is True
            and value.get("workspaceSourceByteIdentical") is True
            and all((value.get("sourceContract") or {}).values())
            and value.get("surfaceMode") == "xr"
            and value.get("renderMode") == "3d"
            and value.get("canvas3dMode") == "xr"
        ),
        label="Flight Source Files button XR activation",
    )
    page.locator('[data-kg-flight-sim-hud="1"]').first.wait_for(
        state="visible", timeout=120_000
    )
    flight_surface = page.evaluate(
        """
        () => {
          const root = document.querySelector(
            '[data-kg-xr-scene-media-drop="1"]',
          )
          const canvas = root?.querySelector('canvas') || null
          return {
            retainedCanvas: Boolean(canvas)
              && canvas === window.__kgFlightSimCanvas,
            rendererCanvasCount: Array.from(
              document.querySelectorAll('canvas'),
            ).filter(candidate => String(
              candidate.dataset.engine || '',
            ).startsWith('three.js')).length,
          }
        }
        """
    )
    if (
        flight_surface.get("retainedCanvas") is not True
        or flight_surface.get("rendererCanvasCount") != 1
    ):
        raise AssertionError(
            f"Flight file click replaced the shared XR Canvas: {flight_surface}"
        )

    physics_button.wait_for(state="visible", timeout=120_000)
    physics_button.click()
    restored = poll(
        page,
        lambda: page.evaluate(
            """
            async () => {
              const store = await window.__kgFlightSimBrowserProof.importModule('graphStore')
              const demos = await window.__kgFlightSimBrowserProof.importModule('workspaceRunReadyDemos')
              const state = store.useGraphStore.getState()
              const root = document.querySelector(
                '[data-kg-xr-scene-media-drop="1"]',
              )
              const canvas = root?.querySelector('canvas') || null
              return {
                documentName: state.markdownDocumentName,
                active: demos.isXrPhysicsRunReadyDemoActive(
                  state.markdownDocumentName,
                  state.markdownDocumentText,
                ),
                renderMode: state.canvasRenderMode,
                canvas3dMode: state.canvas3dMode,
                retainedCanvas: Boolean(canvas)
                  && canvas === window.__kgFlightSimCanvas,
                flightHudCount: document.querySelectorAll(
                  '[data-kg-flight-sim-hud="1"]',
                ).length,
              }
            }
            """
        ),
        lambda value: (
            str(value.get("documentName") or "").endswith(physics_basename)
            and value.get("active") is True
            and value.get("renderMode") == "3d"
            and value.get("canvas3dMode") == "xr"
            and value.get("retainedCanvas") is True
            and value.get("flightHudCount") == 0
        ),
        label="Physics Source Files button restoration",
    )
    return {
        "flight": flight,
        "flightSurface": flight_surface,
        "physics": restored,
    }
