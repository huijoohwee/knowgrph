from __future__ import annotations

from typing import Any

from playwright.sync_api import Page


FLIGHT_MISSION_NODE = "kg_flight_sim_mission"
FLIGHT_AIRCRAFT_NODE = "kg_flight_sim_aircraft"
FLIGHT_ASSET_NODE = "kg_xr_procedural_airplane"
AUTHORED_XR_NODES = {
    "kg_graph_xr_stage",
    "kg_xr_native_controller_demo",
    "kg_xr_stage_preset_singapore",
    "kg_xr_playground_treasure",
}
CANONICAL_XR_TERRAIN_NODE = "kg_xr_native_terrain_singapore"
FORBIDDEN_SCENE_PREFIXES = ("kg_game_fps", "kg_xr_empty_world")


def read_flight_scene(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        async () => {
          const store = await import('/src/hooks/useGraphStore.ts')
          const blob = await store.useGraphStore.getState().captureThreeGltfSnapshot()
          if (!blob) return { ready: false }
          const gltf = JSON.parse(await blob.text())
          const nodes = Array.isArray(gltf.nodes) ? gltf.nodes : []
          const roots = Array.from(
            document.querySelectorAll('[data-kg-xr-scene-media-drop="1"]'),
          )
          const canvases = roots.flatMap(
            root => Array.from(root.querySelectorAll('canvas')),
          )
          const missionIndex = nodes.findIndex(
            node => node.name === 'kg_flight_sim_mission',
          )
          const missionNode = missionIndex >= 0 ? nodes[missionIndex] : null
          const pending = Array.isArray(missionNode?.children)
            ? [...missionNode.children]
            : []
          const descendants = []
          const visited = new Set()
          while (pending.length > 0) {
            const index = pending.shift()
            if (!Number.isInteger(index) || visited.has(index) || !nodes[index]) continue
            visited.add(index)
            descendants.push(nodes[index])
            if (Array.isArray(nodes[index].children)) {
              pending.push(...nodes[index].children)
            }
          }
          const namedNodeCounts = nodes.reduce((counts, node) => {
            const name = String(node?.name || '').trim()
            if (name) counts[name] = (counts[name] || 0) + 1
            return counts
          }, {})
          const authoredTransforms = [
            'kg_graph_xr_stage',
            'kg_xr_native_controller_demo',
            'kg_xr_stage_preset_singapore',
            'kg_xr_playground_treasure',
          ].sort().map(name => {
            const node = nodes.find(candidate => candidate.name === name)
            return {
              name,
              translation: node?.translation || null,
              rotation: node?.rotation || null,
              scale: node?.scale || null,
              matrix: node?.matrix || null,
              stageId: node?.extras?.stageId ?? null,
              stageScale: node?.extras?.stageScale ?? null,
            }
          })
          return {
            ready: true,
            rootCount: roots.length,
            canvasCount: canvases.length,
            canvasStable: canvases.length === 1
              && (!window.__kgFlightSimCanvas || window.__kgFlightSimCanvas === canvases[0]),
            root: {
              documentLoaded: roots[0]?.getAttribute('data-kg-xr-document-loaded') || '',
              flightStage: roots[0]?.getAttribute('data-kg-flight-sim-stage') || '',
              flightSurface: roots[0]?.getAttribute('data-kg-flight-sim-surface') || '',
              authoredRetained: roots[0]?.getAttribute('data-kg-authored-xr-scene-retained') || '',
              emptyWorld: roots[0]?.getAttribute('data-kg-xr-empty-world') || '',
            },
            names: Object.keys(namedNodeCounts).sort(),
            namedNodeCounts,
            authoredSceneSignature: JSON.stringify(authoredTransforms),
            mission: {
              actorOnly: missionNode?.extras?.actorOnly === true,
              descendantNames: descendants
                .map(node => String(node?.name || '').trim())
                .filter(Boolean)
                .sort(),
              unnamedDescendantCount: descendants
                .filter(node => !String(node?.name || '').trim()).length,
              lightDescendantCount: descendants.filter(
                node => Number.isInteger(
                  node?.extensions?.KHR_lights_punctual?.light,
                ),
              ).length,
            },
          }
        }
        """
    )


def assert_authored_scene(scene: dict[str, Any]) -> None:
    if scene.get("ready") is not True:
        raise AssertionError(f"Three scene snapshot was unavailable: {scene}")
    if scene.get("rootCount") != 1 or scene.get("canvasCount") != 1:
        raise AssertionError(f"expected one shared authored XR Canvas: {scene}")
    if scene.get("canvasStable") is not True:
        raise AssertionError("Flight Sim replaced the shared authored XR Canvas")
    names = set(scene.get("names") or [])
    missing = sorted(AUTHORED_XR_NODES - names)
    if missing:
        raise AssertionError(f"authored XR nodes were missing: {missing}")
    counts = scene.get("namedNodeCounts") or {}
    if counts.get(CANONICAL_XR_TERRAIN_NODE) != 1:
        raise AssertionError("Flight Sim did not retain exactly one canonical XR terrain")
    forbidden = sorted(
        name
        for name in names
        if any(name.startswith(prefix) for prefix in FORBIDDEN_SCENE_PREFIXES)
    )
    if forbidden:
        raise AssertionError(f"fallback or sibling gameplay scene mounted: {forbidden}")


def assert_active_flight_scene(
    scene: dict[str, Any],
    *,
    completed_waypoint_count: int = 0,
    waypoint_count: int = 3,
) -> None:
    assert_authored_scene(scene)
    root = scene.get("root") or {}
    if root != {
        "documentLoaded": "1",
        "flightStage": "active",
        "flightSurface": "xr",
        "authoredRetained": "1",
        "emptyWorld": "",
    }:
        raise AssertionError(f"Flight Sim XR surface contract was not active: {root}")
    counts = scene.get("namedNodeCounts") or {}
    expected_once = (FLIGHT_MISSION_NODE, FLIGHT_AIRCRAFT_NODE, FLIGHT_ASSET_NODE)
    if any(counts.get(name) != 1 for name in expected_once):
        raise AssertionError(f"Flight actor-only stage was duplicated or missing: {counts}")
    waypoint_names = [
        name for name in counts if name.startswith("kg_flight-sim_waypoint_")
    ]
    expected_visible_waypoints = max(
        0,
        waypoint_count - completed_waypoint_count,
    )
    exact_waypoint_visibility = all(
        sum(
            name.startswith(f"kg_flight-sim_waypoint_{index}_")
            for name in waypoint_names
        )
        == (1 if index > completed_waypoint_count else 0)
        for index in range(1, waypoint_count + 1)
    )
    if (
        len(waypoint_names) != expected_visible_waypoints
        or any(counts[name] != 1 for name in waypoint_names)
        or not exact_waypoint_visibility
    ):
        raise AssertionError(f"Flight waypoint actors were not exact: {waypoint_names}")
    mission = scene.get("mission") or {}
    if mission.get("actorOnly") is not True or mission.get("lightDescendantCount") != 0:
        raise AssertionError(f"Flight mission mounted a world or light owner: {mission}")
    unexpected = sorted(
        name
        for name in mission.get("descendantNames") or []
        if name not in {FLIGHT_AIRCRAFT_NODE, FLIGHT_ASSET_NODE}
        and not name.startswith("kg_xr_airplane_")
        and not name.startswith("kg_flight-sim_waypoint_")
    )
    if unexpected:
        raise AssertionError(
            f"Flight mission subtree contained non-actor scene nodes: {unexpected}"
        )
