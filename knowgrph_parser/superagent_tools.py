import os
from typing import Any, List, Optional, Tuple

from .common import read_text, sha256_text, utc_now_iso, write_json, write_text
from .superagent_contracts import (
    BALANCED_LAYOUT_ID,
    ERROR_CONFIG,
    ERROR_FATAL,
    ERROR_RETRYABLE,
    HarnessError,
    JsonDict,
    RICH_MEDIA_PANEL_EDGE_LANES,
    RICH_MEDIA_PANEL_EDGE_IDS,
    RICH_MEDIA_SURFACE_ROUTE,
    ToolDefinition,
    ToolRegistry,
)
from .superagent_utils import clip_sentence, color_pair_from_text, normalize_space
from .superagent_verifier import tool_judge_verify
from .superagent_renderers import (
    artifact_path_by_id,
    artifact_record,
    balanced_layout_entry,
    balanced_layout_metadata,
    balanced_layout_props,
    build_text_widget_output,
    derive_scenes,
    first_scene_value,
    graph_edge,
    graph_node,
    infer_title,
    render_canvas_preview_html,
    render_final_report,
    render_mock_image_svg,
    render_mock_video_html,
    render_scene_plan_markdown,
    render_text_output_src_doc,
    render_workspace_flow_markdown,
    split_frontmatter,
)

def build_default_tool_registry(harness: Any) -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(
        ToolDefinition(
            "workspace.inspect",
            "Read a user-provided brief and extract neutral goal/input metadata.",
            {"input_path": "string", "goal_text": "string", "output_dir": "string", "artifacts_dir": "string", "run_id": "string", "step_id": "string"},
            {},
            30,
            [],
            tool_workspace_inspect,
        )
    )
    registry.register(
        ToolDefinition(
            "text.generate.mock",
            "Create deterministic text, scene, caption, and media prompt artifacts.",
            {"inspection": "object", "artifacts_dir": "string", "run_id": "string", "step_id": "string"},
            {},
            30,
            [ERROR_RETRYABLE],
            tool_text_generate_mock,
        )
    )
    registry.register(
        ToolDefinition(
            "image.generate.mock",
            "Create a deterministic SVG reference frame.",
            {"text_plan": "object", "artifacts_dir": "string", "run_id": "string", "step_id": "string"},
            {},
            30,
            [ERROR_RETRYABLE],
            tool_image_generate_mock,
        )
    )
    registry.register(
        ToolDefinition(
            "video.generate.mock",
            "Create a deterministic HTML storyboard standing in for video output.",
            {"text_plan": "object", "image_result": "object", "artifacts_dir": "string", "run_id": "string", "step_id": "string"},
            {},
            30,
            [ERROR_RETRYABLE],
            tool_video_generate_mock,
        )
    )
    registry.register(
        ToolDefinition(
            "canvas.write",
            "Compose rich media GraphData and a lightweight canvas preview.",
            {
                "inspection": "object",
                "text_plan": "object",
                "image_result": "object",
                "video_result": "object",
                "artifacts_dir": "string",
                "run_id": "string",
                "step_id": "string",
                "state": "object",
            },
            {},
            30,
            [ERROR_RETRYABLE],
            tool_canvas_write,
        )
    )
    registry.register(
        ToolDefinition(
            "judge.verify",
            "Run deterministic validation against artifacts, trace, and graph topology.",
            {"canvas_result": "object", "state": "object", "output_dir": "string", "run_id": "string", "step_id": "string"},
            {},
            30,
            [],
            tool_judge_verify,
        )
    )
    registry.register(
        ToolDefinition(
            "artifact.export_report",
            "Write the final report with run, trace, artifact, recovery, and termination evidence.",
            {"verification": "object", "state": "object", "output_dir": "string", "run_id": "string", "step_id": "string"},
            {},
            30,
            [],
            tool_export_report,
        )
    )
    return registry


def tool_workspace_inspect(payload: JsonDict) -> JsonDict:
    input_path = os.path.abspath(str(payload.get("input_path") or ""))
    if not input_path:
        raise HarnessError("Missing input path for workspace inspection", ERROR_CONFIG)
    if not os.path.exists(input_path):
        raise HarnessError(f"Input brief does not exist: {input_path}", ERROR_CONFIG)
    if not os.path.isfile(input_path):
        raise HarnessError(f"Input path must be a file: {input_path}", ERROR_CONFIG)

    text = read_text(input_path)
    frontmatter, body = split_frontmatter(text)
    title = infer_title(frontmatter, body, input_path)
    source_name = os.path.basename(input_path)
    source_hash = sha256_text(text)
    artifact_path = os.path.join(str(payload["artifacts_dir"]), "input", "brief.md")
    write_text(artifact_path, text)

    return {
        "title": title,
        "source_name": source_name,
        "source_hash": source_hash,
        "input_path": input_path,
        "frontmatter": frontmatter,
        "body": body,
        "brief_text": text,
        "tool_count": 7,
        "artifacts": [
            artifact_record(
                "input_brief",
                "brief",
                artifact_path,
                "text/markdown; charset=utf-8",
                str(payload["step_id"]),
                {"source_name": source_name, "source_hash": source_hash},
            )
        ],
    }


def tool_text_generate_mock(payload: JsonDict) -> JsonDict:
    inspection = payload.get("inspection") if isinstance(payload.get("inspection"), dict) else {}
    frontmatter = inspection.get("frontmatter") if isinstance(inspection.get("frontmatter"), dict) else {}
    body = str(inspection.get("body") or "")
    title = str(inspection.get("title") or "Untitled brief")
    scenes = derive_scenes(frontmatter, body)
    prompts = []
    for index, scene in enumerate(scenes, start=1):
        prompt_source = normalize_space(scene.get("source") or scene.get("summary") or title)
        prompts.append(
            {
                "scene_id": f"scene-{index}",
                "title": scene["title"],
                "summary": scene["summary"],
                "caption": f"{scene['title']}: {clip_sentence(scene['summary'], 96)}",
                "narration": clip_sentence(prompt_source, 220),
                "image_prompt": f"Reference frame for {scene['title']}: {clip_sentence(prompt_source, 280)}",
                "video_prompt": f"Short motion sequence for {scene['title']}: {clip_sentence(prompt_source, 340)}",
            }
        )

    text_dir = os.path.join(str(payload["artifacts_dir"]), "text")
    plan_json_path = os.path.join(text_dir, "scene-plan.json")
    plan_md_path = os.path.join(text_dir, "scene-plan.md")
    plan = {
        "title": title,
        "provider": "deterministic-mock",
        "scenes": prompts,
        "source_hash": str(inspection.get("source_hash") or ""),
    }
    write_json(plan_json_path, plan)
    write_text(plan_md_path, render_scene_plan_markdown(plan))
    return {
        "plan": plan,
        "artifacts": [
            artifact_record("text_scene_plan_json", "text", plan_json_path, "application/json", str(payload["step_id"])),
            artifact_record("text_scene_plan_markdown", "text", plan_md_path, "text/markdown; charset=utf-8", str(payload["step_id"])),
        ],
    }


def tool_image_generate_mock(payload: JsonDict) -> JsonDict:
    text_plan = payload.get("text_plan") if isinstance(payload.get("text_plan"), dict) else {}
    plan = text_plan.get("plan") if isinstance(text_plan.get("plan"), dict) else {}
    scenes = plan.get("scenes") if isinstance(plan.get("scenes"), list) else []
    if not scenes:
        raise HarnessError("Cannot generate image: text plan contains no scenes", ERROR_RETRYABLE)
    scene = scenes[0] if isinstance(scenes[0], dict) else {}
    title = str(plan.get("title") or "Rich media plan")
    prompt = str(scene.get("image_prompt") or scene.get("summary") or title)
    image_dir = os.path.join(str(payload["artifacts_dir"]), "image")
    image_path = os.path.join(image_dir, "reference-frame.svg")
    palette = color_pair_from_text(prompt)
    write_text(image_path, render_mock_image_svg(title=title, scene_title=str(scene.get("title") or "Scene"), prompt=prompt, palette=palette))
    return {
        "image": {
            "path": image_path,
            "media_kind": "image",
            "mime_type": "image/svg+xml",
            "prompt": prompt,
            "model": "deterministic-mock-image",
        },
        "artifacts": [
            artifact_record(
                "image_reference_frame",
                "image",
                image_path,
                "image/svg+xml",
                str(payload["step_id"]),
                {"prompt_hash": sha256_text(prompt)[:16]},
            )
        ],
    }


def tool_video_generate_mock(payload: JsonDict) -> JsonDict:
    text_plan = payload.get("text_plan") if isinstance(payload.get("text_plan"), dict) else {}
    image_result = payload.get("image_result") if isinstance(payload.get("image_result"), dict) else {}
    plan = text_plan.get("plan") if isinstance(text_plan.get("plan"), dict) else {}
    scenes = plan.get("scenes") if isinstance(plan.get("scenes"), list) else []
    if not scenes:
        raise HarnessError("Cannot generate video: text plan contains no scenes", ERROR_RETRYABLE)
    image = image_result.get("image") if isinstance(image_result.get("image"), dict) else {}
    video_dir = os.path.join(str(payload["artifacts_dir"]), "video")
    video_html_path = os.path.join(video_dir, "storyboard-video.html")
    video_json_path = os.path.join(video_dir, "storyboard-video.json")
    video_plan = {
        "title": str(plan.get("title") or "Rich media plan"),
        "provider": "deterministic-mock",
        "duration_seconds": max(6, min(18, len(scenes) * 4)),
        "reference_image": str(image.get("path") or ""),
        "scenes": scenes,
    }
    write_json(video_json_path, video_plan)
    write_text(video_html_path, render_mock_video_html(video_plan))
    return {
        "video": {
            "path": video_html_path,
            "manifest_path": video_json_path,
            "media_kind": "video",
            "mime_type": "text/html; charset=utf-8",
            "model": "deterministic-mock-video",
            "duration_seconds": video_plan["duration_seconds"],
            "reference_image": video_plan["reference_image"],
        },
        "artifacts": [
            artifact_record("video_storyboard_html", "video", video_html_path, "text/html; charset=utf-8", str(payload["step_id"])),
            artifact_record("video_storyboard_manifest", "video", video_json_path, "application/json", str(payload["step_id"])),
        ],
    }


def tool_canvas_write(payload: JsonDict) -> JsonDict:
    run_id = str(payload["run_id"])
    step_id = str(payload["step_id"])
    inspection = payload.get("inspection") if isinstance(payload.get("inspection"), dict) else {}
    text_plan = payload.get("text_plan") if isinstance(payload.get("text_plan"), dict) else {}
    image_result = payload.get("image_result") if isinstance(payload.get("image_result"), dict) else {}
    video_result = payload.get("video_result") if isinstance(payload.get("video_result"), dict) else {}
    plan = text_plan.get("plan") if isinstance(text_plan.get("plan"), dict) else {}
    image = image_result.get("image") if isinstance(image_result.get("image"), dict) else {}
    video = video_result.get("video") if isinstance(video_result.get("video"), dict) else {}
    artifacts_dir = str(payload["artifacts_dir"])
    canvas_dir = os.path.join(artifacts_dir, "canvas")
    workspace_dir = os.path.join(artifacts_dir, "workspace")
    graph_path = os.path.join(canvas_dir, "canvas.graph.json")
    preview_path = os.path.join(canvas_dir, "canvas-preview.html")
    workspace_path = os.path.join(workspace_dir, "rich-media-flow.md")
    text_plan_path = artifact_path_by_id(text_plan, "text_scene_plan_markdown")
    text_output = build_text_widget_output(plan, text_plan_path)
    text_output_src_doc = render_text_output_src_doc(plan)
    layout = balanced_layout_metadata()

    nodes = [
        graph_node(
            "goal",
            "Goal",
            "Goal",
            int(balanced_layout_entry("goal")["x"]),
            int(balanced_layout_entry("goal")["y"]),
            balanced_layout_props("goal", {
                "runId": run_id,
                "goalHash": str(payload.get("state", {}).get("run", {}).get("goal_hash") or ""),
                "surfaceRoute": RICH_MEDIA_SURFACE_ROUTE,
            }),
        ),
        graph_node(
            "brief",
            str(inspection.get("title") or "Input brief"),
            "Brief",
            int(balanced_layout_entry("brief")["x"]),
            int(balanced_layout_entry("brief")["y"]),
            balanced_layout_props(
                "brief",
                {"sourceName": str(inspection.get("source_name") or ""), "sourceHash": str(inspection.get("source_hash") or "")},
            ),
        ),
        graph_node(
            "text-plan",
            "Scene plan",
            "TextGeneration",
            int(balanced_layout_entry("text-plan")["x"]),
            int(balanced_layout_entry("text-plan")["y"]),
            balanced_layout_props("text-plan", {
                "mediaKind": "text",
                "outputPath": text_plan_path,
                "output": text_output,
                "outputSrcDoc": text_output_src_doc,
                "flow:widgetFormId": "textGeneration",
                "handles": {"target": ["prompt_in"], "source": ["text_out"]},
                "sceneCount": len(plan.get("scenes") if isinstance(plan.get("scenes"), list) else []),
            }),
        ),
        graph_node(
            "image-reference",
            "Reference image",
            "ImageGeneration",
            int(balanced_layout_entry("image-reference")["x"]),
            int(balanced_layout_entry("image-reference")["y"]),
            balanced_layout_props("image-reference", {
                "mediaKind": "image",
                "imageUrl": str(image.get("path") or ""),
                "outputPath": str(image.get("path") or ""),
                "flow:widgetFormId": "imageGeneration",
                "handles": {"target": ["reference_image"], "source": ["imageUrl"]},
            }),
        ),
        graph_node(
            "video-storyboard",
            "Storyboard video",
            "VideoGeneration",
            int(balanced_layout_entry("video-storyboard")["x"]),
            int(balanced_layout_entry("video-storyboard")["y"]),
            balanced_layout_props("video-storyboard", {
                "mediaKind": "video",
                "videoUrl": str(video.get("path") or ""),
                "outputPath": str(video.get("path") or ""),
                "referenceImage": str(video.get("reference_image") or ""),
                "durationSeconds": int(video.get("duration_seconds") or 0),
                "flow:widgetFormId": "videoGeneration",
                "handles": {"target": ["reference_image"], "source": ["videoUrl"]},
            }),
        ),
        graph_node(
            "rich-media-panel",
            "Rich Media Panel",
            "RichMediaPanel",
            int(balanced_layout_entry("rich-media-panel")["x"]),
            int(balanced_layout_entry("rich-media-panel")["y"]),
            balanced_layout_props("rich-media-panel", {
                "mediaKind": "rich-media-panel",
                "richMediaActiveTab": "auto",
                "flow:widgetFormId": "richMediaPanel",
                "handles": {"target": ["output", "imageUrl", "videoUrl"], "source": []},
                "surfaceRoute": RICH_MEDIA_SURFACE_ROUTE,
            }),
        ),
        graph_node(
            "verification",
            "Verification",
            "Judge",
            int(balanced_layout_entry("verification")["x"]),
            int(balanced_layout_entry("verification")["y"]),
            balanced_layout_props("verification", {"status": "pending", "generatedByStepId": step_id}),
        ),
        graph_node(
            "report",
            "Final report",
            "Report",
            int(balanced_layout_entry("report")["x"]),
            int(balanced_layout_entry("report")["y"]),
            balanced_layout_props("report", {"outputPath": "final-report.md"}),
        ),
    ]
    edges = [
        graph_edge("e-goal-brief", "goal", "brief", "constrains"),
        graph_edge("e-brief-text", "brief", "text-plan", "generates_text"),
        graph_edge("e-text-image", "text-plan", "image-reference", "image_prompt", "text_out", "reference_image"),
        graph_edge("e-image-video", "image-reference", "video-storyboard", "reference_image", "imageUrl", "reference_image"),
        graph_edge("e-text-video", "text-plan", "video-storyboard", "video_prompt", "text_out", "prompt_in"),
        graph_edge("e-text-panel", "text-plan", "rich-media-panel", "panel_text", "text_out", "output"),
        graph_edge("e-image-panel", "image-reference", "rich-media-panel", "panel_image", "imageUrl", "imageUrl"),
        graph_edge("e-video-panel", "video-storyboard", "rich-media-panel", "panel_video", "videoUrl", "videoUrl"),
        graph_edge("e-video-verification", "video-storyboard", "verification", "verifies"),
        graph_edge("e-panel-verification", "rich-media-panel", "verification", "verifies_panel"),
        graph_edge("e-canvas-report", "verification", "report", "summarizes"),
    ]
    for edge in edges:
        if edge.get("id") in RICH_MEDIA_PANEL_EDGE_IDS:
            edge_id = str(edge.get("id") or "")
            edge.setdefault("properties", {})["layoutRoute"] = {
                "frame": BALANCED_LAYOUT_ID,
                "strategy": "fan-in-readable",
                "sourceAnchor": "bottom",
                "targetAnchor": "top",
                "laneIndex": int(RICH_MEDIA_PANEL_EDGE_LANES.get(edge_id, 0)),
                "avoidWidgetContent": True,
            }
    graph = {
        "type": "Graph",
        "metadata": {
            "kind": "superagent-rich-media-canvas",
            "runId": run_id,
            "sourceName": str(inspection.get("source_name") or ""),
            "generatedAt": utc_now_iso(),
            "providerMode": "mock",
            "surfaceRoute": RICH_MEDIA_SURFACE_ROUTE,
            "layout": layout,
            "workspaceArtifact": workspace_path,
            "provenance": {"sourceStepId": step_id},
        },
        "nodes": nodes,
        "edges": edges,
    }
    write_json(graph_path, graph)
    write_text(preview_path, render_canvas_preview_html(graph))
    write_text(
        workspace_path,
        render_workspace_flow_markdown(
            run_id=run_id,
            title=str(plan.get("title") or inspection.get("title") or "Rich media flow"),
            text_output=text_output,
            text_output_src_doc=text_output_src_doc,
            text_prompt=first_scene_value(plan, "video_prompt") or first_scene_value(plan, "summary") or str(plan.get("title") or ""),
            image_prompt=str(image.get("prompt") or first_scene_value(plan, "image_prompt") or ""),
            image_url=str(image.get("path") or ""),
            video_prompt=first_scene_value(plan, "video_prompt") or "",
            video_url=str(video.get("path") or ""),
            source_name=str(inspection.get("source_name") or ""),
            source_hash=str(inspection.get("source_hash") or ""),
        ),
    )
    return {
        "canvas": {
            "path": graph_path,
            "preview_path": preview_path,
            "workspace_path": workspace_path,
            "graph": graph,
        },
        "artifacts": [
            artifact_record("canvas_graph", "canvas", graph_path, "application/json", step_id),
            artifact_record("canvas_preview", "canvas", preview_path, "text/html; charset=utf-8", step_id),
            artifact_record("workspace_rich_media_flow", "workspace", workspace_path, "text/markdown; charset=utf-8", step_id),
        ],
    }


def tool_export_report(payload: JsonDict) -> JsonDict:
    state = payload.get("state") if isinstance(payload.get("state"), dict) else {}
    output_dir = str(payload["output_dir"])
    report_path = os.path.join(output_dir, "final-report.md")
    verification = payload.get("verification") if isinstance(payload.get("verification"), dict) else {}
    write_text(report_path, render_final_report(state=state, verification=verification, output_dir=output_dir))
    return {
        "report": {"path": report_path},
        "artifacts": [
            artifact_record("final_report", "report", report_path, "text/markdown; charset=utf-8", str(payload["step_id"]))
        ],
    }
