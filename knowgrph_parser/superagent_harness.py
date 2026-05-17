import argparse
import html
import json
import os
import re
import sys
import time
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from typing import Any, Callable, Dict, Iterable, List, Optional, Sequence, Set, Tuple

try:
    import yaml
except Exception:  # pragma: no cover - exercised only when optional dependency is absent.
    yaml = None

from .common import read_json, read_text, sha256_text, slugify, utc_now_iso, write_json, write_text


JsonDict = Dict[str, Any]

ERROR_RETRYABLE = "retryable"
ERROR_REPLAN = "recoverable_by_replan"
ERROR_CONFIG = "blocked_by_configuration"
ERROR_FATAL = "fatal"
RICH_MEDIA_SURFACE_ROUTE = (
    "MainPanel Integrations -> FloatingPanel Chat UI -> Editor Workspace -> Canvas -> "
    "Balanced 16:9 (1920x1080) Layout for Widgets (Text, Image, Video) AND Rich Media Panel AND Edges"
)
BALANCED_LAYOUT_ID = "balanced-16x9"
BALANCED_LAYOUT_FRAME = {
    "id": BALANCED_LAYOUT_ID,
    "label": "Balanced 16:9",
    "width": 1920,
    "height": 1080,
    "aspectRatio": "16:9",
}
BALANCED_WIDGET_LAYOUT = {
    "text-plan": {"x": 160, "y": 180, "width": 360, "height": 250, "role": "textWidget"},
    "image-reference": {"x": 780, "y": 180, "width": 360, "height": 250, "role": "imageWidget"},
    "video-storyboard": {"x": 1400, "y": 180, "width": 360, "height": 250, "role": "videoWidget"},
    "rich-media-panel": {"x": 700, "y": 660, "width": 520, "height": 292, "role": "richMediaPanel"},
    "goal": {"x": 60, "y": 40, "width": 260, "height": 96, "role": "provenance"},
    "brief": {"x": 420, "y": 40, "width": 280, "height": 96, "role": "brief"},
    "verification": {"x": 160, "y": 800, "width": 360, "height": 140, "role": "verification"},
    "report": {"x": 1400, "y": 800, "width": 360, "height": 140, "role": "report"},
}
RICH_MEDIA_PANEL_EDGE_IDS = {"e-text-panel", "e-image-panel", "e-video-panel"}


@dataclass
class HarnessError(Exception):
    message: str
    kind: str = ERROR_FATAL
    detail: JsonDict = field(default_factory=dict)

    def __str__(self) -> str:
        return self.message


@dataclass
class ArtifactRecord:
    artifact_id: str
    kind: str
    path: str
    media_type: str
    source_step_id: str
    metadata: JsonDict = field(default_factory=dict)


@dataclass
class StepRecord:
    step_id: str
    task_id: str
    agent_id: str
    tool_name: str
    status: str
    started_at: str
    ended_at: Optional[str] = None
    attempt: int = 1
    input_summary: JsonDict = field(default_factory=dict)
    output_summary: JsonDict = field(default_factory=dict)
    error: Optional[JsonDict] = None


@dataclass
class AgentContract:
    agent_id: str
    role: str
    allowed_tools: List[str]
    memory_scope: str
    artifact_responsibility: str
    completion_signal: str


@dataclass
class TaskSpec:
    task_id: str
    label: str
    agent_id: str
    tool_name: str
    depends_on: List[str] = field(default_factory=list)
    max_retries: int = 2
    terminal: bool = False


@dataclass
class RunBudget:
    max_steps: int = 80
    max_retries_per_task: int = 2
    max_wall_seconds: int = 900
    max_concurrent_workers: int = 3


@dataclass
class GoalSpec:
    intent: str
    constraints: List[str]
    output_contract: List[str]
    quality_bar: List[str]
    stop_rules: List[str]


@dataclass
class ToolDefinition:
    name: str
    description: str
    required: Dict[str, str]
    optional: Dict[str, str]
    timeout_seconds: int
    retryable_error_kinds: List[str]
    handler: Callable[[JsonDict], JsonDict]


class ToolRegistry:
    def __init__(self) -> None:
        self._tools: Dict[str, ToolDefinition] = {}

    def register(self, tool: ToolDefinition) -> None:
        if tool.name in self._tools:
            raise HarnessError(f"Duplicate tool registration: {tool.name}", ERROR_FATAL)
        self._tools[tool.name] = tool

    def describe(self) -> List[JsonDict]:
        return [
            {
                "name": tool.name,
                "description": tool.description,
                "required": tool.required,
                "optional": tool.optional,
                "timeout_seconds": tool.timeout_seconds,
                "retryable_error_kinds": tool.retryable_error_kinds,
            }
            for tool in self._tools.values()
        ]

    def call(self, name: str, payload: JsonDict) -> JsonDict:
        tool = self._tools.get(name)
        if not tool:
            raise HarnessError(f"Unknown tool: {name}", ERROR_FATAL)
        self._validate_payload(tool, payload)
        return tool.handler(payload)

    def _validate_payload(self, tool: ToolDefinition, payload: JsonDict) -> None:
        if not isinstance(payload, dict):
            raise HarnessError(f"Tool {tool.name} payload must be an object", ERROR_FATAL)
        for key, type_name in tool.required.items():
            if key not in payload:
                raise HarnessError(
                    f"Tool {tool.name} missing required input: {key}",
                    ERROR_FATAL,
                    {"tool": tool.name, "field": key},
                )
            if not _matches_json_type(payload[key], type_name):
                raise HarnessError(
                    f"Tool {tool.name} input {key} must be {type_name}",
                    ERROR_FATAL,
                    {"tool": tool.name, "field": key, "expected": type_name},
                )


class TraceWriter:
    def __init__(self, trace_path: str) -> None:
        self.trace_path = trace_path
        os.makedirs(os.path.dirname(trace_path), exist_ok=True)

    def record(self, event: str, payload: JsonDict) -> None:
        row = {
            "ts": utc_now_iso(),
            "event": event,
            **payload,
        }
        with open(self.trace_path, "a", encoding="utf-8") as handle:
            handle.write(json.dumps(row, ensure_ascii=False, sort_keys=True) + "\n")


class SuperAgentHarness:
    def __init__(
        self,
        *,
        input_path: Optional[str],
        output_dir: str,
        goal_text: str,
        run_id: str,
        budget: RunBudget,
        provider_mode: str = "mock",
        resume: bool = False,
        stop_after_step: int = 0,
        fail_once_tools: Optional[Iterable[str]] = None,
    ) -> None:
        self.input_path = os.path.abspath(input_path) if input_path else ""
        self.output_dir = os.path.abspath(output_dir)
        self.goal_text = goal_text
        self.run_id = slugify(run_id)
        self.budget = budget
        self.provider_mode = provider_mode
        self.resume = resume
        self.stop_after_step = max(0, int(stop_after_step or 0))
        self.fail_once_tools: Set[str] = set(fail_once_tools or [])
        self.failed_once_tools: Set[str] = set()
        self.started_monotonic = time.monotonic()

        self.artifacts_dir = os.path.join(self.output_dir, "artifacts")
        self.state_path = os.path.join(self.output_dir, "state.json")
        self.trace_path = os.path.join(self.output_dir, "trace.jsonl")
        self.report_path = os.path.join(self.output_dir, "final-report.md")
        self.goal_path = os.path.join(self.output_dir, "goal.json")
        self.registry = build_default_tool_registry(self)
        if not resume and os.path.exists(self.trace_path):
            os.remove(self.trace_path)
        self.trace = TraceWriter(self.trace_path)

        if resume:
            self.state = self._load_state()
            self.run_id = str(self.state.get("run", {}).get("run_id") or self.run_id)
            self.failed_once_tools = set(self.state.get("memory", {}).get("failed_once_tools") or [])
        else:
            self.state = self._new_state()
            self._persist_goal()
            self._save_state()

    def run(self) -> JsonDict:
        self.trace.record(
            "run.start",
            {
                "run_id": self.run_id,
                "resume": self.resume,
                "provider_mode": self.provider_mode,
                "budget": asdict(self.budget),
            },
        )
        self.state["run"]["status"] = "running"
        self.state["run"]["started_at"] = self.state["run"].get("started_at") or utc_now_iso()
        self.state["run"]["updated_at"] = utc_now_iso()
        self._save_state()

        while True:
            if self._wall_time_exhausted():
                return self._terminate("blocked", "budget_wall_time_exhausted")
            if int(self.state["run"].get("step_count") or 0) >= self.budget.max_steps:
                return self._terminate("blocked", "budget_max_steps_exhausted")

            next_task = self._next_ready_task()
            if not next_task:
                if self._all_tasks_completed():
                    return self._terminate("completed", "acceptance_criteria_passed")
                return self._terminate("blocked", "no_ready_task_with_unfinished_dependencies")

            self._dispatch_task(next_task)

            completed_count = len(self.state.get("completed_task_ids") or [])
            if self.stop_after_step and completed_count >= self.stop_after_step:
                return self._terminate("interrupted", "stop_after_step_checkpoint")

    def _new_state(self) -> JsonDict:
        goal_hash = sha256_text(self.goal_text)[:16]
        tasks = build_plan()
        agents = build_agent_contracts()
        return {
            "run": {
                "run_id": self.run_id,
                "status": "created",
                "started_at": "",
                "ended_at": "",
                "updated_at": utc_now_iso(),
                "active_plan_version": "plan-v1",
                "goal_hash": goal_hash,
                "input_path": self.input_path,
                "provider_mode": self.provider_mode,
                "step_count": 0,
                "termination_reason": "",
                "budget": asdict(self.budget),
            },
            "goal": asdict(parse_goal_contract(self.goal_text)),
            "agents": [asdict(agent) for agent in agents],
            "plan": [asdict(task) for task in tasks],
            "tool_registry": self.registry.describe(),
            "completed_task_ids": [],
            "artifacts": [],
            "steps": [],
            "memory": {
                "observations": {},
                "attempts_by_task": {},
                "failed_once_tools": [],
                "recovery_events": [],
            },
            "verification": {
                "passed": False,
                "checks": [],
            },
        }

    def _load_state(self) -> JsonDict:
        if not os.path.exists(self.state_path):
            raise HarnessError(f"Cannot resume: state file not found at {self.state_path}", ERROR_CONFIG)
        loaded = read_json(self.state_path)
        if not isinstance(loaded, dict):
            raise HarnessError(f"Cannot resume: state file is not an object at {self.state_path}", ERROR_CONFIG)
        return loaded

    def _persist_goal(self) -> None:
        write_json(
            self.goal_path,
            {
                "run_id": self.run_id,
                "goal_hash": sha256_text(self.goal_text),
                "goal": parse_goal_contract(self.goal_text).__dict__,
                "raw_goal": self.goal_text,
            },
        )

    def _save_state(self) -> None:
        os.makedirs(self.output_dir, exist_ok=True)
        memory = self.state.setdefault("memory", {})
        memory["failed_once_tools"] = sorted(self.failed_once_tools)
        self.state["run"]["updated_at"] = utc_now_iso()
        write_json(self.state_path, self.state)

    def _wall_time_exhausted(self) -> bool:
        return (time.monotonic() - self.started_monotonic) >= float(self.budget.max_wall_seconds)

    def _next_ready_task(self) -> Optional[TaskSpec]:
        completed = set(self.state.get("completed_task_ids") or [])
        for task_dict in self.state.get("plan") or []:
            task = TaskSpec(**task_dict)
            if task.task_id in completed:
                continue
            if all(dep in completed for dep in task.depends_on):
                return task
        return None

    def _all_tasks_completed(self) -> bool:
        completed = set(self.state.get("completed_task_ids") or [])
        planned = {str(task.get("task_id")) for task in self.state.get("plan") or [] if isinstance(task, dict)}
        return bool(planned) and planned.issubset(completed)

    def _dispatch_task(self, task: TaskSpec) -> None:
        attempts = self.state.setdefault("memory", {}).setdefault("attempts_by_task", {})
        current_attempt = int(attempts.get(task.task_id) or 0) + 1
        attempts[task.task_id] = current_attempt
        step_id = f"{task.task_id}:{current_attempt}"
        started_at = utc_now_iso()
        payload = self._build_tool_payload(task, step_id)
        step = StepRecord(
            step_id=step_id,
            task_id=task.task_id,
            agent_id=task.agent_id,
            tool_name=task.tool_name,
            status="running",
            started_at=started_at,
            attempt=current_attempt,
            input_summary=summarize_payload(payload),
        )
        self.trace.record(
            "task.dispatch",
            {
                "run_id": self.run_id,
                "step_id": step_id,
                "task_id": task.task_id,
                "agent_id": task.agent_id,
                "tool_name": task.tool_name,
                "attempt": current_attempt,
                "depends_on": task.depends_on,
            },
        )
        self.trace.record(
            "tool.call",
            {
                "run_id": self.run_id,
                "step_id": step_id,
                "tool_name": task.tool_name,
                "input_summary": step.input_summary,
            },
        )

        try:
            if task.tool_name in self.fail_once_tools and task.tool_name not in self.failed_once_tools:
                self.failed_once_tools.add(task.tool_name)
                raise HarnessError(
                    f"Injected one-time failure for {task.tool_name}",
                    ERROR_RETRYABLE,
                    {"tool": task.tool_name, "injected": True},
                )
            observation = self.registry.call(task.tool_name, payload)
            step.status = "completed"
            step.ended_at = utc_now_iso()
            step.output_summary = summarize_payload(observation)
            self._record_observation(task, step, observation)
            self.trace.record(
                "tool.observation",
                {
                    "run_id": self.run_id,
                    "step_id": step_id,
                    "tool_name": task.tool_name,
                    "observation_summary": step.output_summary,
                },
            )
            self.trace.record(
                "step.complete",
                {
                    "run_id": self.run_id,
                    "step_id": step_id,
                    "task_id": task.task_id,
                    "agent_id": task.agent_id,
                    "status": step.status,
                },
            )
            self.state.setdefault("completed_task_ids", []).append(task.task_id)
            self.state.setdefault("steps", []).append(asdict(step))
            self.state["run"]["step_count"] = int(self.state["run"].get("step_count") or 0) + 1
            self._save_state()
            return
        except HarnessError as error:
            step.status = "failed"
            step.ended_at = utc_now_iso()
            step.error = {"kind": error.kind, "message": error.message, "detail": error.detail}
            self.state.setdefault("steps", []).append(asdict(step))
            self.state["run"]["step_count"] = int(self.state["run"].get("step_count") or 0) + 1
            self.trace.record(
                "step.error",
                {
                    "run_id": self.run_id,
                    "step_id": step_id,
                    "task_id": task.task_id,
                    "agent_id": task.agent_id,
                    "error": step.error,
                },
            )
            if error.kind == ERROR_RETRYABLE and current_attempt <= min(task.max_retries, self.budget.max_retries_per_task):
                recovery_event = {
                    "task_id": task.task_id,
                    "step_id": step_id,
                    "agent_id": task.agent_id,
                    "tool_name": task.tool_name,
                    "attempt": current_attempt,
                    "next_attempt": current_attempt + 1,
                    "strategy": "bounded_retry",
                    "error": step.error,
                }
                self.state.setdefault("memory", {}).setdefault("recovery_events", []).append(recovery_event)
                self.trace.record("recovery.retry", {"run_id": self.run_id, **recovery_event})
                self._save_state()
                return
            self._save_state()
            raise

    def _build_tool_payload(self, task: TaskSpec, step_id: str) -> JsonDict:
        memory = self.state.setdefault("memory", {}).setdefault("observations", {})
        common = {
            "run_id": self.run_id,
            "step_id": step_id,
            "output_dir": self.output_dir,
            "artifacts_dir": self.artifacts_dir,
            "state": self.state,
        }
        if task.tool_name == "workspace.inspect":
            return {
                **common,
                "input_path": self.input_path or str(self.state.get("run", {}).get("input_path") or ""),
                "goal_text": self.goal_text,
            }
        if task.tool_name == "text.generate.mock":
            return {**common, "inspection": memory.get("inspect_goal") or {}}
        if task.tool_name == "image.generate.mock":
            return {**common, "text_plan": memory.get("generate_text") or {}}
        if task.tool_name == "video.generate.mock":
            return {
                **common,
                "text_plan": memory.get("generate_text") or {},
                "image_result": memory.get("generate_image") or {},
            }
        if task.tool_name == "canvas.write":
            return {
                **common,
                "inspection": memory.get("inspect_goal") or {},
                "text_plan": memory.get("generate_text") or {},
                "image_result": memory.get("generate_image") or {},
                "video_result": memory.get("generate_video") or {},
            }
        if task.tool_name == "judge.verify":
            return {**common, "canvas_result": memory.get("compose_canvas") or {}}
        if task.tool_name == "artifact.export_report":
            return {**common, "verification": memory.get("verify_outputs") or {}}
        raise HarnessError(f"No payload builder for tool {task.tool_name}", ERROR_FATAL)

    def _record_observation(self, task: TaskSpec, step: StepRecord, observation: JsonDict) -> None:
        observations = self.state.setdefault("memory", {}).setdefault("observations", {})
        observations[task.task_id] = observation
        for artifact in observation.get("artifacts") or []:
            if not isinstance(artifact, dict):
                continue
            normalized = {
                "artifact_id": str(artifact.get("artifact_id") or f"{task.task_id}:artifact"),
                "kind": str(artifact.get("kind") or "artifact"),
                "path": str(artifact.get("path") or ""),
                "media_type": str(artifact.get("media_type") or "application/octet-stream"),
                "source_step_id": str(artifact.get("source_step_id") or step.step_id),
                "metadata": artifact.get("metadata") if isinstance(artifact.get("metadata"), dict) else {},
            }
            if normalized["path"]:
                self.state.setdefault("artifacts", []).append(normalized)
        if task.task_id == "verify_outputs":
            verification = observation.get("verification")
            if isinstance(verification, dict):
                self.state["verification"] = verification

    def _terminate(self, status: str, reason: str) -> JsonDict:
        self.state["run"]["status"] = status
        self.state["run"]["ended_at"] = utc_now_iso()
        self.state["run"]["termination_reason"] = reason
        if any(
            isinstance(artifact, dict) and artifact.get("artifact_id") == "final_report"
            for artifact in (self.state.get("artifacts") or [])
        ):
            write_text(
                self.report_path,
                render_final_report(
                    state=self.state,
                    verification=self.state.get("verification") if isinstance(self.state.get("verification"), dict) else {},
                    output_dir=self.output_dir,
                ),
            )
        self._save_state()
        self.trace.record(
            "run.terminate",
            {
                "run_id": self.run_id,
                "status": status,
                "termination_reason": reason,
                "artifact_count": len(self.state.get("artifacts") or []),
                "completed_task_ids": self.state.get("completed_task_ids") or [],
                "verification": self.state.get("verification") or {},
            },
        )
        return self.state


def build_agent_contracts() -> List[AgentContract]:
    return [
        AgentContract(
            "planner",
            "Normalize the goal, inspect constraints, and produce the active run plan.",
            ["workspace.inspect"],
            "run",
            "goal, input snapshot, tool inventory",
            "input profile persisted",
        ),
        AgentContract(
            "text_worker",
            "Turn the brief into a scene plan, captions, narration, and media prompts.",
            ["text.generate.mock"],
            "run",
            "text plan artifacts",
            "scene plan persisted",
        ),
        AgentContract(
            "image_worker",
            "Generate or mock a reference image from the scene plan.",
            ["image.generate.mock"],
            "run",
            "image artifacts",
            "image artifact persisted",
        ),
        AgentContract(
            "video_worker",
            "Generate or mock a video artifact from the scene plan and reference image.",
            ["video.generate.mock"],
            "run",
            "video artifacts",
            "video artifact persisted",
        ),
        AgentContract(
            "canvas_worker",
            "Compose a typed canvas graph with media nodes, dependencies, and provenance.",
            ["canvas.write"],
            "run",
            "canvas graph artifacts",
            "canvas graph persisted",
        ),
        AgentContract(
            "verifier",
            "Judge trace completeness, artifact integrity, canvas topology, and stop criteria.",
            ["judge.verify"],
            "run",
            "verification result",
            "all hard checks passed or blocker recorded",
        ),
        AgentContract(
            "synthesizer",
            "Write the final report with artifact links, recovery events, and termination evidence.",
            ["artifact.export_report"],
            "run",
            "final report",
            "report persisted",
        ),
    ]


def build_plan() -> List[TaskSpec]:
    return [
        TaskSpec("inspect_goal", "Inspect goal, input brief, and tool capabilities", "planner", "workspace.inspect"),
        TaskSpec("generate_text", "Generate text plan and media prompts", "text_worker", "text.generate.mock", ["inspect_goal"]),
        TaskSpec("generate_image", "Generate reference image", "image_worker", "image.generate.mock", ["generate_text"]),
        TaskSpec("generate_video", "Generate storyboard video", "video_worker", "video.generate.mock", ["generate_text", "generate_image"]),
        TaskSpec(
            "compose_canvas",
            "Compose rich media canvas graph",
            "canvas_worker",
            "canvas.write",
            ["inspect_goal", "generate_text", "generate_image", "generate_video"],
        ),
        TaskSpec("verify_outputs", "Verify artifacts, trace, canvas, and neutrality posture", "verifier", "judge.verify", ["compose_canvas"]),
        TaskSpec("synthesize_report", "Export final run report", "synthesizer", "artifact.export_report", ["verify_outputs"], terminal=True),
    ]


def parse_goal_contract(goal_text: str) -> GoalSpec:
    constraints: List[str] = []
    output_contract: List[str] = []
    quality_bar: List[str] = []
    stop_rules: List[str] = []
    for line in goal_text.splitlines():
        stripped = line.strip()
        if not stripped.startswith("- "):
            continue
        item = stripped[2:].strip()
        lower = item.lower()
        if "must" in lower or "do not" in lower or "forbid" in lower or "neutral" in lower:
            constraints.append(item)
        if "artifact" in lower or "report" in lower or "canvas" in lower or "trace" in lower:
            output_contract.append(item)
        if "verify" in lower or "validation" in lower or "test" in lower or "quality" in lower:
            quality_bar.append(item)
        if "stop" in lower or "terminate" in lower or "complete only when" in lower:
            stop_rules.append(item)
    return GoalSpec(
        intent="Build and run a Codex-compatible super-agent harness for rich media canvas generation.",
        constraints=constraints[:12],
        output_contract=output_contract[:12],
        quality_bar=quality_bar[:12],
        stop_rules=stop_rules[:12]
        or [
            "Stop when acceptance criteria pass.",
            "Stop when an irrecoverable blocker is recorded.",
            "Stop when configured budgets are exhausted.",
        ],
    )


def build_default_tool_registry(harness: SuperAgentHarness) -> ToolRegistry:
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
            edge.setdefault("properties", {})["layoutRoute"] = {
                "frame": BALANCED_LAYOUT_ID,
                "strategy": "fan-in-readable",
                "sourceAnchor": "bottom",
                "targetAnchor": "top",
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


def split_frontmatter(text: str) -> Tuple[JsonDict, str]:
    raw = text.replace("\r\n", "\n").replace("\r", "\n")
    match = re.match(r"^\s*---\n([\s\S]*?)\n---\s*(?:\n|$)([\s\S]*)$", raw)
    if not match:
        return {}, raw
    fm_text, body = match.group(1), match.group(2)
    if yaml is None:
        return {}, body
    try:
        parsed = yaml.safe_load(fm_text) or {}
        return parsed if isinstance(parsed, dict) else {}, body
    except Exception:
        return {}, body


def infer_title(frontmatter: JsonDict, body: str, input_path: str) -> str:
    title = frontmatter.get("title")
    if isinstance(title, str) and title.strip():
        return title.strip()
    for line in body.splitlines():
        stripped = line.strip()
        if stripped.startswith("# "):
            return stripped[2:].strip()
    return os.path.splitext(os.path.basename(input_path))[0] or "Untitled brief"


def derive_scenes(frontmatter: JsonDict, body: str) -> List[JsonDict]:
    input_fields = frontmatter.get("inputs") if isinstance(frontmatter.get("inputs"), dict) else {}
    source_candidates = [
        input_fields.get("script") if isinstance(input_fields.get("script"), str) else "",
        input_fields.get("theme") if isinstance(input_fields.get("theme"), str) else "",
        body,
    ]
    source = "\n".join([s for s in source_candidates if s and s.strip()]).strip()
    lines = [normalize_space(line) for line in source.splitlines() if normalize_space(line)]
    scene_lines = [line for line in lines if len(line) > 12]
    if not scene_lines:
        paragraphs = [normalize_space(p) for p in re.split(r"\n\s*\n", body) if normalize_space(p)]
        scene_lines = paragraphs
    if not scene_lines:
        scene_lines = ["A neutral concept moves from brief to generated media on a canvas."]
    scene_lines = scene_lines[:6]

    scenes: List[JsonDict] = []
    for index, line in enumerate(scene_lines, start=1):
        title = extract_scene_title(line, index)
        scenes.append({"title": title, "summary": clip_sentence(line, 300), "source": line})
    return scenes


def extract_scene_title(line: str, index: int) -> str:
    normalized = normalize_space(line)
    if " — " in normalized:
        candidate = normalized.split(" — ", 1)[0]
    elif " - " in normalized:
        candidate = normalized.split(" - ", 1)[0]
    elif ":" in normalized and normalized.index(":") < 50:
        candidate = normalized.split(":", 1)[0]
    else:
        words = normalized.split()
        candidate = " ".join(words[:5])
    candidate = candidate.strip(" #.-")
    return candidate or f"Scene {index}"


def render_scene_plan_markdown(plan: JsonDict) -> str:
    lines = [f"# Rich Media Plan: {plan.get('title') or 'Untitled'}", "", f"Provider: `{plan.get('provider')}`", ""]
    scenes = plan.get("scenes") if isinstance(plan.get("scenes"), list) else []
    for scene in scenes:
        if not isinstance(scene, dict):
            continue
        lines.extend(
            [
                f"## {scene.get('title') or scene.get('scene_id')}",
                "",
                f"Caption: {scene.get('caption') or ''}",
                "",
                f"Narration: {scene.get('narration') or ''}",
                "",
                f"Image prompt: {scene.get('image_prompt') or ''}",
                "",
                f"Video prompt: {scene.get('video_prompt') or ''}",
                "",
            ]
        )
    return "\n".join(lines).rstrip() + "\n"


def first_scene_value(plan: JsonDict, key: str) -> str:
    scenes = plan.get("scenes") if isinstance(plan.get("scenes"), list) else []
    if scenes and isinstance(scenes[0], dict):
        return str(scenes[0].get(key) or "")
    return ""


def build_text_widget_output(plan: JsonDict, text_plan_path: str) -> str:
    title = str(plan.get("title") or "Rich media plan")
    scenes = [scene for scene in (plan.get("scenes") or []) if isinstance(scene, dict)]
    lines = [f"# {title}", "", f"Generated {len(scenes)} scene(s) for text, image, and video orchestration."]
    for scene in scenes[:4]:
        caption = str(scene.get("caption") or scene.get("summary") or "")
        lines.append(f"- {caption}")
    if text_plan_path:
        lines.extend(["", f"Scene plan artifact: `{text_plan_path}`"])
    return "\n".join(lines).strip()


def render_text_output_src_doc(plan: JsonDict) -> str:
    title = html.escape(str(plan.get("title") or "Rich media plan"))
    scenes = [scene for scene in (plan.get("scenes") or []) if isinstance(scene, dict)]
    items = []
    for scene in scenes[:4]:
        label = html.escape(str(scene.get("title") or scene.get("scene_id") or "Scene"))
        body = html.escape(clip_sentence(str(scene.get("summary") or scene.get("caption") or ""), 180))
        items.append(f"<li><strong>{label}</strong><span>{body}</span></li>")
    return (
        "<article>"
        f"<h1>{title}</h1>"
        "<p>Deterministic super-agent text output for the Rich Media Panel.</p>"
        f"<ol>{''.join(items)}</ol>"
        "</article>"
    )


def yaml_inline_string(value: str) -> str:
    return json.dumps(str(value or ""), ensure_ascii=False)


def yaml_typed_string(key: str, value: str) -> str:
    return f"{{key: {key}, type: string, value: {yaml_inline_string(value)}}}"


def render_workspace_flow_markdown(
    *,
    run_id: str,
    title: str,
    text_output: str,
    text_output_src_doc: str,
    text_prompt: str,
    image_prompt: str,
    image_url: str,
    video_prompt: str,
    video_url: str,
    source_name: str,
    source_hash: str,
) -> str:
    def flow_position_line(node_id: str) -> str:
        layout = balanced_layout_entry(node_id)
        return f'      position: {{key: position, type: object, value: {{x: {int(layout["x"])}, y: {int(layout["y"])}}}}}'

    def flow_visual_lines(node_id: str) -> List[str]:
        layout = balanced_layout_entry(node_id)
        return [
            f'      "visual:width": {{key: visual:width, type: number, value: {int(layout["width"])}}}',
            f'      "visual:height": {{key: visual:height, type: number, value: {int(layout["height"])}}}',
            f'      layoutRole: {{key: layoutRole, type: string, value: "{str(layout["role"])}"}}',
        ]

    lines = [
        "---",
        'kgCanvasSurfaceMode: "2d"',
        'kgCanvas2dRenderer: "flowEditor"',
        'kgDocumentSemanticMode: "document"',
        "kgFrontmatterModeEnabled: true",
        f"kgSuperAgentRunId: {yaml_inline_string(run_id)}",
        f"kgSuperAgentSurfaceRoute: {yaml_inline_string(RICH_MEDIA_SURFACE_ROUTE)}",
        "kgSuperAgentLayout:",
        f"  id: {yaml_inline_string(BALANCED_LAYOUT_ID)}",
        "  label: \"Balanced 16:9\"",
        "  width: 1920",
        "  height: 1080",
        "  aspectRatio: \"16:9\"",
        "frontmatterFlowSettings:",
        "  direction: LR",
        "  edgeType: smoothstep",
        "  balancedViewportPreset: widgetFrontmatter",
        "  balancedHeroRowCount: 3",
        "  balancedHeroRowGapScale: 0.76",
        "  balancedPanelOffsetScale: 0.96",
        "flow:",
        "  direction: LR",
        "  edgeType: smoothstep",
        "  nodes:",
        '    - id: {key: id, type: string, value: "w-text-plan"}',
        '      type: {key: type, type: string, value: "TextGeneration"}',
        '      label: {key: label, type: string, value: "Generated Text Plan"}',
        flow_position_line("text-plan"),
        *flow_visual_lines("text-plan"),
        '      handles: {key: handles, type: object, value: {target: ["prompt_in"], source: ["text_out"]}}',
        '      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "textGeneration"}',
        f"      prompt: {yaml_typed_string('prompt', text_prompt)}",
        f"      output: {yaml_typed_string('output', text_output)}",
        f"      outputSrcDoc: {yaml_typed_string('outputSrcDoc', text_output_src_doc)}",
        '    - id: {key: id, type: string, value: "w-image-reference"}',
        '      type: {key: type, type: string, value: "ImageGeneration"}',
        '      label: {key: label, type: string, value: "Generated Reference Image"}',
        flow_position_line("image-reference"),
        *flow_visual_lines("image-reference"),
        '      handles: {key: handles, type: object, value: {target: ["reference_image"], source: ["imageUrl"]}}',
        '      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "imageGeneration"}',
        f"      prompt: {yaml_typed_string('prompt', image_prompt)}",
        f"      imageUrl: {yaml_typed_string('imageUrl', image_url)}",
        '    - id: {key: id, type: string, value: "w-video-storyboard"}',
        '      type: {key: type, type: string, value: "VideoGeneration"}',
        '      label: {key: label, type: string, value: "Generated Storyboard Video"}',
        flow_position_line("video-storyboard"),
        *flow_visual_lines("video-storyboard"),
        '      handles: {key: handles, type: object, value: {target: ["reference_image"], source: ["videoUrl"]}}',
        '      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "videoGeneration"}',
        f"      prompt: {yaml_typed_string('prompt', video_prompt)}",
        f"      videoUrl: {yaml_typed_string('videoUrl', video_url)}",
        '    - id: {key: id, type: string, value: "p-rich-media"}',
        '      type: {key: type, type: string, value: "RichMediaPanel"}',
        '      label: {key: label, type: string, value: "Rich Media Panel"}',
        flow_position_line("rich-media-panel"),
        *flow_visual_lines("rich-media-panel"),
        '      handles: {key: handles, type: object, value: {target: ["output","imageUrl","videoUrl"], source: []}}',
        '      "flow:widgetFormId": {key: flow:widgetFormId, type: string, value: "richMediaPanel"}',
        '      richMediaActiveTab: {key: richMediaActiveTab, type: string, value: "auto"}',
        "  edges:",
        f'    - {{ id: e-text-panel, source: w-text-plan, sourceHandle: text_out, target: p-rich-media, targetHandle: output, animated: true, layoutRoute: "{BALANCED_LAYOUT_ID}:fan-in-readable" }}',
        f'    - {{ id: e-image-panel, source: w-image-reference, sourceHandle: imageUrl, target: p-rich-media, targetHandle: imageUrl, animated: true, layoutRoute: "{BALANCED_LAYOUT_ID}:fan-in-readable" }}',
        f'    - {{ id: e-video-panel, source: w-video-storyboard, sourceHandle: videoUrl, target: p-rich-media, targetHandle: videoUrl, animated: true, layoutRoute: "{BALANCED_LAYOUT_ID}:fan-in-readable" }}',
        "---",
        "",
        f"# {title}",
        "",
        "This file is a generated Knowgrph frontmatter-flow workspace for the rich media pipeline.",
        "",
        f"- Run id: `{run_id}`",
        f"- Source: `{source_name}`",
        f"- Source hash: `{source_hash}`",
        f"- Surface route: `{RICH_MEDIA_SURFACE_ROUTE}`",
        "",
    ]
    return "\n".join(lines)


def render_mock_image_svg(*, title: str, scene_title: str, prompt: str, palette: Tuple[str, str]) -> str:
    safe_title = html.escape(clip_sentence(title, 80))
    safe_scene = html.escape(clip_sentence(scene_title, 80))
    safe_prompt = html.escape(clip_sentence(prompt, 180))
    bg, accent = palette
    return f"""<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720" role="img" aria-label="{safe_title}">
  <defs>
    <linearGradient id="kg" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0" stop-color="{bg}"/>
      <stop offset="1" stop-color="#f7f4ea"/>
    </linearGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#kg)"/>
  <rect x="72" y="72" width="1136" height="576" rx="22" fill="rgba(255,255,255,0.72)" stroke="{accent}" stroke-width="8"/>
  <circle cx="1040" cy="180" r="82" fill="{accent}" opacity="0.86"/>
  <path d="M120 560 C280 420 380 470 520 350 S820 280 1160 520" fill="none" stroke="{accent}" stroke-width="20" opacity="0.45"/>
  <text x="120" y="170" font-family="Arial, sans-serif" font-size="48" font-weight="700" fill="#172026">{safe_scene}</text>
  <foreignObject x="120" y="220" width="980" height="260">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family: Arial, sans-serif; font-size: 30px; line-height: 1.28; color: #172026;">{safe_prompt}</div>
  </foreignObject>
  <text x="120" y="620" font-family="Arial, sans-serif" font-size="24" fill="#44515a">deterministic mock image artifact</text>
</svg>
"""


def render_mock_video_html(video_plan: JsonDict) -> str:
    scenes = [s for s in (video_plan.get("scenes") or []) if isinstance(s, dict)]
    title = html.escape(str(video_plan.get("title") or "Storyboard video"))
    blocks = []
    for index, scene in enumerate(scenes[:6], start=1):
        blocks.append(
            f"""<section class="scene" style="--i:{index}">
  <strong>{html.escape(str(scene.get("title") or f"Scene {index}"))}</strong>
  <p>{html.escape(clip_sentence(str(scene.get("video_prompt") or scene.get("summary") or ""), 220))}</p>
</section>"""
        )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title}</title>
  <style>
    body {{ margin: 0; min-height: 100vh; background: #101820; color: #f8f5ef; font-family: Arial, sans-serif; display: grid; place-items: center; }}
    main {{ width: min(440px, 92vw); aspect-ratio: 9 / 16; background: #1f3142; border: 1px solid #5fb3a4; overflow: hidden; position: relative; box-shadow: 0 22px 80px rgba(0,0,0,.35); }}
    h1 {{ font-size: 22px; line-height: 1.1; margin: 20px; position: relative; z-index: 2; }}
    .scene {{ position: absolute; inset: 80px 20px 32px; padding: 20px; border: 1px solid rgba(255,255,255,.28); background: rgba(255,255,255,.10); opacity: 0; transform: translateY(24px); animation: show 18s infinite; animation-delay: calc((var(--i) - 1) * 3s); }}
    .scene strong {{ display: block; font-size: 24px; margin-bottom: 12px; }}
    .scene p {{ font-size: 18px; line-height: 1.35; }}
    main::before {{ content: ""; position: absolute; width: 360px; height: 360px; border-radius: 999px; background: #79d2c0; filter: blur(18px); opacity: .35; left: -80px; top: 260px; animation: drift 9s infinite alternate; }}
    @keyframes show {{ 0%, 12% {{ opacity: 0; transform: translateY(24px); }} 16%, 30% {{ opacity: 1; transform: translateY(0); }} 36%, 100% {{ opacity: 0; transform: translateY(-18px); }} }}
    @keyframes drift {{ from {{ transform: translateX(0) scale(1); }} to {{ transform: translateX(140px) scale(1.2); }} }}
  </style>
</head>
<body>
  <main aria-label="Mock video storyboard">
    <h1>{title}</h1>
    {''.join(blocks)}
  </main>
</body>
</html>
"""


def render_canvas_preview_html(graph: JsonDict) -> str:
    nodes = [n for n in graph.get("nodes", []) if isinstance(n, dict)]
    cards = []
    for node in nodes:
        props = node.get("properties") if isinstance(node.get("properties"), dict) else {}
        media = str(props.get("imageUrl") or props.get("videoUrl") or props.get("outputPath") or "")
        media_link = f'<a href="{html.escape(media)}">{html.escape(os.path.basename(media))}</a>' if media else ""
        cards.append(
            f"""<article>
  <h2>{html.escape(str(node.get("label") or node.get("id") or ""))}</h2>
  <p>{html.escape(str(node.get("type") or ""))}</p>
  {media_link}
</article>"""
        )
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Super-agent Canvas Preview</title>
  <style>
    body {{ margin: 0; font-family: Arial, sans-serif; color: #162026; background: #f5f3ec; }}
    main {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; padding: 16px; }}
    article {{ min-height: 120px; border: 1px solid #8ba49b; background: #fffdf8; padding: 14px; }}
    h1 {{ font-size: 24px; margin: 16px 16px 0; }}
    h2 {{ font-size: 17px; margin: 0 0 8px; }}
    p {{ color: #4c5b60; }}
  </style>
</head>
<body>
  <h1>Super-agent Canvas Preview</h1>
  <main>{''.join(cards)}</main>
</body>
</html>
"""


def render_final_report(*, state: JsonDict, verification: JsonDict, output_dir: str) -> str:
    run = state.get("run") if isinstance(state.get("run"), dict) else {}
    artifacts = [a for a in (state.get("artifacts") or []) if isinstance(a, dict)]
    recovery_events = state.get("memory", {}).get("recovery_events", []) if isinstance(state.get("memory"), dict) else []
    verification_payload = verification.get("verification") if isinstance(verification.get("verification"), dict) else verification
    lines = [
        "# Super-Agent Harness Run Report",
        "",
        f"- Run id: `{run.get('run_id')}`",
        f"- Status: `{run.get('status')}`",
        f"- Termination: `{run.get('termination_reason')}`",
        f"- Provider mode: `{run.get('provider_mode')}`",
        f"- Step count: `{run.get('step_count')}`",
        f"- Verification passed: `{bool(verification_payload.get('passed'))}`",
        f"- App surface route: `{RICH_MEDIA_SURFACE_ROUTE}`",
        "",
        "## Completed Tasks",
        "",
    ]
    for task_id in state.get("completed_task_ids") or []:
        lines.append(f"- `{task_id}`")
    lines.extend(["", "## Artifacts", ""])
    for artifact in artifacts:
        path = str(artifact.get("path") or "")
        display = os.path.relpath(path, output_dir) if path and os.path.isabs(path) else path
        lines.append(f"- `{artifact.get('kind')}` `{artifact.get('artifact_id')}`: `{display}`")
    lines.extend(["", "## Verification Checks", ""])
    checks = verification_payload.get("checks") if isinstance(verification_payload.get("checks"), list) else []
    for check in checks:
        if not isinstance(check, dict):
            continue
        mark = "pass" if check.get("passed") else "fail"
        lines.append(f"- `{mark}` `{check.get('id')}`")
    lines.extend(["", "## Recovery Events", ""])
    if recovery_events:
        for event in recovery_events:
            if isinstance(event, dict):
                lines.append(f"- `{event.get('strategy')}` for `{event.get('task_id')}` after attempt `{event.get('attempt')}`")
    else:
        lines.append("- None")
    lines.extend(
        [
            "",
            "## Rerun",
            "",
            "```bash",
            "python3 -m knowgrph_parser superagent --input <brief.md> --output-dir <run-output-dir>",
            "```",
            "",
        ]
    )
    return "\n".join(lines)


def graph_node(node_id: str, label: str, node_type: str, x: int, y: int, properties: JsonDict) -> JsonDict:
    return {
        "id": node_id,
        "label": label,
        "type": node_type,
        "x": x,
        "y": y,
        "properties": properties,
        "metadata": {"provenance": {"generatedBy": "superagent_harness"}},
    }


def graph_edge(
    edge_id: str,
    source: str,
    target: str,
    label: str,
    source_handle: str = "",
    target_handle: str = "",
) -> JsonDict:
    edge: JsonDict = {"id": edge_id, "source": source, "target": target, "label": label, "type": "provenance", "properties": {}}
    if source_handle:
        edge["sourceHandle"] = source_handle
        edge["properties"]["sourcePort"] = source_handle
    if target_handle:
        edge["targetHandle"] = target_handle
        edge["properties"]["targetPort"] = target_handle
    return edge


def artifact_record(
    artifact_id: str,
    kind: str,
    path: str,
    media_type: str,
    source_step_id: str,
    metadata: Optional[JsonDict] = None,
) -> JsonDict:
    return asdict(ArtifactRecord(artifact_id, kind, path, media_type, source_step_id, metadata or {}))


def artifact_path_by_id(observation: JsonDict, artifact_id: str) -> str:
    for artifact in observation.get("artifacts") or []:
        if isinstance(artifact, dict) and artifact.get("artifact_id") == artifact_id:
            return str(artifact.get("path") or "")
    return ""


def balanced_layout_entry(node_id: str) -> JsonDict:
    raw = BALANCED_WIDGET_LAYOUT.get(node_id) or {"x": 0, "y": 0, "width": 320, "height": 180, "role": "node"}
    return dict(raw)


def balanced_layout_props(node_id: str, properties: JsonDict) -> JsonDict:
    layout = balanced_layout_entry(node_id)
    next_props = dict(properties)
    next_props.setdefault("layoutFrame", BALANCED_LAYOUT_ID)
    next_props.setdefault("layoutRole", str(layout.get("role") or "node"))
    next_props.setdefault("visual:width", int(layout.get("width") or 320))
    next_props.setdefault("visual:height", int(layout.get("height") or 180))
    return next_props


def balanced_layout_metadata() -> JsonDict:
    return {
        "frame": dict(BALANCED_LAYOUT_FRAME),
        "nodes": {node_id: dict(layout) for node_id, layout in BALANCED_WIDGET_LAYOUT.items()},
        "edgeRouting": {
            "strategy": "fan-in-readable",
            "sourceAnchor": "bottom",
            "targetAnchor": "top",
            "edgeIds": sorted(RICH_MEDIA_PANEL_EDGE_IDS),
        },
    }


def read_trace_events(trace_path: str) -> List[JsonDict]:
    events: List[JsonDict] = []
    if not os.path.exists(trace_path):
        return events
    with open(trace_path, "r", encoding="utf-8") as handle:
        for line in handle:
            line = line.strip()
            if not line:
                continue
            try:
                value = json.loads(line)
                if isinstance(value, dict):
                    events.append(value)
            except Exception:
                continue
    return events


def _matches_json_type(value: Any, type_name: str) -> bool:
    if type_name == "string":
        return isinstance(value, str)
    if type_name == "object":
        return isinstance(value, dict)
    if type_name == "array":
        return isinstance(value, list)
    if type_name == "number":
        return isinstance(value, (int, float)) and not isinstance(value, bool)
    if type_name == "boolean":
        return isinstance(value, bool)
    return True


def summarize_payload(payload: Any, *, depth: int = 0) -> Any:
    if depth > 2:
        return summarize_scalar(payload)
    if isinstance(payload, dict):
        out: JsonDict = {}
        for key, value in list(payload.items())[:18]:
            if key in {"brief_text", "body", "goal_text"}:
                out[key] = {"chars": len(str(value)), "sha256": sha256_text(str(value))[:12]}
            elif key == "state":
                out[key] = {
                    "run_id": str(value.get("run", {}).get("run_id") if isinstance(value, dict) else ""),
                    "completed": len(value.get("completed_task_ids") or []) if isinstance(value, dict) else 0,
                }
            else:
                out[key] = summarize_payload(value, depth=depth + 1)
        return out
    if isinstance(payload, list):
        return [summarize_payload(item, depth=depth + 1) for item in payload[:8]]
    return summarize_scalar(payload)


def summarize_scalar(value: Any) -> Any:
    if isinstance(value, str):
        if len(value) > 160:
            return {"chars": len(value), "prefix": value[:80], "sha256": sha256_text(value)[:12]}
        return value
    if isinstance(value, (int, float, bool)) or value is None:
        return value
    return str(type(value).__name__)


def normalize_space(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def clip_sentence(value: str, limit: int) -> str:
    text = normalize_space(value)
    if len(text) <= limit:
        return text
    return text[: max(0, limit - 1)].rstrip() + "..."


def color_pair_from_text(text: str) -> Tuple[str, str]:
    digest = sha256_text(text)
    colors = ["#79c2a8", "#e6b85c", "#83a6d6", "#d9878b", "#9fbf70", "#c59bd8"]
    accents = ["#126b5b", "#8a5b10", "#2f5f9f", "#93434c", "#557a21", "#754d91"]
    idx = int(digest[:2], 16) % len(colors)
    return colors[idx], accents[idx]


def default_output_dir(base_dir: str, run_id: str) -> str:
    return os.path.join(base_dir, "data", "superagent-runs", run_id)


def build_run_id(input_path: Optional[str], goal_text: str, provided: str = "") -> str:
    if provided.strip():
        return slugify(provided)
    seed = f"{input_path or ''}:{sha256_text(goal_text)[:16]}:{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}"
    return f"run-{datetime.now(timezone.utc).strftime('%Y%m%d%H%M%S')}-{sha256_text(seed)[:8]}"


def load_goal_text(goal_file: str, base_dir: str) -> str:
    if goal_file.strip():
        path = os.path.abspath(goal_file)
    else:
        path = os.path.join(base_dir, "goal")
    if os.path.exists(path):
        return read_text(path)
    return "Build and run a universal super-agent harness for rich media canvas generation."


def run_harness(
    *,
    input_path: Optional[str],
    output_dir: str,
    goal_text: str,
    run_id: str,
    budget: Optional[RunBudget] = None,
    provider_mode: str = "mock",
    resume: bool = False,
    stop_after_step: int = 0,
    fail_once_tools: Optional[Iterable[str]] = None,
) -> JsonDict:
    harness = SuperAgentHarness(
        input_path=input_path,
        output_dir=output_dir,
        goal_text=goal_text,
        run_id=run_id,
        budget=budget or RunBudget(),
        provider_mode=provider_mode,
        resume=resume,
        stop_after_step=stop_after_step,
        fail_once_tools=fail_once_tools,
    )
    return harness.run()


def main(argv: Optional[Sequence[str]] = None, *, base_dir: Optional[str] = None) -> int:
    parser = argparse.ArgumentParser(description="Run the Knowgrph Codex-compatible super-agent harness.")
    parser.add_argument("--input", default="", help="Path to a markdown or text brief. Required unless --resume is used.")
    parser.add_argument("--goal-file", default="", help="Path to the goal contract. Defaults to ./goal when present.")
    parser.add_argument("--output-dir", default="", help="Directory for state, trace, and artifacts.")
    parser.add_argument("--run-id", default="", help="Stable run id. Defaults to a timestamped id.")
    parser.add_argument("--provider-mode", default="mock", choices=["mock"], help="Media provider mode. Baseline supports deterministic mock.")
    parser.add_argument("--resume", action="store_true", help="Resume from output-dir/state.json.")
    parser.add_argument("--stop-after-step", type=int, default=0, help="Checkpoint after N completed tasks, then stop as interrupted.")
    parser.add_argument("--fail-once", action="append", default=[], help="Inject one retryable failure for the named tool.")
    parser.add_argument("--max-steps", type=int, default=80, help="Maximum recorded steps.")
    parser.add_argument("--max-retries", type=int, default=2, help="Maximum retries per task.")
    parser.add_argument("--max-wall-seconds", type=int, default=900, help="Maximum wall time.")
    parser.add_argument("--print-summary", action="store_true", help="Print a compact JSON summary.")
    args = parser.parse_args(list(argv) if argv is not None else None)

    root = os.path.abspath(base_dir or os.getcwd())
    goal_text = load_goal_text(str(args.goal_file or ""), root)
    run_id = build_run_id(str(args.input or ""), goal_text, str(args.run_id or ""))
    output_dir = os.path.abspath(str(args.output_dir or "") or default_output_dir(root, run_id))
    if args.resume and not args.output_dir:
        print("--resume requires --output-dir", file=sys.stderr)
        return 2
    if not args.resume and not str(args.input or "").strip():
        print("--input is required unless --resume is used", file=sys.stderr)
        return 2
    if args.resume:
        state = read_json(os.path.join(output_dir, "state.json"))
        if isinstance(state, dict):
            run_id = str(state.get("run", {}).get("run_id") or run_id)

    try:
        state = run_harness(
            input_path=str(args.input or "") or None,
            output_dir=output_dir,
            goal_text=goal_text,
            run_id=run_id,
            budget=RunBudget(
                max_steps=int(args.max_steps),
                max_retries_per_task=int(args.max_retries),
                max_wall_seconds=int(args.max_wall_seconds),
            ),
            provider_mode=str(args.provider_mode),
            resume=bool(args.resume),
            stop_after_step=int(args.stop_after_step or 0),
            fail_once_tools=list(args.fail_once or []),
        )
    except HarnessError as error:
        print(f"superagent: {error.kind}: {error.message}", file=sys.stderr)
        if error.detail:
            print(json.dumps(error.detail, indent=2, ensure_ascii=False), file=sys.stderr)
        return 1

    summary = {
        "run_id": state.get("run", {}).get("run_id"),
        "status": state.get("run", {}).get("status"),
        "termination_reason": state.get("run", {}).get("termination_reason"),
        "output_dir": output_dir,
        "trace": os.path.join(output_dir, "trace.jsonl"),
        "state": os.path.join(output_dir, "state.json"),
        "report": os.path.join(output_dir, "final-report.md"),
        "verification_passed": bool(state.get("verification", {}).get("passed")),
        "artifact_count": len(state.get("artifacts") or []),
    }
    if args.print_summary or True:
        print(json.dumps(summary, indent=2, ensure_ascii=False))
    return 0 if summary["status"] in {"completed", "interrupted"} else 3


if __name__ == "__main__":
    raise SystemExit(main())
