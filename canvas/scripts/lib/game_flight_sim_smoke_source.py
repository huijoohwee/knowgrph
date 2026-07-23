from __future__ import annotations

import time
from pathlib import Path
from typing import Any, Callable

from playwright.sync_api import Page


SOURCE_BASENAME = "knowgrph-game-flight-sim-demo.md"
SOURCE_DEMO_ID = "flight-sim"
EXPECTED_SOURCE_NODE_IDS = {
    "flight_aircraft",
    "flight_asset_spec",
    "flight_demo_entry",
    "flight_runtime_gate",
}


def _poll(
    page: Page,
    read: Callable[[], dict[str, Any]],
    accepted: Callable[[dict[str, Any]], bool],
    *,
    label: str,
    timeout_ms: int = 120_000,
) -> dict[str, Any]:
    deadline = time.monotonic() + timeout_ms / 1000
    last_value: dict[str, Any] = {}
    while time.monotonic() < deadline:
        last_value = read()
        if accepted(last_value):
            return last_value
        page.wait_for_timeout(100)
    raise AssertionError(f"timed out waiting for {label}: {last_value}")


def _read_source_identity(
    page: Page,
    expected_source_text: str,
) -> dict[str, Any]:
    return page.evaluate(
        """
        async expectedSourceText => {
          const store = await import('/src/hooks/useGraphStore.ts')
          const demos = await import(
            '/src/features/workspace-fs/workspaceRunReadyDemos.ts'
          )
          const workspaceModule = await import(
            '/src/features/workspace-fs/workspaceFs.ts'
          )
          const state = store.useGraphStore.getState()
          const workspace = await workspaceModule.getWorkspaceFs()
          const sourcePath = `/${demos.FLIGHT_SIM_DEMO_REPO_REL_PATH}`
          const sourceText = await workspace.readFileText(sourcePath)
          const authoredSeeds = await workspaceModule.getWorkspaceSeedFiles()
          const authoredSeed = authoredSeeds.find(
            seed => seed.path
              === workspaceModule.TEST_VALIDATION_WORKSPACE_SEED_PATH,
          )
          const graphMetadata = state.graphData?.metadata
            && typeof state.graphData.metadata === 'object'
            ? state.graphData.metadata
            : {}
          const graphNodeIds = Array.isArray(state.graphData?.nodes)
            ? state.graphData.nodes.map(node => String(node?.id || '')).sort()
            : []
          return {
            documentName: state.markdownDocumentName,
            sourcePath,
            authoredSeedPath: authoredSeed?.path || null,
            authoredSeedFallback: authoredSeed?.isFallback ?? null,
            authoredSeedHead: String(authoredSeed?.text || '').slice(0, 120),
            demoId: demos.resolveWorkspaceRunReadyDemoIdForDocument(
              state.markdownDocumentName,
              state.markdownDocumentText,
            ),
            active: demos.isFlightSimRunReadyDemoActive(
              state.markdownDocumentName,
              state.markdownDocumentText,
            ),
            sourceDeclaration: String(authoredSeed?.text || '')
              .includes('id: "flight-sim"'),
            workspaceSourceMaterialized: typeof sourceText === 'string'
              && sourceText.length > 0,
            workspaceSourceByteIdentical:
              sourceText === expectedSourceText,
            graphDocumentName:
              String(graphMetadata.markdownDocumentName || ''),
            graphNodeIds,
            graphOwnedByDocument: String(graphMetadata.source || '')
              === `markdown:${String(state.markdownDocumentName || '')}`,
            renderMode: state.canvasRenderMode,
            canvas3dMode: state.canvas3dMode,
          }
        }
        """,
        expected_source_text,
    )


def _apply_exact_authored_source(
    page: Page,
    expected_source_text: str,
) -> dict[str, Any]:
    bootstrap = _poll(
        page,
        lambda: page.evaluate(
            """
            async () => {
              const readiness = await import(
                '/src/features/source-files/sourceFilesBootstrapReadiness.ts'
              )
              const snapshot = readiness.readSourceFilesBootstrapSnapshot()
              return {
                phase: snapshot.phase,
                basePhase: snapshot.basePhase,
                error: snapshot.error ? String(snapshot.error) : null,
              }
            }
            """
        ),
        lambda value: value.get("phase") == "ready",
        label="Source Files bootstrap readiness",
    )
    result = _poll(
        page,
        lambda: page.evaluate(
            """
            async expectedSourceText => {
              const explorer = await import(
                '/src/features/markdown-explorer/store.ts'
              )
              const materialization = await import(
                '/src/features/source-files/sourceFilesRuntimeMaterialization.ts'
              )
              const store = await import('/src/hooks/useGraphStore.ts')
              const workspaceModule = await import(
                '/src/features/workspace-fs/workspaceFs.ts'
              )
              const demos = await import(
                '/src/features/workspace-fs/workspaceRunReadyDemos.ts'
              )
              const workspace = await workspaceModule.getWorkspaceFs()
              await workspace.ensureSeed()
              const sourcePath =
                `/${demos.FLIGHT_SIM_DEMO_REPO_REL_PATH}`
              const authoredSeeds =
                await workspaceModule.getWorkspaceSeedFiles()
              const authored = authoredSeeds.find(
                seed => seed.path
                  === workspaceModule.TEST_VALIDATION_WORKSPACE_SEED_PATH,
              )
              const sourceText = await workspace.readFileText(sourcePath)
              const hasSourceText = typeof sourceText === 'string'
                && sourceText.length > 0
              let applied = false
              if (hasSourceText) {
                explorer.useMarkdownExplorerStore.getState()
                  .setActivePath(sourcePath)
                applied = await materialization
                  .reapplyActiveWorkspaceMarkdownDocument({
                    activePathOverride: sourcePath,
                    fs: workspace,
                  })
              }
              const state = store.useGraphStore.getState()
              return {
                applied,
                activeTextByteIdentical: hasSourceText
                  && state.markdownDocumentText === sourceText,
                authoredFallback: authored?.isFallback ?? null,
                byteIdentical: hasSourceText
                  && sourceText === expectedSourceText,
                documentName: state.markdownDocumentName,
                sourcePath,
                sourceTextLength: String(sourceText || '').length,
              }
            }
            """,
            expected_source_text,
        ),
        lambda value: (
            value.get("activeTextByteIdentical") is True
            and value.get("authoredFallback") is False
            and value.get("byteIdentical") is True
            and str(value.get("documentName") or "").endswith(SOURCE_BASENAME)
            and str(value.get("sourcePath") or "").endswith(SOURCE_BASENAME)
            and value.get("sourceTextLength", 0) > 0
        ),
        label="production Source Files exact-seed apply",
    )
    return {"bootstrap": bootstrap, **result}


def apply_and_verify_exact_authored_source(
    page: Page,
) -> tuple[dict[str, Any], dict[str, Any]]:
    source_path = (
        Path(__file__).resolve().parents[3]
        / "docs"
        / "workspace-seeds"
        / SOURCE_BASENAME
    )
    expected_source_text = source_path.read_text(encoding="utf-8")
    if not expected_source_text:
        raise AssertionError(f"authored Flight seed is empty: {source_path}")

    application = _apply_exact_authored_source(page, expected_source_text)
    source = _poll(
        page,
        lambda: _read_source_identity(page, expected_source_text),
        lambda value: (
            str(value.get("documentName") or "").endswith(SOURCE_BASENAME)
            and str(value.get("sourcePath") or "").endswith(SOURCE_BASENAME)
            and value.get("demoId") == SOURCE_DEMO_ID
            and value.get("active") is True
            and value.get("sourceDeclaration") is True
            and value.get("workspaceSourceMaterialized") is True
            and value.get("workspaceSourceByteIdentical") is True
            and value.get("graphOwnedByDocument") is True
            and str(value.get("graphDocumentName") or "").endswith(
                SOURCE_BASENAME
            )
            and EXPECTED_SOURCE_NODE_IDS.issubset(
                set(value.get("graphNodeIds") or [])
            )
            and value.get("renderMode") == "3d"
            and value.get("canvas3dMode") == "xr"
        ),
        label="exact authored Flight seed materialization",
    )
    return application, source
