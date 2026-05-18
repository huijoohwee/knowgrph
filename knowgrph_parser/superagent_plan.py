from typing import List

from .superagent_contracts import AgentContract, GoalSpec, TaskSpec

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
