import os
from typing import List, Optional, Tuple

from .common import read_text, utc_now_iso
from .superagent_contracts import (
    BALANCED_LAYOUT_ID,
    ERROR_FATAL,
    HarnessError,
    JsonDict,
    RICH_MEDIA_PANEL_EDGE_IDS,
    RICH_MEDIA_SURFACE_ROUTE,
)
from .superagent_plan import build_plan
from .superagent_utils import read_trace_events

def tool_judge_verify(payload: JsonDict) -> JsonDict:
    state = payload.get("state") if isinstance(payload.get("state"), dict) else {}
    canvas_result = payload.get("canvas_result") if isinstance(payload.get("canvas_result"), dict) else {}
    canvas = canvas_result.get("canvas") if isinstance(canvas_result.get("canvas"), dict) else {}
    graph = canvas.get("graph") if isinstance(canvas.get("graph"), dict) else {}
    checks: List[JsonDict] = []

    artifacts = state.get("artifacts") if isinstance(state.get("artifacts"), list) else []
    artifact_kinds = {str(a.get("kind")) for a in artifacts if isinstance(a, dict)}
    for kind in ["brief", "text", "image", "video", "canvas", "workspace"]:
        checks.append({"id": f"artifact:{kind}", "passed": kind in artifact_kinds, "detail": f"{kind} artifact recorded"})

    nodes = graph.get("nodes") if isinstance(graph.get("nodes"), list) else []
    edges = graph.get("edges") if isinstance(graph.get("edges"), list) else []
    node_types = {str(n.get("type")) for n in nodes if isinstance(n, dict)}
    flow_form_ids = {
        str((n.get("properties") or {}).get("flow:widgetFormId") or "")
        for n in nodes
        if isinstance(n, dict) and isinstance(n.get("properties"), dict)
    }
    checks.append({"id": "canvas:has_text_node", "passed": "TextGeneration" in node_types, "detail": "text node present"})
    checks.append({"id": "canvas:has_image_node", "passed": "ImageGeneration" in node_types, "detail": "image node present"})
    checks.append({"id": "canvas:has_video_node", "passed": "VideoGeneration" in node_types, "detail": "video node present"})
    checks.append({"id": "canvas:has_rich_media_panel", "passed": "RichMediaPanel" in node_types, "detail": "Rich Media Panel node present"})
    checks.append({"id": "canvas:has_edges", "passed": len(edges) >= 8, "detail": f"{len(edges)} edges"})
    checks.append(
        {
            "id": "canvas:widget_form_ids",
            "passed": {"textGeneration", "imageGeneration", "videoGeneration", "richMediaPanel"}.issubset(flow_form_ids),
            "detail": sorted(flow_form_ids),
        }
    )
    panel_targets = {
        str(edge.get("targetHandle") or "")
        for edge in edges
        if isinstance(edge, dict) and str(edge.get("target") or "") == "rich-media-panel"
    }
    checks.append(
        {
            "id": "canvas:rich_media_panel_ports",
            "passed": {"output", "imageUrl", "videoUrl"}.issubset(panel_targets),
            "detail": sorted(panel_targets),
        }
    )
    checks.append(
        {
            "id": "surface:route",
            "passed": str(graph.get("metadata", {}).get("surfaceRoute") if isinstance(graph.get("metadata"), dict) else "") == RICH_MEDIA_SURFACE_ROUTE,
            "detail": RICH_MEDIA_SURFACE_ROUTE,
        }
    )
    graph_meta = graph.get("metadata") if isinstance(graph.get("metadata"), dict) else {}
    layout_meta = graph_meta.get("layout") if isinstance(graph_meta.get("layout"), dict) else {}
    frame = layout_meta.get("frame") if isinstance(layout_meta.get("frame"), dict) else {}
    required_layout_node_ids = ["text-plan", "image-reference", "video-storyboard", "rich-media-panel"]
    node_by_id = {str(node.get("id") or ""): node for node in nodes if isinstance(node, dict)}

    def node_rect(node_id: str) -> Optional[Tuple[float, float, float, float]]:
        node = node_by_id.get(node_id)
        if not node:
            return None
        props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        x = node.get("x")
        y = node.get("y")
        w = props.get("visual:width")
        h = props.get("visual:height")
        if not all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in [x, y, w, h]):
            return None
        return (float(x), float(y), float(w), float(h))

    rects = {node_id: node_rect(node_id) for node_id in required_layout_node_ids}
    frame_w = frame.get("width")
    frame_h = frame.get("height")
    frame_ok = frame.get("id") == BALANCED_LAYOUT_ID and frame_w == 1920 and frame_h == 1080 and frame.get("aspectRatio") == "16:9"
    inside_frame = True
    non_overlapping = True
    for node_id, rect in rects.items():
        if not rect:
            inside_frame = False
            continue
        x, y, w, h = rect
        if x < 0 or y < 0 or x + w > 1920 or y + h > 1080:
            inside_frame = False
    rect_items = [(node_id, rect) for node_id, rect in rects.items() if rect]
    for i in range(len(rect_items)):
        a_id, a = rect_items[i]
        ax, ay, aw, ah = a  # type: ignore[misc]
        for j in range(i + 1, len(rect_items)):
            b_id, b = rect_items[j]
            bx, by, bw, bh = b  # type: ignore[misc]
            separated = ax + aw <= bx or bx + bw <= ax or ay + ah <= by or by + bh <= ay
            if not separated:
                non_overlapping = False
                break
        if not non_overlapping:
            break
    checks.append(
        {
            "id": "layout:balanced_16x9_widgets",
            "passed": bool(frame_ok and inside_frame and non_overlapping),
            "detail": {"frame": frame, "rects": rects},
        }
    )
    routed_panel_edges = {
        str(edge.get("id") or ""): edge
        for edge in edges
        if isinstance(edge, dict) and str(edge.get("id") or "") in RICH_MEDIA_PANEL_EDGE_IDS
    }
    edge_routes_ok = len(routed_panel_edges) == len(RICH_MEDIA_PANEL_EDGE_IDS)
    for edge in routed_panel_edges.values():
        props = edge.get("properties") if isinstance(edge.get("properties"), dict) else {}
        route = props.get("layoutRoute") if isinstance(props.get("layoutRoute"), dict) else {}
        if route.get("frame") != BALANCED_LAYOUT_ID or route.get("strategy") != "fan-in-readable":
            edge_routes_ok = False
            break
    checks.append(
        {
            "id": "layout:balanced_16x9_edges",
            "passed": edge_routes_ok,
            "detail": sorted(routed_panel_edges.keys()),
        }
    )

    artifact_paths = [str(a.get("path") or "") for a in artifacts if isinstance(a, dict)]
    missing_paths = [path for path in artifact_paths if path and not os.path.exists(path)]
    checks.append({"id": "artifacts:paths_exist", "passed": not missing_paths, "detail": missing_paths[:5]})

    workspace_path = str(canvas.get("workspace_path") or "")
    if not workspace_path:
        for artifact in artifacts:
            if isinstance(artifact, dict) and artifact.get("artifact_id") == "workspace_rich_media_flow":
                workspace_path = str(artifact.get("path") or "")
                break
    workspace_text = read_text(workspace_path) if workspace_path and os.path.exists(workspace_path) else ""
    workspace_tokens = [
        'kgCanvas2dRenderer: "flowEditor"',
        "TextGeneration",
        "ImageGeneration",
        "VideoGeneration",
        "RichMediaPanel",
        "flow:widgetFormId",
        "richMediaPanel",
        "kgSuperAgentLayout:",
        "frontmatterFlowSettings:",
        "balancedViewportPreset: widgetFrontmatter",
        "balancedHeroRowCount: 3",
        "position: {key: position, type: object",
        f'layoutRoute: "{BALANCED_LAYOUT_ID}:fan-in-readable"',
        "sourceHandle: text_out",
        "targetHandle: videoUrl",
    ]
    checks.append(
        {
            "id": "workspace:frontmatter_flow_rich_media_panel",
            "passed": bool(workspace_text) and all(token in workspace_text for token in workspace_tokens),
            "detail": workspace_path,
        }
    )

    trace_path = os.path.join(str(payload["output_dir"]), "trace.jsonl")
    trace_events = read_trace_events(trace_path)
    event_names = {str(event.get("event")) for event in trace_events}
    for event_name in ["run.start", "task.dispatch", "tool.call", "tool.observation", "step.complete"]:
        checks.append({"id": f"trace:{event_name}", "passed": event_name in event_names, "detail": event_name})

    provenance_ok = True
    for artifact in artifacts:
        if not isinstance(artifact, dict):
            continue
        if not str(artifact.get("source_step_id") or ""):
            provenance_ok = False
            break
    checks.append({"id": "provenance:artifact_source_steps", "passed": provenance_ok, "detail": "artifact source steps recorded"})

    completed = set(state.get("completed_task_ids") if isinstance(state.get("completed_task_ids"), list) else [])
    expected_before_verify = {task.task_id for task in build_plan() if task.task_id not in {"verify_outputs", "synthesize_report"}}
    checks.append(
        {
            "id": "termination:ready_for_synthesis",
            "passed": expected_before_verify.issubset(completed),
            "detail": sorted(expected_before_verify - completed),
        }
    )

    verification = {
        "passed": all(bool(check.get("passed")) for check in checks),
        "checks": checks,
        "checked_at": utc_now_iso(),
    }
    if not verification["passed"]:
        raise HarnessError("Verification failed", ERROR_FATAL, {"checks": checks})
    return {"verification": verification, "artifacts": []}
