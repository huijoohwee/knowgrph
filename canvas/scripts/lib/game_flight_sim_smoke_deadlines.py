from __future__ import annotations

import time
from typing import Any

from playwright.sync_api import Page


def _read_deadlines(page: Page) -> dict[str, Any]:
    return page.evaluate(
        """
        async () => {
          const deadlines = await import(
            '/src/features/game-flight-sim/flightSimDeadlineRuntime.ts'
          )
          return deadlines.readFlightSimDeadlineSnapshot()
        }
        """
    )


def _wait_for_initial_deadlines(page: Page) -> dict[str, Any]:
    deadline = time.monotonic() + 2
    observed: dict[str, Any] = {}
    while time.monotonic() < deadline:
        observed = _read_deadlines(page)
        if observed.get("webglAdmission") and observed.get("readyFrame"):
            return observed
        page.wait_for_timeout(16)
    raise AssertionError(
        f"Flight initial deadline observations were unavailable: {observed}"
    )


def verify_flight_deadline_contracts(page: Page) -> dict[str, Any]:
    initial = _wait_for_initial_deadlines(page)
    webgl = initial["webglAdmission"]
    ready = initial["readyFrame"]
    if (
        webgl.get("source") != "browser-webgl-probe"
        or webgl.get("synchronous") is not True
        or webgl.get("available") is not True
        or webgl.get("withinLimit") is not True
        or float(webgl.get("elapsedMs", float("inf")))
        > float(webgl.get("limitMs", 100))
        or float(webgl.get("limitMs", 0)) != 100
    ):
        raise AssertionError(
            f"Flight WebGL admission was not synchronous within 100 ms: {webgl}"
        )
    if (
        ready.get("source") != "shared-r3f-ready-frame"
        or ready.get("synchronous") is not False
        or ready.get("withinLimit") is not True
        or ready.get("tick") != 0
        or float(ready.get("elapsedMs", float("inf")))
        > float(ready.get("limitMs", 100))
        or float(ready.get("limitMs", 0)) != 100
    ):
        raise AssertionError(
            f"Flight ready frame was not presented within 100 ms: {ready}"
        )

    interaction = page.evaluate(
        """
        async () => {
          const runtime = await import(
            '/src/features/game-flight-sim/flightSimRuntime.ts'
          )
          const deadlines = await import(
            '/src/features/game-flight-sim/flightSimDeadlineRuntime.ts'
          )
          const hud = document.querySelector('[data-kg-flight-sim-hud="1"]')
          if (!(hud instanceof HTMLElement)) {
            throw new Error('Flight HUD is unavailable for deadline proof')
          }
          const missionState = snapshot => {
            const { revision, runtimeError, ...state } = snapshot
            return state
          }
          const beforeNetwork = runtime.readFlightSimSnapshot()
          let networkExecutorInvoked = false
          const blocked = runtime.rejectFlightSimGameplayNetworkAttempt(
            'fetch:browser-deadline-proof',
            () => {
              networkExecutorInvoked = true
            },
          )
          const afterNetwork = runtime.readFlightSimSnapshot()
          const network = deadlines
            .readFlightSimDeadlineSnapshot()
            .gameplayNetworkBlock
          if (
            networkExecutorInvoked
            || JSON.stringify(missionState(beforeNetwork))
              !== JSON.stringify(missionState(afterNetwork))
            || blocked.runtimeError
              !== 'Flight Sim blocked gameplay network operation: fetch:browser-deadline-proof'
          ) {
            throw new Error('Flight network rejection changed mission state')
          }

          const restarted = runtime.restartFlightSim()
          const waitForHud = (accepted, limitMs) => new Promise(
            (resolve, reject) => {
              const startedAtMs = performance.now()
              let finished = false
              const observer = new MutationObserver(() => {
                if (finished || !accepted()) return
                finished = true
                observer.disconnect()
                clearTimeout(timeout)
                resolve(performance.now() - startedAtMs)
              })
              const timeout = setTimeout(() => {
                if (finished) return
                finished = true
                observer.disconnect()
                reject(new Error(`HUD did not update within ${limitMs} ms`))
              }, limitMs)
              observer.observe(hud, {
                attributes: true,
                attributeFilter: [
                  'data-kg-flight-sim-revision',
                  'data-kg-flight-sim-phase',
                ],
              })
              queueMicrotask(() => {
                if (finished || !accepted()) return
                finished = true
                observer.disconnect()
                clearTimeout(timeout)
                resolve(performance.now() - startedAtMs)
              })
            },
          )
          let expectedRevision = -1
          const rendered = waitForHud(() => (
            Number(hud.dataset.kgFlightSimRevision) === expectedRevision
            && hud.dataset.kgFlightSimPhase === 'stopped'
          ), deadlines.FLIGHT_SIM_HUD_UPDATE_LIMIT_MS)
          const commanded = runtime.stopFlightSim()
          expectedRevision = commanded.revision
          const browserElapsedMs = await rendered
          const hudUpdate = deadlines
            .readFlightSimDeadlineSnapshot()
            .hudUpdate
          const restored = runtime.restartFlightSim()
          return {
            webgl: deadlines.readFlightSimDeadlineSnapshot().webglAdmission,
            ready: deadlines.readFlightSimDeadlineSnapshot().readyFrame,
            network,
            networkExecutorInvoked,
            networkMissionStateRetained:
              JSON.stringify(missionState(beforeNetwork))
              === JSON.stringify(missionState(afterNetwork)),
            hud: {
              ...hudUpdate,
              browserElapsedMs,
              expectedRevision,
              renderedPhase: 'stopped',
            },
            restored: {
              phase: restored.phase,
              tick: restored.tick,
              waypointIndex: restored.waypointIndex,
              runtimeError: restored.runtimeError,
            },
          }
        }
        """
    )
    network = interaction["network"]
    hud = interaction["hud"]
    restored = interaction["restored"]
    if (
        network.get("source") != "flight-runtime-network-guard"
        or network.get("synchronous") is not True
        or network.get("operation") != "fetch:browser-deadline-proof"
        or network.get("withinLimit") is not True
        or float(network.get("elapsedMs", float("inf")))
        > float(network.get("limitMs", 1_000))
        or float(network.get("limitMs", 0)) != 1_000
        or interaction.get("networkExecutorInvoked") is not False
        or interaction.get("networkMissionStateRetained") is not True
    ):
        raise AssertionError(
            f"Flight gameplay network attempt was not blocked within 1 s: {interaction}"
        )
    if (
        hud.get("source") != "runtime-publish-to-hud-layout"
        or hud.get("synchronous") is not False
        or hud.get("withinLimit") is not True
        or float(hud.get("elapsedMs", float("inf")))
        > float(hud.get("limitMs", 100))
        or float(hud.get("browserElapsedMs", float("inf"))) > 100
        or float(hud.get("limitMs", 0)) != 100
        or hud.get("revision") != hud.get("expectedRevision")
    ):
        raise AssertionError(
            f"Flight HUD did not reflect its runtime update within 100 ms: {hud}"
        )
    if (
        restored.get("phase") != "ready"
        or restored.get("tick") != 0
        or restored.get("waypointIndex") != 0
        or restored.get("runtimeError") is not None
    ):
        raise AssertionError(
            f"Flight deadline proof did not restore a fresh mission: {restored}"
        )
    return {
        "webglAdmission": webgl,
        "readyFrame": ready,
        "gameplayNetworkBlock": network,
        "hudUpdate": hud,
        "restoredFreshMission": True,
    }
