from __future__ import annotations

from typing import Any

from playwright.sync_api import Page


FLIGHT_WEB_MCP_DEADLINE_MS = 2_000
FLIGHT_TOOL_NAMES = {
    "knowgrph.inspect_local_flight_sim",
    "knowgrph.control_local_flight_sim",
}


def control_flight_via_web_mcp(
    page: Page,
    invocation: str,
    calls: list[dict[str, Any]],
) -> dict[str, Any]:
    timed = page.evaluate(
        """
        async invocation => {
          const tools = Array.from(navigator.modelContext?.tools || [])
          const control = tools.find(
            tool => tool.name === 'knowgrph.control_local_flight_sim',
          )
          if (!control) {
            return {
              result: { ok: false, missingTool: true },
              elapsedMs: 0,
            }
          }
          const startedAtMs = performance.now()
          const result = await control.execute({ invocation })
          return {
            result,
            elapsedMs: performance.now() - startedAtMs,
          }
        }
        """,
        invocation,
    )
    metric = {
        "tool": "knowgrph.control_local_flight_sim",
        "operation": invocation.rsplit("operation=", 1)[-1].split()[0],
        "elapsedMs": timed["elapsedMs"],
        "deadlineMs": FLIGHT_WEB_MCP_DEADLINE_MS,
        "withinDeadline":
            timed["elapsedMs"] <= FLIGHT_WEB_MCP_DEADLINE_MS,
        "ok": timed["result"].get("ok") is True,
        "errorCode": timed["result"].get("errorCode"),
    }
    calls.append(metric)
    if not metric["withinDeadline"]:
        raise AssertionError(
            f"Flight WebMCP control exceeded 2 seconds: {metric}"
        )
    return timed["result"]


def verify_flight_web_mcp(
    page: Page,
    initial: dict[str, Any],
) -> dict[str, Any]:
    evidence = page.evaluate(
        """
        async () => {
          const tools = Array.from(navigator.modelContext?.tools || [])
          const runtime = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const webMcpRuntime = await import(
            '/src/features/agent-ready/flightSimWebMcpTools.ts'
          )
          const flightTools = tools
            .filter(tool => tool.name.includes('local_flight_sim'))
            .map(tool => tool.name)
            .sort()
          const inspect = tools.find(
            tool => tool.name === 'knowgrph.inspect_local_flight_sim',
          )
          const control = tools.find(
            tool => tool.name === 'knowgrph.control_local_flight_sim',
          )
          if (!inspect || !control) {
            return { flightTools, registered: false }
          }
          const deadlineMs = webMcpRuntime.FLIGHT_SIM_WEB_MCP_DEADLINE_MS
          const call = async (tool, input, operation) => {
            const before = JSON.stringify(runtime.readFlightSimSnapshot())
            const startedAtMs = performance.now()
            const result = input === undefined
              ? await tool.execute()
              : await tool.execute(input)
            const elapsedMs = performance.now() - startedAtMs
            const after = JSON.stringify(runtime.readFlightSimSnapshot())
            return {
              operation,
              elapsedMs,
              deadlineMs,
              withinDeadline: elapsedMs <= deadlineMs,
              ok: result?.ok !== false,
              errorCode: result?.errorCode || null,
              message: result?.message || '',
              stateUnchanged: before === after,
              result,
            }
          }
          const inspected = await call(inspect, undefined, 'inspect')
          const diagnosticInputs = [
            {
              operation: 'missing-command',
              input: { invocation: '@canvas #flight operation=start' },
              errorCode: 'FLIGHT_SIM_INVOCATION_MISSING_COMMAND',
            },
            {
              operation: 'duplicate-binding',
              input: {
                invocation:
                  '/flight.sim @canvas @canvas #flight operation=start',
              },
              errorCode: 'FLIGHT_SIM_INVOCATION_DUPLICATE_SIGIL',
            },
            {
              operation: 'unknown-key',
              input: {
                invocation:
                  '/flight.sim @canvas #flight operation=start extra=1',
              },
              errorCode: 'FLIGHT_SIM_INVOCATION_UNKNOWN_KEY',
            },
            {
              operation: 'mixed-input',
              input: {
                invocation:
                  '/flight.sim @canvas #flight operation=start',
                operation: 'start',
              },
              errorCode: 'FLIGHT_SIM_CONTROL_MIXED_INPUT',
            },
            {
              operation: 'unsupported-operation',
              input: {
                invocation:
                  '/flight.sim @canvas #flight operation=inspect',
              },
              errorCode: 'FLIGHT_SIM_CONTROL_UNSUPPORTED_OPERATION',
            },
          ]
          const diagnostics = []
          for (const item of diagnosticInputs) {
            const observed = await call(
              control,
              item.input,
              item.operation,
            )
            diagnostics.push({
              ...observed,
              expectedErrorCode: item.errorCode,
              result: undefined,
            })
          }
          const snapshot = inspected.result
          return {
            registered: true,
            flightTools,
            schema: snapshot.schema,
            active: snapshot.flightSim.active,
            phase: snapshot.flightSim.phase,
            rendererOwner: snapshot.runtime.rendererOwner,
            sceneOwner: snapshot.runtime.sceneOwner,
            simulationOwner: snapshot.runtime.simulationOwner,
            runtimeNetworkCalls: snapshot.runtime.runtimeNetworkCalls,
            runtimeModelCalls: snapshot.runtime.runtimeModelCalls,
            deadlineMs,
            calls: [{ ...inspected, result: undefined }, ...diagnostics],
            diagnostics,
          }
        }
        """
    )
    expected = {
        "registered": True,
        "flightTools": sorted(FLIGHT_TOOL_NAMES),
        "schema": "knowgrph-flight-sim-mcp/v1",
        "active": True,
        "phase": initial["phase"],
        "rendererOwner": "existing-r3f-canvas",
        "sceneOwner": "authored-xr-terrain",
        "simulationOwner": "native-agentic-ecs",
        "runtimeNetworkCalls": 0,
        "runtimeModelCalls": 0,
        "deadlineMs": FLIGHT_WEB_MCP_DEADLINE_MS,
    }
    if any(evidence.get(key) != value for key, value in expected.items()):
        raise AssertionError(
            f"strict Flight WebMCP was not ready: {evidence}"
        )
    expected_codes = {
        "missing-command": "FLIGHT_SIM_INVOCATION_MISSING_COMMAND",
        "duplicate-binding": "FLIGHT_SIM_INVOCATION_DUPLICATE_SIGIL",
        "unknown-key": "FLIGHT_SIM_INVOCATION_UNKNOWN_KEY",
        "mixed-input": "FLIGHT_SIM_CONTROL_MIXED_INPUT",
        "unsupported-operation":
            "FLIGHT_SIM_CONTROL_UNSUPPORTED_OPERATION",
    }
    for call in evidence.get("calls") or []:
        if (
            call.get("withinDeadline") is not True
            or call.get("elapsedMs", FLIGHT_WEB_MCP_DEADLINE_MS + 1)
            > FLIGHT_WEB_MCP_DEADLINE_MS
        ):
            raise AssertionError(
                f"Flight WebMCP exceeded its deadline: {call}"
            )
    for diagnostic in evidence.get("diagnostics") or []:
        expected_code = expected_codes.get(diagnostic.get("operation"))
        if (
            diagnostic.get("ok") is not False
            or diagnostic.get("stateUnchanged") is not True
            or diagnostic.get("errorCode") != expected_code
            or not diagnostic.get("message")
        ):
            raise AssertionError(
                f"Flight invocation diagnostic was not strict: {diagnostic}"
            )
    return evidence


def verify_flight_exit(
    page: Page,
    calls: list[dict[str, Any]],
) -> tuple[dict[str, Any], dict[str, Any], dict[str, Any]]:
    exit_result = control_flight_via_web_mcp(
        page,
        "/flight.sim @canvas #flight operation=exit",
        calls,
    )
    inactive_inspection = page.evaluate(
        """
        async () => {
          const tools = Array.from(navigator.modelContext?.tools || [])
          const inspect = tools.find(
            tool => tool.name === 'knowgrph.inspect_local_flight_sim',
          )
          if (!inspect) {
            return {
              result: { ok: false, missingTool: true },
              elapsedMs: 0,
            }
          }
          const startedAtMs = performance.now()
          const result = await inspect.execute()
          return {
            result,
            elapsedMs: performance.now() - startedAtMs,
          }
        }
        """
    )
    inactive_metric = {
        "tool": "knowgrph.inspect_local_flight_sim",
        "operation": "inspect-inactive",
        "elapsedMs": inactive_inspection["elapsedMs"],
        "deadlineMs": FLIGHT_WEB_MCP_DEADLINE_MS,
        "withinDeadline":
            inactive_inspection["elapsedMs"] <= FLIGHT_WEB_MCP_DEADLINE_MS,
        "ok": inactive_inspection["result"].get("ok") is True,
        "errorCode": inactive_inspection["result"].get("errorCode"),
    }
    calls.append(inactive_metric)
    post_exit = page.evaluate(
        """
        async () => {
          const runtime = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const physics = await import(
            '/src/features/three/xrPhysicsRuntime.ts'
          )
          const store = await import('/src/hooks/useGraphStore.ts')
          const state = store.useGraphStore.getState()
          return {
            flight: runtime.readFlightSimSnapshot(),
            canvasCount: document.querySelectorAll('canvas').length,
            canvasRenderMode: state.canvasRenderMode,
            canvas3dMode: state.canvas3dMode,
            floatingPanelOpen: state.floatingPanelOpen,
            floatingPanelView: state.floatingPanelView,
            timelinePlaying: state.timelineTransportPlaying === true,
            physicsPhase: physics.readXrPhysicsRuntime().phase,
          }
        }
        """
    )
    if (
        exit_result.get("ok") is not True
        or inactive_metric["withinDeadline"] is not True
        or inactive_metric["errorCode"] != "FLIGHT_SIM_STATE_UNAVAILABLE"
        or post_exit["flight"]["active"] is not False
        or post_exit["flight"]["phase"] != "stopped"
        or post_exit["flight"]["runId"] != 0
        or post_exit["flight"]["tick"] != 0
        or post_exit["flight"]["pendingDecisions"]
        or post_exit["canvasCount"] != 1
    ):
        raise AssertionError(
            "Flight Exit did not discard local state and retain one Canvas: "
            f"exit={exit_result}, inactive={inactive_inspection}, "
            f"post={post_exit}"
        )
    return exit_result, inactive_inspection, post_exit
