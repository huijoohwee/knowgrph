import json
import os
import tempfile
import unittest

from .superagent_harness import (
    HarnessError,
    RICH_MEDIA_SURFACE_ROUTE,
    RunBudget,
    ToolRegistry,
    build_default_tool_registry,
    read_trace_events,
    run_harness,
)


GOAL_TEXT = """
# Goal

Build a universal super-agent harness for rich media canvas generation.

- Keep tests neutral and independent of a specific demo document.
- Produce text, image, video, canvas, trace, and report artifacts.
- Stop only when deterministic validation passes or a blocker is recorded.
"""


NEUTRAL_BRIEF = """---
title: "Portable Product Walkthrough"
inputs:
  script: |
    Intake — A person submits a short brief with constraints.
    Build — The system creates a reference frame and motion plan.
    Review — The result is checked and exported with provenance.
---

# Portable Product Walkthrough

This neutral fixture exercises the harness without relying on a branded story.
"""


class SuperAgentHarnessTests(unittest.TestCase):
    def write_brief(self, tmp: str, text: str = NEUTRAL_BRIEF) -> str:
        path = os.path.join(tmp, "brief.md")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
        return path

    def test_tool_registry_validates_required_inputs(self) -> None:
        registry = ToolRegistry()
        # Reuse the default registry through a tiny fake object because the builder does not depend on harness state.
        registry = build_default_tool_registry(object())  # type: ignore[arg-type]
        with self.assertRaises(HarnessError):
            registry.call("text.generate.mock", {"inspection": {}})

    def test_neutral_e2e_run_produces_trace_canvas_and_report(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            out = os.path.join(tmp, "run")
            state = run_harness(
                input_path=brief,
                output_dir=out,
                goal_text=GOAL_TEXT,
                run_id="neutral-e2e",
                budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
            )
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            self.assertTrue(os.path.exists(os.path.join(out, "trace.jsonl")))
            self.assertTrue(os.path.exists(os.path.join(out, "final-report.md")))
            proof_path = os.path.join(out, "harness-proof.json")
            self.assertTrue(os.path.exists(proof_path))
            with open(proof_path, "r", encoding="utf-8") as handle:
                proof = json.load(handle)
            self.assertEqual(proof["schema_version"], "knowgrph.superagent.proof.v1")
            self.assertEqual(proof["harness_contract"]["codex_integration"]["mcp_tool"], "knowgrph.superagent.run")
            self.assertEqual(proof["harness_contract"]["codex_integration"]["surface_route"], RICH_MEDIA_SURFACE_ROUTE)
            self.assertTrue(proof["evidence"]["verification"]["passed"])
            self.assertGreaterEqual(proof["evidence"]["trace_event_counts"]["tool.call"], 1)
            self.assertIn("synthesize_report", proof["evidence"]["completed_task_ids"])
            proof_artifacts = {artifact["artifact_id"] for artifact in proof["evidence"]["artifacts"]}
            self.assertIn("harness_proof_manifest", proof_artifacts)
            canvas_path = os.path.join(out, "artifacts", "canvas", "canvas.graph.json")
            self.assertTrue(os.path.exists(canvas_path))
            with open(canvas_path, "r", encoding="utf-8") as handle:
                graph = json.load(handle)
            self.assertEqual(
                graph["metadata"]["surfaceRoute"],
                "MainPanel Integrations -> FloatingPanel Chat UI -> Editor Workspace -> Canvas -> Balanced 16:9 (1920x1080) Layout for Widgets (Text, Image, Video) AND Rich Media Panel AND Edges",
            )
            self.assertEqual(graph["metadata"]["layout"]["frame"]["width"], 1920)
            self.assertEqual(graph["metadata"]["layout"]["frame"]["height"], 1080)
            node_types = {node["type"] for node in graph["nodes"]}
            self.assertIn("TextGeneration", node_types)
            self.assertIn("ImageGeneration", node_types)
            self.assertIn("VideoGeneration", node_types)
            self.assertIn("RichMediaPanel", node_types)
            node_by_id = {node["id"]: node for node in graph["nodes"]}
            required_layout = ["text-plan", "image-reference", "video-storyboard", "rich-media-panel"]
            for node_id in required_layout:
                node = node_by_id[node_id]
                props = node["properties"]
                self.assertGreaterEqual(node["x"], 0)
                self.assertGreaterEqual(node["y"], 0)
                self.assertLessEqual(node["x"] + props["visual:width"], 1920)
                self.assertLessEqual(node["y"] + props["visual:height"], 1080)
                self.assertEqual(props["layoutFrame"], "balanced-16x9")
            panel_edges = {
                edge.get("targetHandle")
                for edge in graph["edges"]
                if edge.get("target") == "rich-media-panel"
            }
            self.assertTrue({"output", "imageUrl", "videoUrl"}.issubset(panel_edges))
            for edge in graph["edges"]:
                if edge["id"] in {"e-text-panel", "e-image-panel", "e-video-panel"}:
                    self.assertEqual(edge["properties"]["layoutRoute"]["frame"], "balanced-16x9")
                    self.assertEqual(edge["properties"]["layoutRoute"]["strategy"], "fan-in-readable")
            workspace_path = os.path.join(out, "artifacts", "workspace", "rich-media-flow.md")
            self.assertTrue(os.path.exists(workspace_path))
            with open(workspace_path, "r", encoding="utf-8") as handle:
                workspace_text = handle.read()
            self.assertIn('kgCanvas2dRenderer: "flowEditor"', workspace_text)
            self.assertIn("kgSuperAgentLayout:", workspace_text)
            self.assertIn("width: 1920", workspace_text)
            self.assertIn("height: 1080", workspace_text)
            self.assertIn("frontmatterFlowSettings:", workspace_text)
            self.assertIn("balancedViewportPreset: widgetFrontmatter", workspace_text)
            self.assertIn("layoutRoute: \"balanced-16x9:fan-in-readable\"", workspace_text)
            self.assertIn("TextGeneration", workspace_text)
            self.assertIn("ImageGeneration", workspace_text)
            self.assertIn("VideoGeneration", workspace_text)
            self.assertIn("RichMediaPanel", workspace_text)
            self.assertIn("flow:widgetFormId", workspace_text)
            self.assertIn("richMediaPanel", workspace_text)
            check_ids = {check["id"] for check in state["verification"]["checks"]}
            self.assertIn("canvas:has_rich_media_panel", check_ids)
            self.assertIn("workspace:frontmatter_flow_rich_media_panel", check_ids)
            self.assertIn("surface:route", check_ids)
            self.assertIn("layout:balanced_16x9_widgets", check_ids)
            self.assertIn("layout:balanced_16x9_edges", check_ids)
            trace_events = {event["event"] for event in read_trace_events(os.path.join(out, "trace.jsonl"))}
            self.assertIn("task.dispatch", trace_events)
            self.assertIn("tool.call", trace_events)
            self.assertIn("run.terminate", trace_events)

    def test_resume_continues_from_checkpoint(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            out = os.path.join(tmp, "resume-run")
            first = run_harness(
                input_path=brief,
                output_dir=out,
                goal_text=GOAL_TEXT,
                run_id="resume-e2e",
                budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                stop_after_step=2,
            )
            self.assertEqual(first["run"]["status"], "interrupted")
            resumed = run_harness(
                input_path=None,
                output_dir=out,
                goal_text=GOAL_TEXT,
                run_id="resume-e2e",
                budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                resume=True,
            )
            self.assertEqual(resumed["run"]["status"], "completed")
            self.assertTrue(resumed["verification"]["passed"])

    def test_retry_recovery_is_bounded_and_recorded(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            out = os.path.join(tmp, "retry-run")
            state = run_harness(
                input_path=brief,
                output_dir=out,
                goal_text=GOAL_TEXT,
                run_id="retry-e2e",
                budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                fail_once_tools=["video.generate.mock"],
            )
            self.assertEqual(state["run"]["status"], "completed")
            recovery_events = state["memory"]["recovery_events"]
            self.assertEqual(len(recovery_events), 1)
            self.assertEqual(recovery_events[0]["tool_name"], "video.generate.mock")
            trace_events = [event["event"] for event in read_trace_events(os.path.join(out, "trace.jsonl"))]
            self.assertIn("recovery.retry", trace_events)

    def test_generated_state_is_not_fixture_story_locked(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            out = os.path.join(tmp, "neutrality-run")
            state = run_harness(
                input_path=brief,
                output_dir=out,
                goal_text=GOAL_TEXT,
                run_id="neutrality-e2e",
                budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
            )
            serialized = json.dumps(state, ensure_ascii=False).lower()
            self.assertNotIn("robodrone", serialized)
            self.assertNotIn("knowgrph-video-demo.md", serialized)


if __name__ == "__main__":
    unittest.main()
