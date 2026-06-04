import json
import os
import sys
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
from .pixverse_smoke_cmd import main as pixverse_smoke_main
from .superagent_contracts import (
    BALANCED_WIDGET_LAYOUT,
    RICH_MEDIA_PANEL_EDGE_LANES,
    SUPERAGENT_TASK_CAPABILITIES,
    SUPERAGENT_TASK_LEVELS,
)
from .superagent_responsive import REQUIRED_RESPONSIVE_WIDGET_IDS, required_responsive_proof_class_ids


GOAL_TEXT = """
# Goal

Build a universal super-agent harness for research, code, and creation tasks with rich media canvas output.

- Keep tests neutral and independent of a specific demo document.
- Produce research, code, sandbox, text, image, video, canvas, trace, and report artifacts.
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

EXTENDED_PIXVERSE_BRIEF = """---
title: "Portable Product Walkthrough Extended"
inputs:
  script: |
    Intake - A person submits a short brief with constraints.
    Build - The system creates a reference frame and motion plan.
    Review - The result is checked and exported with provenance.
    Continue - The system extends the narrative with a next-step delivery beat.
---

# Portable Product Walkthrough Extended

This neutral fixture exercises PixVerse extension without relying on a branded story.
"""


class SuperAgentHarnessTests(unittest.TestCase):
    def write_brief(self, tmp: str, text: str = NEUTRAL_BRIEF) -> str:
        path = os.path.join(tmp, "brief.md")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(text)
        return path

    def write_dummy_video(self, tmp: str, name: str = "upload-video.mp4") -> str:
        path = os.path.join(tmp, name)
        with open(path, "wb") as handle:
            handle.write(b"\x00\x00\x00\x18ftypmp42\x00\x00\x00\x00mp42isom")
        return path

    def write_dummy_audio(self, tmp: str, name: str = "upload-audio.wav") -> str:
        path = os.path.join(tmp, name)
        with open(path, "wb") as handle:
            handle.write(b"RIFF\x24\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00")
        return path

    def write_fake_pixverse_server(self, tmp: str) -> str:
        path = os.path.join(tmp, "fake_pixverse_mcp.py")
        with open(path, "w", encoding="utf-8") as handle:
            handle.write(
                """import json
import sys

upload_count = 0
video_status_counts = {}

def read_message():
    headers = {}
    while True:
        line = sys.stdin.buffer.readline()
        if not line:
            return None
        if line in (b"\\r\\n", b"\\n"):
            break
        name, _, value = line.decode("utf-8").partition(":")
        headers[name.strip().lower()] = value.strip()
    length = int(headers.get("content-length", "0"))
    if length <= 0:
        return None
    body = sys.stdin.buffer.read(length)
    return json.loads(body.decode("utf-8"))

def write_message(message):
    payload = json.dumps(message).encode("utf-8")
    sys.stdout.buffer.write(f"Content-Length: {len(payload)}\\r\\n\\r\\n".encode("ascii") + payload)
    sys.stdout.buffer.flush()

while True:
    message = read_message()
    if message is None:
        break
    method = message.get("method")
    if method == "initialize":
        write_message({
            "jsonrpc": "2.0",
            "id": message.get("id"),
            "result": {
                "protocolVersion": "2025-06-18",
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "fake-pixverse", "version": "1.0.0"},
            },
        })
    elif method == "tools/call":
        name = (message.get("params") or {}).get("name")
        if name == "upload_image":
            upload_count += 1
            write_message({
                "jsonrpc": "2.0",
                "id": message.get("id"),
                "result": {
                    "structuredContent": {
                        "success": True,
                        "img_id": 1000 + upload_count,
                        "img_url": f"https://example.com/upload-{upload_count}.png",
                    },
                    "content": [],
                    "isError": False,
                },
            })
        elif name == "upload_video":
            upload_count += 1
            write_message({
                "jsonrpc": "2.0",
                "id": message.get("id"),
                "result": {
                    "structuredContent": {
                        "success": True,
                        "video_media_id": 7000 + upload_count,
                        "media_url": f"https://example.com/upload-video-{upload_count}.mp4",
                    },
                    "content": [],
                    "isError": False,
                },
            })
        elif name in ("upload_audio", "upload_media"):
            arguments = (message.get("params") or {}).get("arguments") or {}
            media_type = arguments.get("media_type") or ("audio" if name == "upload_audio" else "video")
            upload_count += 1
            write_message({
                "jsonrpc": "2.0",
                "id": message.get("id"),
                "result": {
                    "structuredContent": {
                        "success": True,
                        "audio_media_id": 8000 + upload_count if media_type == "audio" else None,
                        "video_media_id": 7000 + upload_count if media_type != "audio" else None,
                        "media_id": 8000 + upload_count if media_type == "audio" else 7000 + upload_count,
                        "media_url": f"https://example.com/upload-{media_type}-{upload_count}",
                    },
                    "content": [],
                    "isError": False,
                },
            })
        elif name in ("text_to_video", "image_to_video", "transition_video", "extend_video", "sound_effect_video", "lip_sync_video", "fusion_video"):
            generation_mode = name
            video_id = (
                8383 if generation_mode == "fusion_video"
                else (7272 if generation_mode == "lip_sync_video"
                else (6262 if generation_mode == "sound_effect_video" else (5252 if generation_mode == "extend_video" else 4242)))
            )
            write_message({
                "jsonrpc": "2.0",
                "id": message.get("id"),
                "result": {
                    "structuredContent": {
                        "success": True,
                        "video_id": video_id,
                        "status": "submitted",
                        "generation_mode": generation_mode,
                        "polling_config": {"interval_seconds": 0, "max_attempts": 3},
                    },
                    "content": [],
                    "isError": False,
                },
            })
        elif name == "get_video_status":
            video_id = (((message.get("params") or {}).get("arguments") or {}).get("video_id"))
            key = str(video_id)
            video_status_counts[key] = int(video_status_counts.get(key, 0)) + 1
            status = "completed" if video_status_counts[key] >= 2 else "in_progress"
            generation_mode = {
                "4242": "transition_video",
                "5252": "extend_video",
                "6262": "sound_effect_video",
                "7272": "lip_sync_video",
                "8383": "fusion_video",
            }.get(key, "transition_video")
            video_url = (
                "https://example.com/pixverse-video-fusion.mp4" if key == "8383" and status == "completed"
                else (
                "https://example.com/pixverse-video-lipsync.mp4" if key == "7272" and status == "completed"
                else (
                    "https://example.com/pixverse-video-sfx.mp4" if key == "6262" and status == "completed"
                    else ("https://example.com/pixverse-video.mp4" if status == "completed" else None)
                )
                )
            )
            write_message({
                "jsonrpc": "2.0",
                "id": message.get("id"),
                "result": {
                    "structuredContent": {
                        "success": True,
                        "video_id": video_id,
                        "status": status,
                        "generation_mode": generation_mode,
                        "video_url": video_url,
                    },
                    "content": [],
                    "isError": False,
                },
            })
        else:
            write_message({
                "jsonrpc": "2.0",
                "id": message.get("id"),
                "error": {"code": -32601, "message": f"Unknown tool: {name}"},
            })
    elif method == "notifications/initialized":
        continue
"""
            )
        return path

    def test_external_xr_validation_document_is_runtime_input_only(self) -> None:
        repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
        external_name = "-".join(["knowgrph", "xr", "demo"]) + ".md"
        external_abs_path = os.path.join(
            os.path.sep,
            "Users",
            "huijoohwee",
            "Documents",
            "GitHub",
            "huijoohwee",
            "docs",
            external_name,
        )
        forbidden_tokens = {
            external_name,
            external_abs_path,
            external_abs_path.replace(os.path.sep, "/"),
        }
        skipped_dir_names = {
            ".git",
            ".mypy_cache",
            ".pytest_cache",
            ".venv",
            "__pycache__",
            "build",
            "coverage",
            "dist",
            "node_modules",
        }
        skipped_rel_prefixes = (
            "canvas/build",
            "canvas/dist",
            "canvas/node_modules",
            "data/outputs",
            "data/superagent-runs",
        )
        offenders: list[str] = []

        for root, dirs, files in os.walk(repo_root):
            rel_root = os.path.relpath(root, repo_root)
            rel_root = "" if rel_root == "." else rel_root.replace(os.path.sep, "/")
            dirs[:] = [
                name for name in dirs
                if name not in skipped_dir_names and not os.path.islink(os.path.join(root, name))
            ]
            if rel_root and any(rel_root == prefix or rel_root.startswith(f"{prefix}/") for prefix in skipped_rel_prefixes):
                dirs[:] = []
                continue
            for name in files:
                path = os.path.join(root, name)
                if os.path.islink(path):
                    continue
                try:
                    if os.path.getsize(path) > 2_000_000:
                        continue
                    with open(path, "r", encoding="utf-8") as handle:
                        text = handle.read()
                except (OSError, UnicodeDecodeError):
                    continue
                if any(token in text for token in forbidden_tokens):
                    offenders.append(os.path.relpath(path, repo_root).replace(os.path.sep, "/"))

        self.assertEqual([], sorted(offenders))

    def test_tool_registry_validates_required_inputs(self) -> None:
        registry = ToolRegistry()
        # Reuse the default registry through a tiny fake object because the builder does not depend on harness state.
        registry = build_default_tool_registry(object())  # type: ignore[arg-type]
        tool_by_name = {tool["name"]: tool for tool in registry.describe()}
        self.assertIn("skill.select", tool_by_name)
        self.assertIn("tool_inventory", tool_by_name["skill.select"]["required"])
        self.assertIn("research_result", tool_by_name["text.generate.mock"]["required"])
        self.assertIn("code_result", tool_by_name["text.generate.mock"]["required"])
        self.assertIn("skill_result", tool_by_name["text.generate.mock"]["required"])
        self.assertIn("research_result", tool_by_name["canvas.write"]["required"])
        self.assertIn("code_result", tool_by_name["canvas.write"]["required"])
        self.assertIn("skill_result", tool_by_name["canvas.write"]["required"])
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
            self.assertEqual(
                state["memory"]["observations"]["inspect_goal"]["tool_count"],
                len(state["tool_registry"]),
            )
            self.assertTrue(os.path.exists(os.path.join(out, "trace.jsonl")))
            self.assertTrue(os.path.exists(os.path.join(out, "final-report.md")))
            proof_path = os.path.join(out, "harness-proof.json")
            self.assertTrue(os.path.exists(proof_path))
            with open(proof_path, "r", encoding="utf-8") as handle:
                proof = json.load(handle)
            self.assertEqual(proof["schema_version"], "knowgrph.superagent.proof.v1")
            self.assertEqual(proof["harness_contract"]["codex_integration"]["mcp_tool"], "knowgrph.superagent.run")
            self.assertEqual(proof["harness_contract"]["codex_integration"]["surface_route"], RICH_MEDIA_SURFACE_ROUTE)
            self.assertEqual(proof["harness_contract"]["capabilities"]["task_capabilities"], SUPERAGENT_TASK_CAPABILITIES)
            self.assertEqual(proof["harness_contract"]["capabilities"]["task_levels"], SUPERAGENT_TASK_LEVELS)
            self.assertIn("skill.select", proof["harness_contract"]["capabilities"]["tools"])
            self.assertIn("research.scout", proof["harness_contract"]["capabilities"]["tools"])
            self.assertIn("code.write_and_run", proof["harness_contract"]["capabilities"]["tools"])
            self.assertIn("skill_curator", proof["harness_contract"]["capabilities"]["subagents"])
            self.assertIn("research_worker", proof["harness_contract"]["capabilities"]["subagents"])
            self.assertIn("code_worker", proof["harness_contract"]["capabilities"]["subagents"])
            self.assertTrue(proof["evidence"]["verification"]["passed"])
            self.assertGreaterEqual(proof["evidence"]["trace_event_counts"]["tool.call"], 1)
            self.assertIn("select_skills", proof["evidence"]["completed_task_ids"])
            self.assertIn("research_goal", proof["evidence"]["completed_task_ids"])
            self.assertIn("code_sandbox", proof["evidence"]["completed_task_ids"])
            self.assertIn("synthesize_report", proof["evidence"]["completed_task_ids"])
            self.assertTrue(proof["evidence"]["capability_evidence"]["skill"]["completed"])
            self.assertTrue(proof["evidence"]["capability_evidence"]["research"]["completed"])
            self.assertTrue(proof["evidence"]["capability_evidence"]["code"]["completed"])
            self.assertTrue(proof["evidence"]["capability_evidence"]["create"]["completed"])
            proof_artifacts = {artifact["artifact_id"] for artifact in proof["evidence"]["artifacts"]}
            self.assertIn("selected_skills_json", proof_artifacts)
            self.assertIn("research_pack_json", proof_artifacts)
            self.assertIn("code_generated_summary_py", proof_artifacts)
            self.assertIn("code_sandbox_result", proof_artifacts)
            self.assertIn("harness_proof_manifest", proof_artifacts)
            self.assertIn("responsive_verification", proof_artifacts)
            self.assertEqual(
                proof["harness_contract"]["responsive"]["proof_class_ids"],
                required_responsive_proof_class_ids(),
            )
            self.assertTrue(proof["evidence"]["responsive"]["passed"])
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
            responsive = graph["metadata"]["layout"]["responsive"]
            self.assertEqual(
                [proof_class["id"] for proof_class in responsive["proofClasses"]],
                required_responsive_proof_class_ids(),
            )
            for proof_class in responsive["proofClasses"]:
                self.assertTrue(proof_class["controls"]["safeAreaAware"])
                self.assertTrue(set(REQUIRED_RESPONSIVE_WIDGET_IDS).issubset(proof_class["widgets"]))
                self.assertTrue(set(["e-text-panel", "e-image-panel", "e-video-panel"]).issubset(proof_class["edgePolicy"]["reachableEdgeIds"]))
            node_types = {node["type"] for node in graph["nodes"]}
            self.assertIn("SkillSelector", node_types)
            self.assertIn("ResearchAgent", node_types)
            self.assertIn("CodeWorker", node_types)
            self.assertIn("TextGeneration", node_types)
            self.assertIn("ImageGeneration", node_types)
            self.assertIn("VideoGeneration", node_types)
            self.assertIn("RichMediaPanel", node_types)
            node_by_id = {node["id"]: node for node in graph["nodes"]}
            required_layout = ["text-plan", "image-reference", "video-storyboard", "rich-media-panel"]
            center_sum_x = 0.0
            center_sum_y = 0.0
            for node_id in required_layout:
                node = node_by_id[node_id]
                props = node["properties"]
                self.assertGreaterEqual(node["x"], 0)
                self.assertGreaterEqual(node["y"], 0)
                self.assertLessEqual(node["x"] + props["visual:width"], 1920)
                self.assertLessEqual(node["y"] + props["visual:height"], 1080)
                self.assertEqual(props["layoutFrame"], "balanced-16x9")
                self.assertEqual(props["visual:xIndex"], BALANCED_WIDGET_LAYOUT[node_id]["xIndex"])
                self.assertEqual(props["visual:yIndex"], BALANCED_WIDGET_LAYOUT[node_id]["yIndex"])
                self.assertEqual(props["visual:zIndex"], BALANCED_WIDGET_LAYOUT[node_id]["zIndex"])
                center_sum_x += node["x"] + props["visual:width"] / 2
                center_sum_y += node["y"] + props["visual:height"] / 2
            self.assertAlmostEqual(center_sum_x / len(required_layout), 960, delta=1)
            self.assertAlmostEqual(center_sum_y / len(required_layout), 540, delta=1)
            panel_edges = {
                edge.get("targetHandle")
                for edge in graph["edges"]
                if edge.get("target") == "rich-media-panel"
            }
            self.assertTrue({"output", "imageUrl", "videoUrl"}.issubset(panel_edges))
            edge_ids = {edge["id"] for edge in graph["edges"]}
            self.assertTrue({"e-brief-skill", "e-skill-research", "e-brief-research", "e-research-code", "e-code-text", "e-research-text"}.issubset(edge_ids))
            for edge in graph["edges"]:
                if edge["id"] in {"e-text-panel", "e-image-panel", "e-video-panel"}:
                    self.assertEqual(edge["properties"]["layoutRoute"]["frame"], "balanced-16x9")
                    self.assertEqual(edge["properties"]["layoutRoute"]["strategy"], "fan-in-readable")
                    self.assertEqual(edge["properties"]["layoutRoute"]["laneIndex"], RICH_MEDIA_PANEL_EDGE_LANES[edge["id"]])
                    self.assertTrue(edge["properties"]["layoutRoute"]["avoidWidgetContent"])
            workspace_path = os.path.join(out, "artifacts", "workspace", "rich-media-flow.md")
            self.assertTrue(os.path.exists(workspace_path))
            with open(workspace_path, "r", encoding="utf-8") as handle:
                workspace_text = handle.read()
            self.assertIn('kgCanvas2dRenderer: "flowEditor"', workspace_text)
            self.assertIn("kgSuperAgentLayout:", workspace_text)
            self.assertIn("kgSuperAgentCapabilities:", workspace_text)
            self.assertIn("kgSuperAgentTaskLevels:", workspace_text)
            self.assertIn("quick_triage", workspace_text)
            self.assertIn("parallel_build", workspace_text)
            self.assertIn("kgSuperAgentMessageGateway:", workspace_text)
            self.assertIn("kgSuperAgentSandbox:", workspace_text)
            self.assertIn("width: 1920", workspace_text)
            self.assertIn("height: 1080", workspace_text)
            self.assertIn("frontmatterFlowSettings:", workspace_text)
            self.assertIn("kgSuperAgentResponsive:", workspace_text)
            self.assertIn("strategy: mobile-first", workspace_text)
            self.assertIn("mobile-320x640", workspace_text)
            self.assertIn("tablet-768x1024", workspace_text)
            self.assertIn("wide-1920x1080", workspace_text)
            self.assertIn("balancedViewportPreset: widgetFrontmatter", workspace_text)
            self.assertIn("layoutRoute: \"balanced-16x9:fan-in-readable\"", workspace_text)
            self.assertIn("layoutLane: 0", workspace_text)
            self.assertIn("visual:xIndex", workspace_text)
            self.assertIn("visual:yIndex", workspace_text)
            self.assertIn("visual:zIndex", workspace_text)
            self.assertIn("TextGeneration", workspace_text)
            self.assertIn("SkillSelector", workspace_text)
            self.assertIn("ResearchAgent", workspace_text)
            self.assertIn("CodeWorker", workspace_text)
            self.assertIn("ImageGeneration", workspace_text)
            self.assertIn("VideoGeneration", workspace_text)
            self.assertIn("RichMediaPanel", workspace_text)
            self.assertIn("flow:widgetFormId", workspace_text)
            self.assertIn("richMediaPanel", workspace_text)
            check_ids = {check["id"] for check in state["verification"]["checks"]}
            self.assertIn("artifact:skill", check_ids)
            self.assertIn("canvas:has_rich_media_panel", check_ids)
            self.assertIn("canvas:has_skill_node", check_ids)
            self.assertIn("canvas:has_research_node", check_ids)
            self.assertIn("canvas:has_code_node", check_ids)
            self.assertIn("harness:research_code_create_capabilities", check_ids)
            self.assertIn("sandbox:generated_code_passed", check_ids)
            self.assertIn("workspace:frontmatter_flow_rich_media_panel", check_ids)
            self.assertIn("surface:route", check_ids)
            self.assertIn("layout:balanced_16x9_widgets", check_ids)
            self.assertIn("layout:balanced_16x9_edges", check_ids)
            self.assertIn("responsive:proof_classes", check_ids)
            self.assertIn("responsive:widget_reachability", check_ids)
            self.assertIn("responsive:edge_reachability", check_ids)
            self.assertIn("responsive:touch_controls", check_ids)
            self.assertIn("responsive:workspace_metadata", check_ids)
            responsive_proof_path = os.path.join(out, "artifacts", "responsive", "responsive-proof.json")
            self.assertTrue(os.path.exists(responsive_proof_path))
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
            self.assertNotIn("-".join(["knowgrph", "video", "demo"]) + ".md", serialized)
            self.assertNotIn("-".join(["knowgrph", "xr", "demo"]) + ".md", serialized)

    def test_pixverse_provider_mode_falls_back_to_mock_without_api_key(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            out = os.path.join(tmp, "pixverse-fallback")
            original_api_key = os.environ.pop("PIXVERSE_API_KEY", None)
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-fallback",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                if original_api_key is not None:
                    os.environ["PIXVERSE_API_KEY"] = original_api_key
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            canvas_path = os.path.join(out, "artifacts", "canvas", "canvas.graph.json")
            with open(canvas_path, "r", encoding="utf-8") as handle:
                graph = json.load(handle)
            self.assertEqual(graph["metadata"]["providerModeRequested"], "pixverse")
            self.assertEqual(graph["metadata"]["providerMode"], "mock")
            video_node = next(node for node in graph["nodes"] if node["id"] == "video-storyboard")
            self.assertEqual(video_node["properties"]["providerModeResolved"], "mock")
            self.assertEqual(video_node["properties"]["providerStatus"], "fallback")

    def test_pixverse_provider_mode_uses_stdio_mcp_when_configured(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-live")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-live",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            self.assertTrue(os.path.exists(manifest_path))
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["provider_mode_resolved"], "pixverse")
            self.assertEqual(manifest["video_url"], "https://example.com/pixverse-video.mp4")
            self.assertEqual(manifest["generation_mode"], "transition_video")
            canvas_path = os.path.join(out, "artifacts", "canvas", "canvas.graph.json")
            with open(canvas_path, "r", encoding="utf-8") as handle:
                graph = json.load(handle)
            self.assertEqual(graph["metadata"]["providerModeRequested"], "pixverse")
            self.assertEqual(graph["metadata"]["providerMode"], "pixverse")
            video_node = next(node for node in graph["nodes"] if node["id"] == "video-storyboard")
            self.assertEqual(video_node["properties"]["provider"], "pixverse-mcp")
            self.assertEqual(video_node["properties"]["providerModeResolved"], "pixverse")
            self.assertEqual(video_node["properties"]["videoUrl"], "https://example.com/pixverse-video.mp4")

    def test_pixverse_smoke_command_requires_live_provider_by_default(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-smoke")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", out,
                    "--strategy", "transition-video",
                    "--print-summary",
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 0)

    def test_pixverse_smoke_command_enables_fusion_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-smoke-fusion")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", out,
                    "--strategy", "fusion-video",
                    "--print-summary",
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 0)

    def test_pixverse_provider_mode_uses_fusion_video_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-fusion")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
                "KG_PIXVERSE_STRATEGY": os.environ.get("KG_PIXVERSE_STRATEGY"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            os.environ["KG_PIXVERSE_STRATEGY"] = "fusion-video"
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-fusion",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["provider_mode_resolved"], "pixverse")
            self.assertEqual(manifest["base_generation_mode"], "fusion_video")
            self.assertEqual(manifest["generation_mode"], "fusion_video")
            self.assertEqual(manifest["request"]["model"], "v4.5")
            self.assertEqual(manifest["video_url"], "https://example.com/pixverse-video-fusion.mp4")
            self.assertEqual(len(manifest["request"]["fusion_references"]), 3)
            fusion_uploads = manifest["uploads"]["fusion_references"]
            self.assertEqual(len(fusion_uploads), 3)
            self.assertEqual([item["ref_name"] for item in fusion_uploads], ["hero", "world", "support"])

    def test_pixverse_smoke_command_enables_lip_sync_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-smoke-lipsync")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", out,
                    "--strategy", "transition-video",
                    "--lip-sync-speaker-id", "speaker_001",
                    "--lip-sync-text", "Welcome to our amazing video tutorial",
                    "--print-summary",
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 0)

    def test_pixverse_smoke_command_enables_custom_audio_lip_sync_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-smoke-lipsync-audio")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", out,
                    "--strategy", "transition-video",
                    "--lip-sync-audio-media-id", "44444",
                    "--print-summary",
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 0)

    def test_pixverse_smoke_command_enables_uploaded_video_lip_sync_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-smoke-lipsync-uploaded-video")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", out,
                    "--lip-sync-speaker-id", "speaker_001",
                    "--lip-sync-text", "Welcome to our uploaded video tutorial",
                    "--lip-sync-video-media-id", "77777",
                    "--print-summary",
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 0)

    def test_pixverse_smoke_command_uploads_local_media_for_uploaded_video_custom_audio_lip_sync(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            video_path = self.write_dummy_video(tmp, "local-lipsync-video.mp4")
            audio_path = self.write_dummy_audio(tmp, "local-lipsync-audio.wav")
            out = os.path.join(tmp, "pixverse-smoke-lipsync-uploaded-media")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", out,
                    "--lip-sync-video-file", video_path,
                    "--lip-sync-audio-file", audio_path,
                    "--print-summary",
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 0)

    def test_pixverse_smoke_command_rejects_mixed_custom_audio_and_tts_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            audio_path = self.write_dummy_audio(tmp, "local-mixed-audio.wav")
            previous = {"PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY")}
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", os.path.join(tmp, "pixverse-smoke-invalid-mixed-lipsync"),
                    "--lip-sync-audio-file", audio_path,
                    "--lip-sync-speaker-id", "speaker_001",
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 2)

    def test_pixverse_smoke_command_rejects_sound_effect_with_custom_audio_lip_sync_inputs(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            audio_path = self.write_dummy_audio(tmp, "local-conflict-audio.wav")
            previous = {"PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY")}
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", os.path.join(tmp, "pixverse-smoke-invalid-audio-conflict"),
                    "--sound-effect-prompt", "Busy cafe room tone",
                    "--lip-sync-audio-file", audio_path,
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 2)

    def test_pixverse_provider_mode_extends_video_when_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp, text=EXTENDED_PIXVERSE_BRIEF)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-extended")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
                "KG_PIXVERSE_MAX_EXTENSIONS": os.environ.get("KG_PIXVERSE_MAX_EXTENSIONS"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            os.environ["KG_PIXVERSE_MAX_EXTENSIONS"] = "1"
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-extended",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["base_generation_mode"], "transition_video")
            self.assertEqual(manifest["generation_mode"], "extend_video")
            self.assertEqual(manifest["extension_count"], 1)

    def test_pixverse_provider_mode_applies_sound_effect_when_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-sound-effect")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
                "KG_PIXVERSE_ENABLE_SOUND_EFFECT": os.environ.get("KG_PIXVERSE_ENABLE_SOUND_EFFECT"),
                "KG_PIXVERSE_SOUND_EFFECT_PROMPT": os.environ.get("KG_PIXVERSE_SOUND_EFFECT_PROMPT"),
                "KG_PIXVERSE_KEEP_ORIGINAL_SOUND": os.environ.get("KG_PIXVERSE_KEEP_ORIGINAL_SOUND"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            os.environ["KG_PIXVERSE_ENABLE_SOUND_EFFECT"] = "true"
            os.environ["KG_PIXVERSE_SOUND_EFFECT_PROMPT"] = "Gentle ocean waves, seagull calls, soft wind"
            os.environ["KG_PIXVERSE_KEEP_ORIGINAL_SOUND"] = "false"
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-sound-effect",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["base_generation_mode"], "transition_video")
            self.assertEqual(manifest["generation_mode"], "sound_effect_video")
            self.assertEqual(manifest["video_url"], "https://example.com/pixverse-video-sfx.mp4")
            self.assertTrue(manifest["sound_effect"]["enabled"])
            self.assertEqual(manifest["sound_effect"]["tool_name"], "sound_effect_video")
            self.assertEqual(manifest["sound_effect"]["prompt"], "Gentle ocean waves, seagull calls, soft wind")
            self.assertFalse(manifest["sound_effect"]["keep_original_sound"])
            observation = state["memory"]["observations"]["generate_video"]["video"]
            self.assertTrue(observation["sound_effect_enabled"])
            self.assertEqual(observation["sound_effect_prompt"], "Gentle ocean waves, seagull calls, soft wind")
            self.assertFalse(observation["original_sound_switch"])

    def test_pixverse_smoke_command_applies_uploaded_video_sound_effect_when_requested(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-smoke-sfx-uploaded-video")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            try:
                code = pixverse_smoke_main([
                    "--input", brief,
                    "--output-dir", out,
                    "--sound-effect-prompt", "Urban traffic, footsteps, city ambiance",
                    "--sound-effect-video-media-id", "66666",
                    "--print-summary",
                ], base_dir=os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(code, 0)

    def test_pixverse_provider_mode_applies_uploaded_video_sound_effect_when_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-sound-effect-uploaded-video")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
                "KG_PIXVERSE_ENABLE_SOUND_EFFECT": os.environ.get("KG_PIXVERSE_ENABLE_SOUND_EFFECT"),
                "KG_PIXVERSE_SOUND_EFFECT_PROMPT": os.environ.get("KG_PIXVERSE_SOUND_EFFECT_PROMPT"),
                "KG_PIXVERSE_KEEP_ORIGINAL_SOUND": os.environ.get("KG_PIXVERSE_KEEP_ORIGINAL_SOUND"),
                "KG_PIXVERSE_SOUND_EFFECT_VIDEO_MEDIA_ID": os.environ.get("KG_PIXVERSE_SOUND_EFFECT_VIDEO_MEDIA_ID"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            os.environ["KG_PIXVERSE_ENABLE_SOUND_EFFECT"] = "true"
            os.environ["KG_PIXVERSE_SOUND_EFFECT_PROMPT"] = "Urban traffic, footsteps, city ambiance"
            os.environ["KG_PIXVERSE_KEEP_ORIGINAL_SOUND"] = "true"
            os.environ["KG_PIXVERSE_SOUND_EFFECT_VIDEO_MEDIA_ID"] = "66666"
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-sound-effect-uploaded-video",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["base_generation_mode"], "uploaded_video_media")
            self.assertEqual(manifest["generation_mode"], "sound_effect_video")
            self.assertEqual(manifest["video_url"], "https://example.com/pixverse-video-sfx.mp4")
            self.assertTrue(manifest["sound_effect"]["enabled"])
            self.assertEqual(manifest["sound_effect"]["mode"], "uploaded-video")
            self.assertEqual(manifest["sound_effect"]["video_media_id"], "66666")
            self.assertTrue(manifest["sound_effect"]["keep_original_sound"])
            observation = state["memory"]["observations"]["generate_video"]["video"]
            self.assertTrue(observation["sound_effect_enabled"])
            self.assertEqual(observation["sound_effect_mode"], "uploaded-video")
            self.assertEqual(observation["sound_effect_video_media_id"], "66666")

    def test_pixverse_provider_mode_applies_lip_sync_when_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-lip-sync")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
                "KG_PIXVERSE_ENABLE_LIP_SYNC": os.environ.get("KG_PIXVERSE_ENABLE_LIP_SYNC"),
                "KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID": os.environ.get("KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID"),
                "KG_PIXVERSE_LIP_SYNC_TTS_CONTENT": os.environ.get("KG_PIXVERSE_LIP_SYNC_TTS_CONTENT"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            os.environ["KG_PIXVERSE_ENABLE_LIP_SYNC"] = "true"
            os.environ["KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID"] = "speaker_001"
            os.environ["KG_PIXVERSE_LIP_SYNC_TTS_CONTENT"] = "Welcome to our amazing video tutorial"
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-lip-sync",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["base_generation_mode"], "transition_video")
            self.assertEqual(manifest["generation_mode"], "lip_sync_video")
            self.assertEqual(manifest["video_url"], "https://example.com/pixverse-video-lipsync.mp4")
            self.assertTrue(manifest["lip_sync"]["enabled"])
            self.assertEqual(manifest["lip_sync"]["tool_name"], "lip_sync_video")
            self.assertEqual(manifest["lip_sync"]["tts_speaker_id"], "speaker_001")
            self.assertEqual(manifest["lip_sync"]["tts_content"], "Welcome to our amazing video tutorial")
            observation = state["memory"]["observations"]["generate_video"]["video"]
            self.assertTrue(observation["lip_sync_enabled"])
            self.assertEqual(observation["lip_sync_tts_speaker_id"], "speaker_001")
            self.assertEqual(observation["lip_sync_tts_content"], "Welcome to our amazing video tutorial")

    def test_pixverse_provider_mode_applies_custom_audio_lip_sync_when_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-lip-sync-audio")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
                "KG_PIXVERSE_ENABLE_LIP_SYNC": os.environ.get("KG_PIXVERSE_ENABLE_LIP_SYNC"),
                "KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID": os.environ.get("KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID"),
                "KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID": os.environ.get("KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID"),
                "KG_PIXVERSE_LIP_SYNC_TTS_CONTENT": os.environ.get("KG_PIXVERSE_LIP_SYNC_TTS_CONTENT"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            os.environ["KG_PIXVERSE_ENABLE_LIP_SYNC"] = "true"
            os.environ["KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID"] = "44444"
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-lip-sync-audio",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["base_generation_mode"], "transition_video")
            self.assertEqual(manifest["generation_mode"], "lip_sync_video")
            self.assertEqual(manifest["video_url"], "https://example.com/pixverse-video-lipsync.mp4")
            self.assertTrue(manifest["lip_sync"]["enabled"])
            self.assertEqual(manifest["lip_sync"]["mode"], "custom-audio")
            self.assertEqual(manifest["lip_sync"]["audio_media_id"], "44444")
            self.assertEqual(manifest["lip_sync"]["tts_speaker_id"], "")
            self.assertEqual(manifest["lip_sync"]["tts_content"], "")
            observation = state["memory"]["observations"]["generate_video"]["video"]
            self.assertTrue(observation["lip_sync_enabled"])
            self.assertEqual(observation["lip_sync_mode"], "custom-audio")
            self.assertEqual(observation["lip_sync_audio_media_id"], "44444")

    def test_pixverse_provider_mode_applies_uploaded_video_lip_sync_when_enabled(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            out = os.path.join(tmp, "pixverse-lip-sync-uploaded-video")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
                "KG_PIXVERSE_ENABLE_LIP_SYNC": os.environ.get("KG_PIXVERSE_ENABLE_LIP_SYNC"),
                "KG_PIXVERSE_LIP_SYNC_VIDEO_MEDIA_ID": os.environ.get("KG_PIXVERSE_LIP_SYNC_VIDEO_MEDIA_ID"),
                "KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID": os.environ.get("KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID"),
                "KG_PIXVERSE_LIP_SYNC_TTS_CONTENT": os.environ.get("KG_PIXVERSE_LIP_SYNC_TTS_CONTENT"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            os.environ["KG_PIXVERSE_ENABLE_LIP_SYNC"] = "true"
            os.environ["KG_PIXVERSE_LIP_SYNC_VIDEO_MEDIA_ID"] = "77777"
            os.environ["KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID"] = "speaker_001"
            os.environ["KG_PIXVERSE_LIP_SYNC_TTS_CONTENT"] = "Welcome to our uploaded video tutorial"
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-lip-sync-uploaded-video",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["base_generation_mode"], "uploaded_video_media")
            self.assertEqual(manifest["generation_mode"], "lip_sync_video")
            self.assertEqual(manifest["video_url"], "https://example.com/pixverse-video-lipsync.mp4")
            self.assertTrue(manifest["lip_sync"]["enabled"])
            self.assertEqual(manifest["lip_sync"]["mode"], "tts")
            self.assertEqual(manifest["lip_sync"]["video_mode"], "uploaded-video")
            self.assertEqual(manifest["lip_sync"]["video_media_id"], "77777")
            self.assertEqual(manifest["lip_sync"]["tts_speaker_id"], "speaker_001")
            self.assertEqual(manifest["lip_sync"]["tts_content"], "Welcome to our uploaded video tutorial")
            observation = state["memory"]["observations"]["generate_video"]["video"]
            self.assertTrue(observation["lip_sync_enabled"])
            self.assertEqual(observation["lip_sync_video_mode"], "uploaded-video")
            self.assertEqual(observation["lip_sync_video_media_id"], "77777")
            self.assertEqual(observation["lip_sync_mode"], "tts")

    def test_pixverse_provider_mode_uploads_local_media_for_uploaded_video_custom_audio_lip_sync(self) -> None:
        with tempfile.TemporaryDirectory() as tmp:
            brief = self.write_brief(tmp)
            fake_server = self.write_fake_pixverse_server(tmp)
            video_path = self.write_dummy_video(tmp, "local-video.mp4")
            audio_path = self.write_dummy_audio(tmp, "local-audio.wav")
            out = os.path.join(tmp, "pixverse-lip-sync-uploaded-media")
            previous = {
                "PIXVERSE_API_KEY": os.environ.get("PIXVERSE_API_KEY"),
                "KG_PIXVERSE_MCP_COMMAND": os.environ.get("KG_PIXVERSE_MCP_COMMAND"),
                "KG_PIXVERSE_MCP_ARGS_JSON": os.environ.get("KG_PIXVERSE_MCP_ARGS_JSON"),
                "KG_PIXVERSE_ENABLE_LIP_SYNC": os.environ.get("KG_PIXVERSE_ENABLE_LIP_SYNC"),
                "KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_PATH": os.environ.get("KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_PATH"),
                "KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_PATH": os.environ.get("KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_PATH"),
                "KG_PIXVERSE_UPLOAD_AUDIO_TOOL": os.environ.get("KG_PIXVERSE_UPLOAD_AUDIO_TOOL"),
            }
            os.environ["PIXVERSE_API_KEY"] = "test-key"
            os.environ["KG_PIXVERSE_MCP_COMMAND"] = sys.executable
            os.environ["KG_PIXVERSE_MCP_ARGS_JSON"] = json.dumps([fake_server])
            os.environ["KG_PIXVERSE_ENABLE_LIP_SYNC"] = "true"
            os.environ["KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_PATH"] = video_path
            os.environ["KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_PATH"] = audio_path
            os.environ["KG_PIXVERSE_UPLOAD_AUDIO_TOOL"] = "upload_audio"
            try:
                state = run_harness(
                    input_path=brief,
                    output_dir=out,
                    goal_text=GOAL_TEXT,
                    run_id="pixverse-lip-sync-uploaded-media",
                    provider_mode="pixverse",
                    budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=120),
                )
            finally:
                for key, value in previous.items():
                    if value is None:
                        os.environ.pop(key, None)
                    else:
                        os.environ[key] = value
            self.assertEqual(state["run"]["status"], "completed")
            self.assertTrue(state["verification"]["passed"])
            manifest_path = os.path.join(out, "artifacts", "video", "pixverse-video.json")
            with open(manifest_path, "r", encoding="utf-8") as handle:
                manifest = json.load(handle)
            self.assertEqual(manifest["base_generation_mode"], "uploaded_video_media")
            self.assertEqual(manifest["generation_mode"], "lip_sync_video")
            self.assertEqual(manifest["video_url"], "https://example.com/pixverse-video-lipsync.mp4")
            self.assertTrue(manifest["lip_sync"]["enabled"])
            self.assertEqual(manifest["lip_sync"]["mode"], "custom-audio")
            self.assertEqual(manifest["lip_sync"]["video_mode"], "uploaded-video")
            self.assertEqual(manifest["lip_sync"]["video_file_path"], video_path)
            self.assertEqual(manifest["lip_sync"]["audio_file_path"], audio_path)
            self.assertTrue(str(manifest["lip_sync"]["video_media_id"]).isdigit())
            self.assertTrue(str(manifest["lip_sync"]["audio_media_id"]).isdigit())
            self.assertEqual(manifest["uploads"]["lip_sync_video"]["file_path"], video_path)
            self.assertEqual(manifest["uploads"]["lip_sync_video"]["tool_name"], "upload_video")
            self.assertEqual(manifest["uploads"]["lip_sync_audio"]["file_path"], audio_path)
            self.assertEqual(manifest["uploads"]["lip_sync_audio"]["tool_name"], "upload_audio")
            observation = state["memory"]["observations"]["generate_video"]["video"]
            self.assertTrue(observation["lip_sync_enabled"])
            self.assertEqual(observation["lip_sync_video_mode"], "uploaded-video")
            self.assertEqual(observation["lip_sync_mode"], "custom-audio")
            self.assertTrue(str(observation["lip_sync_video_media_id"]).isdigit())
            self.assertTrue(str(observation["lip_sync_audio_media_id"]).isdigit())


if __name__ == "__main__":
    unittest.main()
