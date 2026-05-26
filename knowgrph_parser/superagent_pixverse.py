import json
import os
import select
import struct
import subprocess
import time
import zlib
from typing import Any, Dict, Iterable, List, Optional, Sequence

from .common import write_json, write_text
from .superagent_contracts import ERROR_CONFIG, ERROR_RETRYABLE, HarnessError, JsonDict

PIXVERSE_PROTOCOL_VERSION = "2025-06-18"
PIXVERSE_DEFAULT_COMMAND = "uvx"
PIXVERSE_DEFAULT_ARGS = ("pixverse-mcp",)
PIXVERSE_DEFAULT_MODEL = "v5"
PIXVERSE_DEFAULT_DURATION = 5
PIXVERSE_DEFAULT_ASPECT_RATIO = "16:9"
PIXVERSE_DEFAULT_QUALITY = "540p"
PIXVERSE_DEFAULT_MOTION_MODE = "normal"
PIXVERSE_DEFAULT_POLL_INTERVAL_SECONDS = 6
PIXVERSE_DEFAULT_MAX_ATTEMPTS = 20
PIXVERSE_DEFAULT_TIMEOUT_SECONDS = 30
PIXVERSE_DEFAULT_STRATEGY = "auto"
PIXVERSE_DEFAULT_SOUND_EFFECT_TOOL = "sound_effect_video"
PIXVERSE_DEFAULT_LIP_SYNC_TOOL = "lip_sync_video"
PIXVERSE_DEFAULT_FUSION_TOOL = "fusion_video"
PIXVERSE_DEFAULT_UPLOAD_IMAGE_TOOL = "upload_image"
PIXVERSE_DEFAULT_UPLOAD_VIDEO_TOOL = "upload_video"
PIXVERSE_DEFAULT_UPLOAD_AUDIO_TOOL_CANDIDATES = ("upload_audio", "upload_media")


def _read_env_json_list(name: str, fallback: Sequence[str]) -> List[str]:
    raw = str(os.getenv(name, "") or "").strip()
    if not raw:
        return list(fallback)
    try:
        parsed = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise HarnessError(f"{name} must be valid JSON array text", ERROR_CONFIG, {"env": name, "error": str(exc)}) from exc
    if not isinstance(parsed, list) or not all(isinstance(item, str) and item.strip() for item in parsed):
        raise HarnessError(f"{name} must be a JSON array of strings", ERROR_CONFIG, {"env": name})
    return [str(item).strip() for item in parsed]


def _read_env_int(name: str, fallback: int, *, minimum: int = 0) -> int:
    raw = str(os.getenv(name, "") or "").strip()
    if not raw:
        return fallback
    try:
        value = int(raw)
    except ValueError as exc:
        raise HarnessError(f"{name} must be an integer", ERROR_CONFIG, {"env": name, "value": raw}) from exc
    return max(minimum, value)


def _read_env_bool(name: str, fallback: bool) -> bool:
    raw = str(os.getenv(name, "") or "").strip().lower()
    if not raw:
        return fallback
    return raw in {"1", "true", "yes", "on"}


def _normalize_pixverse_strategy(raw: str) -> str:
    normalized = str(raw or "").strip().lower().replace("_", "-")
    if normalized in {"fusion", "fusion-video"}:
        return "fusion-video"
    if normalized in {"image", "image-video", "image-to-video", "i2v"}:
        return "image-to-video"
    if normalized in {"transition", "transition-video", "transition-to-video"}:
        return "transition-video"
    if normalized in {"text", "text-video", "text-to-video", "t2v"}:
        return "text-to-video"
    return "auto"


def _png_chunk(tag: bytes, payload: bytes) -> bytes:
    return (
        struct.pack(">I", len(payload))
        + tag
        + payload
        + struct.pack(">I", zlib.crc32(tag + payload) & 0xFFFFFFFF)
    )


def _write_prompt_png(*, file_path: str, prompt: str, width: int = 256, height: int = 144) -> None:
    seed = zlib.crc32(str(prompt or "").encode("utf-8")) & 0xFFFFFFFF
    base_r = 40 + (seed & 0x3F)
    base_g = 70 + ((seed >> 6) & 0x5F)
    base_b = 110 + ((seed >> 13) & 0x6F)
    rows = bytearray()
    for y in range(height):
        rows.append(0)
        for x in range(width):
            mix = (x * 255) // max(1, width - 1)
            band = (y * 255) // max(1, height - 1)
            r = min(255, base_r + mix // 6)
            g = min(255, base_g + band // 7)
            b = min(255, base_b + ((mix + band) // 10))
            rows.extend((r, g, b))
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 2, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + _png_chunk(b"IHDR", ihdr) + _png_chunk(b"IDAT", zlib.compress(bytes(rows), 9)) + _png_chunk(b"IEND", b"")
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    with open(file_path, "wb") as handle:
        handle.write(png)


def _readline_with_timeout(stream: Any, timeout_seconds: int) -> bytes:
    deadline = time.monotonic() + max(1, int(timeout_seconds))
    buffer = bytearray()
    while True:
        if hasattr(stream, "peek"):
            buffered = stream.peek(1)
            if buffered:
                chunk = stream.read(1)
                if not chunk:
                    raise HarnessError("PixVerse MCP process closed stdout unexpectedly", ERROR_RETRYABLE)
                buffer.extend(chunk)
                if buffer.endswith(b"\n"):
                    return bytes(buffer)
                continue
        remaining = max(0.0, deadline - time.monotonic())
        if remaining <= 0:
            raise HarnessError("Timed out while waiting for PixVerse MCP response line", ERROR_RETRYABLE)
        ready, _, _ = select.select([stream], [], [], remaining)
        if not ready:
            continue
        chunk = stream.read(1)
        if not chunk:
            raise HarnessError("PixVerse MCP process closed stdout unexpectedly", ERROR_RETRYABLE)
        buffer.extend(chunk)
        if buffer.endswith(b"\n"):
            return bytes(buffer)


def _readexactly_with_timeout(stream: Any, byte_count: int, timeout_seconds: int) -> bytes:
    deadline = time.monotonic() + max(1, int(timeout_seconds))
    buffer = bytearray()
    while len(buffer) < byte_count:
        if hasattr(stream, "peek"):
            buffered = stream.peek(1)
            if buffered:
                chunk = stream.read(byte_count - len(buffer))
                if not chunk:
                    raise HarnessError("PixVerse MCP process closed stdout during response body read", ERROR_RETRYABLE)
                buffer.extend(chunk)
                continue
        remaining = max(0.0, deadline - time.monotonic())
        if remaining <= 0:
            raise HarnessError("Timed out while waiting for PixVerse MCP response body", ERROR_RETRYABLE)
        ready, _, _ = select.select([stream], [], [], remaining)
        if not ready:
            continue
        chunk = stream.read(byte_count - len(buffer))
        if not chunk:
            raise HarnessError("PixVerse MCP process closed stdout during response body read", ERROR_RETRYABLE)
        buffer.extend(chunk)
    return bytes(buffer)


def _collect_text_blocks(content: Any) -> List[str]:
    texts: List[str] = []
    if isinstance(content, dict):
        text = content.get("text")
        if isinstance(text, str) and text.strip():
            texts.append(text.strip())
    if not isinstance(content, list):
        return texts
    for block in content:
        if isinstance(block, dict):
            text = block.get("text")
            if isinstance(text, str) and text.strip():
                texts.append(text.strip())
    return texts


def _parse_json_text_candidate(text: str) -> Optional[JsonDict]:
    candidate = str(text or "").strip()
    if not candidate or candidate[0] not in "[{":
        return None
    try:
        parsed = json.loads(candidate)
    except json.JSONDecodeError:
        return None
    return parsed if isinstance(parsed, dict) else None


def _normalize_tool_result(result: Any) -> JsonDict:
    if isinstance(result, dict):
        structured = result.get("structuredContent")
        if isinstance(structured, dict):
            return structured
        if "content" in result:
            texts = _collect_text_blocks(result.get("content"))
            for text in texts:
                parsed = _parse_json_text_candidate(text)
                if parsed is not None:
                    return parsed
            if texts:
                return {"message": "\n".join(texts)}
        return result
    return {"message": str(result or "")}


def _deep_find_first(value: Any, keys: Iterable[str]) -> Any:
    wanted = {key.lower() for key in keys}
    queue = [value]
    while queue:
        current = queue.pop(0)
        if isinstance(current, dict):
            for key, item in current.items():
                if str(key).lower() in wanted and item not in (None, ""):
                    return item
                if isinstance(item, (dict, list)):
                    queue.append(item)
        elif isinstance(current, list):
            queue.extend(item for item in current if isinstance(item, (dict, list)))
    return None


def _build_tool_request_payload(*, model: str, duration: int, quality: str, motion_mode: str) -> JsonDict:
    payload: JsonDict = {
        "model": model,
        "duration": duration,
        "quality": quality,
    }
    if motion_mode:
        payload["motion_mode"] = motion_mode
    return payload


class PixVerseMcpStdioClient:
    def __init__(self, *, command: str, args: Sequence[str], env: Dict[str, str], timeout_seconds: int) -> None:
        self.command = command
        self.args = list(args)
        self.env = env
        self.timeout_seconds = max(1, int(timeout_seconds))
        self.process: Optional[subprocess.Popen[bytes]] = None
        self._next_id = 1

    def __enter__(self) -> "PixVerseMcpStdioClient":
        self.process = subprocess.Popen(
            [self.command, *self.args],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            env=self.env,
        )
        self.initialize()
        return self

    def __exit__(self, exc_type: Any, exc: Any, tb: Any) -> None:
        self.close()

    def close(self) -> None:
        if not self.process:
            return
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=2)
            except subprocess.TimeoutExpired:
                self.process.kill()
        for stream_name in ("stdin", "stdout", "stderr"):
            stream = getattr(self.process, stream_name, None)
            if stream:
                try:
                    stream.close()
                except Exception:
                    pass
        self.process = None

    def _write_message(self, message: JsonDict) -> None:
        if not self.process or not self.process.stdin:
            raise HarnessError("PixVerse MCP process is not running", ERROR_RETRYABLE)
        payload = json.dumps(message, ensure_ascii=False).encode("utf-8")
        envelope = f"Content-Length: {len(payload)}\r\n\r\n".encode("ascii") + payload
        self.process.stdin.write(envelope)
        self.process.stdin.flush()

    def _read_message(self) -> JsonDict:
        if not self.process or not self.process.stdout:
            raise HarnessError("PixVerse MCP process stdout is unavailable", ERROR_RETRYABLE)
        headers: Dict[str, str] = {}
        while True:
            line = _readline_with_timeout(self.process.stdout, self.timeout_seconds)
            stripped = line.strip()
            if not stripped:
                break
            name, _, value = line.decode("utf-8").partition(":")
            headers[name.strip().lower()] = value.strip()
        length_raw = headers.get("content-length")
        if not length_raw:
            raise HarnessError("PixVerse MCP response missing Content-Length header", ERROR_RETRYABLE, {"headers": headers})
        body = _readexactly_with_timeout(self.process.stdout, int(length_raw), self.timeout_seconds)
        parsed = json.loads(body.decode("utf-8"))
        if not isinstance(parsed, dict):
            raise HarnessError("PixVerse MCP response body must be a JSON object", ERROR_RETRYABLE)
        return parsed

    def request(self, method: str, params: Optional[JsonDict] = None) -> JsonDict:
        message_id = self._next_id
        self._next_id += 1
        self._write_message({
            "jsonrpc": "2.0",
            "id": message_id,
            "method": method,
            "params": params or {},
        })
        while True:
            message = self._read_message()
            if message.get("id") != message_id:
                continue
            if isinstance(message.get("error"), dict):
                error = message["error"]
                raise HarnessError(
                    f"PixVerse MCP {method} failed: {error.get('message') or 'unknown error'}",
                    ERROR_RETRYABLE,
                    {"method": method, "error": error},
                )
            result = message.get("result")
            return result if isinstance(result, dict) else {"value": result}

    def notify(self, method: str, params: Optional[JsonDict] = None) -> None:
        self._write_message({
            "jsonrpc": "2.0",
            "method": method,
            "params": params or {},
        })

    def initialize(self) -> None:
        self.request(
            "initialize",
            {
                "protocolVersion": PIXVERSE_PROTOCOL_VERSION,
                "capabilities": {},
                "clientInfo": {"name": "knowgrph-superagent", "version": "0.2.0"},
            },
        )
        self.notify("notifications/initialized", {})


def render_pixverse_video_preview_html(*, title: str, video_url: str, provider: str) -> str:
    safe_title = json.dumps(title or "PixVerse Video")
    safe_url = json.dumps(video_url)
    safe_provider = json.dumps(provider)
    return f"""<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>{title or 'PixVerse Video'}</title>
  <style>
    body {{ margin: 0; padding: 24px; font-family: Inter, Arial, sans-serif; background: #09111b; color: #eef3ff; }}
    main {{ max-width: 1080px; margin: 0 auto; }}
    .meta {{ color: #a8b6d7; margin-bottom: 16px; }}
    video {{ width: 100%; border-radius: 16px; background: #02060d; }}
    a {{ color: #8bc4ff; }}
  </style>
</head>
<body>
  <main>
    <h1 id="title"></h1>
    <p class="meta">Provider: <span id="provider"></span></p>
    <video id="video" controls playsinline preload="metadata"></video>
    <p><a id="download" target="_blank" rel="noreferrer">Open source video URL</a></p>
  </main>
  <script>
    const title = {safe_title};
    const videoUrl = {safe_url};
    const provider = {safe_provider};
    document.getElementById("title").textContent = title;
    document.getElementById("provider").textContent = provider;
    document.getElementById("video").src = videoUrl;
    const link = document.getElementById("download");
    link.href = videoUrl;
  </script>
</body>
</html>
"""


def _call_pixverse_tool(client: PixVerseMcpStdioClient, *, name: str, arguments: JsonDict) -> JsonDict:
    return _normalize_tool_result(client.request("tools/call", {"name": name, "arguments": arguments}))


def _upload_pixverse_image(client: PixVerseMcpStdioClient, *, file_path: str) -> JsonDict:
    result = _call_pixverse_tool(client, name=PIXVERSE_DEFAULT_UPLOAD_IMAGE_TOOL, arguments={"file_path": file_path})
    image_id = _deep_find_first(result, ["img_id", "imgId"])
    if image_id in (None, ""):
        raise HarnessError("PixVerse MCP upload_image did not return an img_id", ERROR_RETRYABLE, {"file_path": file_path, "result": result})
    return {
        "img_id": image_id,
        "img_url": _deep_find_first(result, ["img_url", "imgUrl", "url"]),
        "raw": result,
    }


def _resolve_upload_source(*, file_path: str, file_url: str, label: str) -> JsonDict:
    normalized_path = str(file_path or "").strip()
    normalized_url = str(file_url or "").strip()
    if normalized_path and normalized_url:
        raise HarnessError(f"{label} cannot set both local file path and URL", ERROR_CONFIG)
    if normalized_path and not os.path.exists(normalized_path):
        raise HarnessError(f"{label} file not found: {normalized_path}", ERROR_CONFIG, {"file_path": normalized_path})
    return {"file_path": normalized_path, "file_url": normalized_url}


def _upload_pixverse_media(
    client: PixVerseMcpStdioClient,
    *,
    file_path: str,
    file_url: str,
    media_type: str,
) -> JsonDict:
    source = _resolve_upload_source(file_path=file_path, file_url=file_url, label=f"PixVerse {media_type} upload")
    normalized_path = str(source["file_path"] or "")
    normalized_url = str(source["file_url"] or "")
    if not normalized_path and not normalized_url:
        raise HarnessError(f"PixVerse {media_type} upload requires a local file path or URL", ERROR_CONFIG)

    if media_type == "video":
        tool_candidates = [str(os.getenv("KG_PIXVERSE_UPLOAD_VIDEO_TOOL", PIXVERSE_DEFAULT_UPLOAD_VIDEO_TOOL) or PIXVERSE_DEFAULT_UPLOAD_VIDEO_TOOL).strip() or PIXVERSE_DEFAULT_UPLOAD_VIDEO_TOOL]
    else:
        configured_audio_tool = str(os.getenv("KG_PIXVERSE_UPLOAD_AUDIO_TOOL", "") or "").strip()
        configured_audio_fallback = str(os.getenv("KG_PIXVERSE_UPLOAD_AUDIO_FALLBACK_TOOL", "") or "").strip()
        tool_candidates = [name for name in [
            configured_audio_tool,
            *PIXVERSE_DEFAULT_UPLOAD_AUDIO_TOOL_CANDIDATES,
            configured_audio_fallback,
        ] if name]

    arguments: JsonDict = {"file_path": normalized_path} if normalized_path else {"file_url": normalized_url}
    errors: List[JsonDict] = []
    for tool_name in tool_candidates:
        candidate_args = dict(arguments)
        if tool_name == "upload_media":
            candidate_args["media_type"] = media_type
        try:
            result = _call_pixverse_tool(client, name=tool_name, arguments=candidate_args)
        except HarnessError as exc:
            errors.append({"tool_name": tool_name, "error": str(exc)})
            continue
        media_id = _deep_find_first(
            result,
            [f"{media_type}_media_id", "media_id", f"{media_type}MediaId", "mediaId"],
        )
        if media_id in (None, ""):
            errors.append({"tool_name": tool_name, "error": f"missing {media_type}_media_id", "result": result})
            continue
        return {
            "media_id": media_id,
            "media_url": _deep_find_first(result, ["media_url", "mediaUrl", "url"]),
            "tool_name": tool_name,
            "upload_type": "file" if normalized_path else "url",
            "file_path": normalized_path,
            "file_url": normalized_url,
            "raw": result,
        }

    if media_type == "audio":
        raise HarnessError(
            "PixVerse MCP audio upload is unavailable; provide KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID or configure KG_PIXVERSE_UPLOAD_AUDIO_TOOL/KG_PIXVERSE_UPLOAD_AUDIO_FALLBACK_TOOL for your PixVerse MCP build",
            ERROR_CONFIG,
            {"tool_attempts": errors},
        )
    raise HarnessError(
        f"PixVerse MCP {media_type} upload failed",
        ERROR_RETRYABLE,
        {"tool_attempts": errors},
    )


def _synthesize_transition_frame(*, title: str, prompt: str, scene_title: str, file_path: str) -> None:
    _write_prompt_png(file_path=file_path, prompt=f"{title} | {scene_title} | {prompt}")


def _ensure_uploadable_image_path(*, source_path: str, prompt: str, output_dir: str, basename: str) -> str:
    normalized = str(source_path or "").strip()
    if normalized.lower().endswith((".png", ".jpg", ".jpeg", ".webp")) and os.path.exists(normalized):
        return normalized
    uploadable_path = os.path.join(output_dir, basename)
    _write_prompt_png(file_path=uploadable_path, prompt=prompt)
    return uploadable_path


def _resolve_transition_prompt(scenes: List[JsonDict]) -> str:
    if len(scenes) < 2:
        return str(scenes[0].get("video_prompt") or scenes[0].get("summary") or "") if scenes else ""
    last_scene = scenes[-1] if isinstance(scenes[-1], dict) else {}
    preferred = str(last_scene.get("transition_prompt") or "").strip()
    if preferred:
        return preferred
    first_title = str(scenes[0].get("title") or "Scene 1")
    last_title = str(last_scene.get("title") or f"Scene {len(scenes)}")
    return f"Smooth visual transition from {first_title} to {last_title} with cinematic continuity and readable scene change."


def _build_fusion_reference_specs(
    *,
    title: str,
    scenes: List[JsonDict],
    reference_image_path: str,
    output_dir: str,
) -> List[JsonDict]:
    if not scenes:
        return []
    first_scene = scenes[0] if isinstance(scenes[0], dict) else {}
    last_scene = scenes[-1] if isinstance(scenes[-1], dict) else {}
    specs: List[JsonDict] = [
        {
            "ref_name": "hero",
            "type": "subject",
            "label": str(first_scene.get("title") or "Primary subject"),
            "file_path": _ensure_uploadable_image_path(
                source_path=reference_image_path,
                prompt=str(first_scene.get("image_prompt") or first_scene.get("summary") or title),
                output_dir=output_dir,
                basename="pixverse-fusion-hero.png",
            ),
        }
    ]
    background_path = os.path.join(output_dir, "pixverse-fusion-world.png")
    _write_prompt_png(
        file_path=background_path,
        prompt=str(last_scene.get("image_prompt") or last_scene.get("summary") or title),
    )
    specs.append({
        "ref_name": "world",
        "type": "background",
        "label": str(last_scene.get("title") or f"{title} background"),
        "file_path": background_path,
    })
    if len(scenes) >= 2:
        middle_scene = scenes[min(1, len(scenes) - 1)] if isinstance(scenes[min(1, len(scenes) - 1)], dict) else {}
        support_path = os.path.join(output_dir, "pixverse-fusion-support.png")
        _write_prompt_png(
            file_path=support_path,
            prompt=str(middle_scene.get("image_prompt") or middle_scene.get("summary") or title),
        )
        specs.append({
            "ref_name": "support",
            "type": "subject",
            "label": str(middle_scene.get("title") or "Support subject"),
            "file_path": support_path,
        })
    return specs


def _resolve_fusion_prompt(scenes: List[JsonDict], title: str, reference_specs: List[JsonDict]) -> str:
    configured = str(os.getenv("KG_PIXVERSE_FUSION_PROMPT", "") or "").strip()
    if configured:
        return _clip_prompt_text(configured)
    ref_names = [str(spec.get("ref_name") or "").strip() for spec in reference_specs if str(spec.get("ref_name") or "").strip()]
    lead = str((scenes[0] if scenes and isinstance(scenes[0], dict) else {}).get("video_prompt") or title).strip()
    if not ref_names:
        return _clip_prompt_text(lead or title)
    prompt = f"@{ref_names[0]} featured cinematically"
    if "world" in ref_names:
        prompt += " in front of @world"
    if "support" in ref_names:
        prompt += " with @support complementing the scene"
    prompt += f". Narrative direction: {lead or title}"
    return _clip_prompt_text(prompt)


def _resolve_extension_count(scene_count: int) -> int:
    default_extensions = 1 if scene_count >= 4 else 0
    return min(3, _read_env_int("KG_PIXVERSE_MAX_EXTENSIONS", default_extensions, minimum=0))


def _build_extension_prompts(scenes: List[JsonDict], extension_count: int) -> List[str]:
    if extension_count <= 0 or not scenes:
        return []
    prompts: List[str] = []
    for index in range(extension_count):
        scene_index = min(len(scenes) - 1, index + 1)
        scene = scenes[scene_index] if isinstance(scenes[scene_index], dict) else {}
        base = str(
            scene.get("transition_prompt")
            or scene.get("video_prompt")
            or scene.get("summary")
            or scene.get("title")
            or "Continue the story"
        ).strip()
        prompts.append(f"Continue the existing video with the next beat: {base}")
    return prompts


def _clip_prompt_text(text: str, limit: int = 320) -> str:
    normalized = " ".join(str(text or "").split())
    if len(normalized) <= limit:
        return normalized
    return normalized[: max(0, limit - 3)].rstrip() + "..."


def _resolve_sound_effect_prompt(scenes: List[JsonDict], title: str) -> str:
    configured = str(os.getenv("KG_PIXVERSE_SOUND_EFFECT_PROMPT", "") or "").strip()
    if configured:
        return configured
    if not scenes:
        return ""
    cues: List[str] = []
    for scene in scenes[:3]:
        if not isinstance(scene, dict):
            continue
        cue = str(scene.get("summary") or scene.get("video_prompt") or scene.get("title") or "").strip()
        if cue:
            cues.append(cue)
    if not cues:
        return ""
    return _clip_prompt_text(f"Contextual cinematic sound design for {title}: {'; '.join(cues)}")


def _resolve_lip_sync_tts_content(scenes: List[JsonDict], title: str) -> str:
    configured = str(os.getenv("KG_PIXVERSE_LIP_SYNC_TTS_CONTENT", "") or "").strip()
    if configured:
        return _clip_prompt_text(configured)
    if not scenes:
        return ""
    lines: List[str] = []
    for scene in scenes[:3]:
        if not isinstance(scene, dict):
            continue
        line = str(scene.get("narration") or scene.get("summary") or scene.get("video_prompt") or "").strip()
        if line:
            lines.append(line)
    if not lines:
        return ""
    return _clip_prompt_text(" ".join(lines) or f"Welcome to {title}.")


def _apply_pixverse_sound_effect(
    client: PixVerseMcpStdioClient,
    *,
    source_video_id: Any,
    video_media_id: str,
    sound_effect_prompt: str,
    keep_original_sound: bool,
) -> JsonDict:
    tool_name = str(
        os.getenv("KG_PIXVERSE_SOUND_EFFECT_TOOL", PIXVERSE_DEFAULT_SOUND_EFFECT_TOOL) or PIXVERSE_DEFAULT_SOUND_EFFECT_TOOL
    ).strip() or PIXVERSE_DEFAULT_SOUND_EFFECT_TOOL
    arguments: JsonDict = {
        "original_sound_switch": keep_original_sound,
        "sound_effect_content": sound_effect_prompt,
    }
    if video_media_id:
        arguments["video_media_id"] = video_media_id
    else:
        arguments["source_video_id"] = source_video_id
    submission = _call_pixverse_tool(
        client,
        name=tool_name,
        arguments=arguments,
    )
    video_id = _deep_find_first(submission, ["video_id", "videoId"])
    if video_id in (None, ""):
        raise HarnessError(
            "PixVerse MCP sound effect tool did not return a video_id",
            ERROR_RETRYABLE,
            {"submission": submission, "tool_name": tool_name},
        )
    status_payload = _poll_pixverse_video_status(client, video_id=video_id, submission=submission)
    return {
        "generation_mode": tool_name,
        "tool_name": tool_name,
        "mode": "uploaded-video" if video_media_id else "generated-video",
        "video_media_id": video_media_id,
        "prompt": sound_effect_prompt,
        "keep_original_sound": keep_original_sound,
        "submission": submission,
        "status": status_payload,
        "video_id": video_id,
    }


def _apply_pixverse_lip_sync(
    client: PixVerseMcpStdioClient,
    *,
    source_video_id: Any,
    video_media_id: str,
    tts_speaker_id: str,
    tts_content: str,
    audio_media_id: str,
) -> JsonDict:
    tool_name = str(
        os.getenv("KG_PIXVERSE_LIP_SYNC_TOOL", PIXVERSE_DEFAULT_LIP_SYNC_TOOL) or PIXVERSE_DEFAULT_LIP_SYNC_TOOL
    ).strip() or PIXVERSE_DEFAULT_LIP_SYNC_TOOL
    arguments: JsonDict = {"video_media_id": video_media_id} if video_media_id else {"source_video_id": source_video_id}
    if audio_media_id:
        arguments["audio_media_id"] = audio_media_id
    else:
        arguments["lip_sync_tts_speaker_id"] = tts_speaker_id
        arguments["lip_sync_tts_content"] = tts_content
    submission = _call_pixverse_tool(
        client,
        name=tool_name,
        arguments=arguments,
    )
    video_id = _deep_find_first(submission, ["video_id", "videoId"])
    if video_id in (None, ""):
        raise HarnessError(
            "PixVerse MCP lip sync tool did not return a video_id",
            ERROR_RETRYABLE,
            {"submission": submission, "tool_name": tool_name},
        )
    status_payload = _poll_pixverse_video_status(client, video_id=video_id, submission=submission)
    return {
        "generation_mode": tool_name,
        "tool_name": tool_name,
        "mode": "custom-audio" if audio_media_id else "tts",
        "video_mode": "uploaded-video" if video_media_id else "generated-video",
        "video_media_id": video_media_id,
        "tts_speaker_id": tts_speaker_id,
        "tts_content": tts_content,
        "audio_media_id": audio_media_id,
        "submission": submission,
        "status": status_payload,
        "video_id": video_id,
    }


def _submit_pixverse_video_generation(
    client: PixVerseMcpStdioClient,
    *,
    strategy: str,
    prompt: str,
    model: str,
    duration: int,
    aspect_ratio: str,
    quality: str,
    motion_mode: str,
    reference_image_path: str,
    transition_image_path: str,
    fusion_reference_specs: Optional[List[JsonDict]] = None,
) -> JsonDict:
    base_payload = _build_tool_request_payload(model=model, duration=duration, quality=quality, motion_mode=motion_mode)
    if strategy == "fusion-video":
        uploads: List[JsonDict] = []
        image_references: List[JsonDict] = []
        for spec in fusion_reference_specs or []:
            upload = _upload_pixverse_image(client, file_path=str(spec.get("file_path") or ""))
            uploads.append({
                "ref_name": str(spec.get("ref_name") or ""),
                "type": str(spec.get("type") or "subject"),
                "label": str(spec.get("label") or ""),
                "upload": upload,
            })
            image_references.append({
                "type": str(spec.get("type") or "subject"),
                "img_id": upload["img_id"],
                "ref_name": str(spec.get("ref_name") or ""),
            })
        submission = _call_pixverse_tool(
            client,
            name=PIXVERSE_DEFAULT_FUSION_TOOL,
            arguments={
                "prompt": prompt,
                "image_references": image_references,
                "model": model,
                "duration": duration,
                "quality": quality,
                "aspect_ratio": aspect_ratio,
            },
        )
        return {
            "generation_mode": "fusion_video",
            "submission": submission,
            "uploads": {"fusion_references": uploads},
        }
    if strategy == "image-to-video":
        uploaded = _upload_pixverse_image(client, file_path=reference_image_path)
        submission = _call_pixverse_tool(
            client,
            name="image_to_video",
            arguments={
                **base_payload,
                "prompt": prompt,
                "img_id": uploaded["img_id"],
            },
        )
        return {
            "generation_mode": "image_to_video",
            "submission": submission,
            "uploads": {"reference_image": uploaded},
        }
    if strategy == "transition-video":
        first_upload = _upload_pixverse_image(client, file_path=reference_image_path)
        last_upload = _upload_pixverse_image(client, file_path=transition_image_path)
        submission = _call_pixverse_tool(
            client,
            name="transition_video",
            arguments={
                "prompt": prompt,
                "first_frame_img": first_upload["img_id"],
                "last_frame_img": last_upload["img_id"],
                "model": model,
                "duration": duration,
                "quality": quality,
            },
        )
        return {
            "generation_mode": "transition_video",
            "submission": submission,
            "uploads": {"reference_image": first_upload, "transition_image": last_upload},
        }
    submission = _call_pixverse_tool(
        client,
        name="text_to_video",
        arguments={
            **base_payload,
            "prompt": prompt,
        },
    )
    return {
        "generation_mode": "text_to_video",
        "submission": submission,
        "uploads": {},
    }


def _poll_pixverse_video_status(
    client: PixVerseMcpStdioClient,
    *,
    video_id: Any,
    submission: JsonDict,
) -> JsonDict:
    poll_cfg = submission.get("polling_config") if isinstance(submission.get("polling_config"), dict) else {}
    poll_interval = max(0, int(poll_cfg.get("interval_seconds") or _read_env_int("KG_PIXVERSE_POLL_INTERVAL_SECONDS", PIXVERSE_DEFAULT_POLL_INTERVAL_SECONDS)))
    max_attempts = max(1, int(poll_cfg.get("max_attempts") or _read_env_int("KG_PIXVERSE_MAX_ATTEMPTS", PIXVERSE_DEFAULT_MAX_ATTEMPTS, minimum=1)))
    status_payload: JsonDict = {}
    for attempt in range(1, max_attempts + 1):
        status_payload = _normalize_tool_result(client.request("tools/call", {"name": "get_video_status", "arguments": {"video_id": video_id}}))
        status = str(_deep_find_first(status_payload, ["status", "state"]) or "").strip().lower()
        if status == "completed":
            return status_payload
        if status == "failed":
            error_message = str(_deep_find_first(status_payload, ["error_message", "errorMessage", "message"]) or "PixVerse generation failed")
            raise HarnessError(error_message, ERROR_RETRYABLE, {"video_id": video_id, "status": status_payload})
        if attempt >= max_attempts:
            raise HarnessError(
                "PixVerse video generation timed out before completion",
                ERROR_RETRYABLE,
                {"video_id": video_id, "max_attempts": max_attempts, "last_status": status_payload},
            )
        if poll_interval > 0:
            time.sleep(poll_interval)
    return status_payload


def run_pixverse_text_to_video(*, payload: JsonDict) -> JsonDict:
    api_key = str(os.getenv("PIXVERSE_API_KEY", "") or "").strip()
    if not api_key:
        raise HarnessError("PIXVERSE_API_KEY is required for provider_mode=pixverse", ERROR_CONFIG)
    text_plan = payload.get("text_plan") if isinstance(payload.get("text_plan"), dict) else {}
    image_result = payload.get("image_result") if isinstance(payload.get("image_result"), dict) else {}
    plan = text_plan.get("plan") if isinstance(text_plan.get("plan"), dict) else {}
    scenes = [scene for scene in (plan.get("scenes") or []) if isinstance(scene, dict)]
    if not scenes:
        raise HarnessError("Cannot generate PixVerse video: text plan contains no scenes", ERROR_RETRYABLE)
    scene = scenes[0]
    title = str(plan.get("title") or "Rich media plan")
    prompt = str(scene.get("video_prompt") or scene.get("narration") or scene.get("summary") or title).strip()
    if not prompt:
        raise HarnessError("Cannot generate PixVerse video: prompt is empty", ERROR_RETRYABLE)
    duration = _read_env_int("KG_PIXVERSE_DURATION", PIXVERSE_DEFAULT_DURATION, minimum=5)
    duration = 8 if duration >= 8 else 5
    model = str(os.getenv("KG_PIXVERSE_MODEL", PIXVERSE_DEFAULT_MODEL) or PIXVERSE_DEFAULT_MODEL).strip() or PIXVERSE_DEFAULT_MODEL
    aspect_ratio = str(os.getenv("KG_PIXVERSE_ASPECT_RATIO", PIXVERSE_DEFAULT_ASPECT_RATIO) or PIXVERSE_DEFAULT_ASPECT_RATIO).strip() or PIXVERSE_DEFAULT_ASPECT_RATIO
    quality = str(os.getenv("KG_PIXVERSE_QUALITY", PIXVERSE_DEFAULT_QUALITY) or PIXVERSE_DEFAULT_QUALITY).strip() or PIXVERSE_DEFAULT_QUALITY
    motion_mode = str(os.getenv("KG_PIXVERSE_MOTION_MODE", PIXVERSE_DEFAULT_MOTION_MODE) or PIXVERSE_DEFAULT_MOTION_MODE).strip() or PIXVERSE_DEFAULT_MOTION_MODE
    strategy = _normalize_pixverse_strategy(os.getenv("KG_PIXVERSE_STRATEGY", PIXVERSE_DEFAULT_STRATEGY))
    timeout_seconds = _read_env_int("KG_PIXVERSE_MCP_TIMEOUT_SECONDS", PIXVERSE_DEFAULT_TIMEOUT_SECONDS, minimum=1)
    command = str(os.getenv("KG_PIXVERSE_MCP_COMMAND", PIXVERSE_DEFAULT_COMMAND) or PIXVERSE_DEFAULT_COMMAND).strip() or PIXVERSE_DEFAULT_COMMAND
    args = _read_env_json_list("KG_PIXVERSE_MCP_ARGS_JSON", PIXVERSE_DEFAULT_ARGS)
    process_env = dict(os.environ)
    process_env["PIXVERSE_API_KEY"] = api_key
    request_payload = {
        "prompt": prompt,
        "model": model,
        "duration": duration,
        "aspect_ratio": aspect_ratio,
        "quality": quality,
        "motion_mode": motion_mode,
        "strategy": strategy,
    }
    negative_prompt = str(os.getenv("KG_PIXVERSE_NEGATIVE_PROMPT", "") or "").strip()
    if negative_prompt:
        request_payload["negative_prompt"] = negative_prompt
    image = image_result.get("image") if isinstance(image_result.get("image"), dict) else {}
    reference_image_path = str(image.get("path") or "").strip()
    scene_count = len(scenes)
    extension_count = _resolve_extension_count(scene_count)
    extension_prompts = _build_extension_prompts(scenes, extension_count)
    sound_effect_enabled = _read_env_bool("KG_PIXVERSE_ENABLE_SOUND_EFFECT", False)
    sound_effect_prompt = _resolve_sound_effect_prompt(scenes, title) if sound_effect_enabled else ""
    keep_original_sound = _read_env_bool("KG_PIXVERSE_KEEP_ORIGINAL_SOUND", True)
    sound_effect_video_media_id = str(os.getenv("KG_PIXVERSE_SOUND_EFFECT_VIDEO_MEDIA_ID", "") or "").strip() if sound_effect_enabled else ""
    sound_effect_video_file_path = str(os.getenv("KG_PIXVERSE_SOUND_EFFECT_VIDEO_FILE_PATH", "") or "").strip() if sound_effect_enabled else ""
    sound_effect_video_file_url = str(os.getenv("KG_PIXVERSE_SOUND_EFFECT_VIDEO_FILE_URL", "") or "").strip() if sound_effect_enabled else ""
    lip_sync_enabled = _read_env_bool("KG_PIXVERSE_ENABLE_LIP_SYNC", False)
    lip_sync_video_media_id = str(os.getenv("KG_PIXVERSE_LIP_SYNC_VIDEO_MEDIA_ID", "") or "").strip() if lip_sync_enabled else ""
    lip_sync_video_file_path = str(os.getenv("KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_PATH", "") or "").strip() if lip_sync_enabled else ""
    lip_sync_video_file_url = str(os.getenv("KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_URL", "") or "").strip() if lip_sync_enabled else ""
    lip_sync_tts_speaker_id = str(os.getenv("KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID", "") or "").strip() if lip_sync_enabled else ""
    lip_sync_audio_media_id = str(os.getenv("KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID", "") or "").strip() if lip_sync_enabled else ""
    lip_sync_audio_file_path = str(os.getenv("KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_PATH", "") or "").strip() if lip_sync_enabled else ""
    lip_sync_audio_file_url = str(os.getenv("KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_URL", "") or "").strip() if lip_sync_enabled else ""
    lip_sync_has_custom_audio = bool(lip_sync_audio_media_id or lip_sync_audio_file_path or lip_sync_audio_file_url)
    lip_sync_tts_content = _resolve_lip_sync_tts_content(scenes, title) if lip_sync_enabled and not lip_sync_has_custom_audio else ""
    if sound_effect_enabled and lip_sync_enabled:
        raise HarnessError(
            "KG_PIXVERSE_ENABLE_SOUND_EFFECT and KG_PIXVERSE_ENABLE_LIP_SYNC cannot both be enabled in the same run",
            ERROR_CONFIG,
        )
    if sound_effect_video_media_id and (sound_effect_video_file_path or sound_effect_video_file_url):
        raise HarnessError(
            "KG_PIXVERSE_SOUND_EFFECT_VIDEO_MEDIA_ID cannot be combined with KG_PIXVERSE_SOUND_EFFECT_VIDEO_FILE_PATH or KG_PIXVERSE_SOUND_EFFECT_VIDEO_FILE_URL",
            ERROR_CONFIG,
        )
    if lip_sync_enabled and lip_sync_audio_media_id and lip_sync_tts_speaker_id:
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID cannot be combined with KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID",
            ERROR_CONFIG,
        )
    if lip_sync_enabled and lip_sync_audio_media_id and str(os.getenv("KG_PIXVERSE_LIP_SYNC_TTS_CONTENT", "") or "").strip():
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID cannot be combined with KG_PIXVERSE_LIP_SYNC_TTS_CONTENT",
            ERROR_CONFIG,
        )
    if lip_sync_audio_media_id and (lip_sync_audio_file_path or lip_sync_audio_file_url):
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID cannot be combined with KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_PATH or KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_URL",
            ERROR_CONFIG,
        )
    if lip_sync_video_media_id and (lip_sync_video_file_path or lip_sync_video_file_url):
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC_VIDEO_MEDIA_ID cannot be combined with KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_PATH or KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_URL",
            ERROR_CONFIG,
        )
    if lip_sync_has_custom_audio and lip_sync_tts_speaker_id:
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC custom audio cannot be combined with KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID",
            ERROR_CONFIG,
        )
    if lip_sync_has_custom_audio and str(os.getenv("KG_PIXVERSE_LIP_SYNC_TTS_CONTENT", "") or "").strip():
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC custom audio cannot be combined with KG_PIXVERSE_LIP_SYNC_TTS_CONTENT",
            ERROR_CONFIG,
        )
    if lip_sync_enabled and not lip_sync_has_custom_audio and not lip_sync_tts_speaker_id:
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID is required when KG_PIXVERSE_ENABLE_LIP_SYNC uses TTS mode",
            ERROR_CONFIG,
        )
    if lip_sync_enabled and not lip_sync_has_custom_audio and not lip_sync_tts_content:
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC_TTS_CONTENT must be provided or derivable when KG_PIXVERSE_ENABLE_LIP_SYNC uses TTS mode",
            ERROR_CONFIG,
        )
    if sound_effect_video_media_id and not sound_effect_enabled:
        raise HarnessError(
            "KG_PIXVERSE_SOUND_EFFECT_VIDEO_MEDIA_ID requires KG_PIXVERSE_ENABLE_SOUND_EFFECT",
            ERROR_CONFIG,
        )
    if lip_sync_video_media_id and not lip_sync_enabled:
        raise HarnessError(
            "KG_PIXVERSE_LIP_SYNC_VIDEO_MEDIA_ID requires KG_PIXVERSE_ENABLE_LIP_SYNC",
            ERROR_CONFIG,
        )
    effective_strategy = strategy
    if effective_strategy == "auto":
        if reference_image_path and scene_count > 1:
            effective_strategy = "transition-video"
        elif reference_image_path:
            effective_strategy = "image-to-video"
        else:
            effective_strategy = "text-to-video"
    if effective_strategy in {"image-to-video", "transition-video", "fusion-video"} and not reference_image_path:
        raise HarnessError(
            "PixVerse image-conditioned generation requires a local reference_image path",
            ERROR_RETRYABLE,
            {"strategy": effective_strategy},
        )
    if effective_strategy == "fusion-video" and model != "v4.5":
        model = "v4.5"
        request_payload["model"] = model
    video_dir = os.path.join(str(payload["artifacts_dir"]), "video")
    reference_upload_path = _ensure_uploadable_image_path(
        source_path=reference_image_path,
        prompt=str(scene.get("image_prompt") or prompt),
        output_dir=video_dir,
        basename="pixverse-reference-upload.png",
    )
    fusion_reference_specs: List[JsonDict] = []
    transition_image_path = os.path.join(video_dir, "pixverse-transition-last-frame.png")
    if effective_strategy == "fusion-video":
        fusion_reference_specs = _build_fusion_reference_specs(
            title=title,
            scenes=scenes,
            reference_image_path=reference_upload_path,
            output_dir=video_dir,
        )
        prompt = _resolve_fusion_prompt(scenes, title, fusion_reference_specs)
        request_payload["prompt"] = prompt
        request_payload["fusion_references"] = [
            {
                "ref_name": str(spec.get("ref_name") or ""),
                "type": str(spec.get("type") or ""),
                "label": str(spec.get("label") or ""),
            }
            for spec in fusion_reference_specs
        ]
    elif effective_strategy == "transition-video":
        last_scene = scenes[-1]
        last_prompt = str(last_scene.get("image_prompt") or last_scene.get("summary") or title)
        _synthesize_transition_frame(
            title=title,
            prompt=last_prompt,
            scene_title=str(last_scene.get("title") or f"Scene {scene_count}"),
            file_path=transition_image_path,
        )
        prompt = _resolve_transition_prompt(scenes)
        request_payload["prompt"] = prompt
    if sound_effect_enabled:
        request_payload["sound_effect"] = {
            "enabled": True,
            "mode": "uploaded-video" if (sound_effect_video_media_id or sound_effect_video_file_path or sound_effect_video_file_url) else "generated-video",
            "video_media_id": sound_effect_video_media_id,
            "video_file_path": sound_effect_video_file_path,
            "video_file_url": sound_effect_video_file_url,
            "prompt": sound_effect_prompt,
            "keep_original_sound": keep_original_sound,
        }
    if lip_sync_enabled:
        request_payload["lip_sync"] = {
            "enabled": True,
            "video_mode": "uploaded-video" if (lip_sync_video_media_id or lip_sync_video_file_path or lip_sync_video_file_url) else "generated-video",
            "video_media_id": lip_sync_video_media_id,
            "video_file_path": lip_sync_video_file_path,
            "video_file_url": lip_sync_video_file_url,
            "mode": "custom-audio" if lip_sync_has_custom_audio else "tts",
            "audio_media_id": lip_sync_audio_media_id,
            "audio_file_path": lip_sync_audio_file_path,
            "audio_file_url": lip_sync_audio_file_url,
            "tts_speaker_id": lip_sync_tts_speaker_id,
            "tts_content": lip_sync_tts_content,
        }
    extension_chain: List[JsonDict] = []
    sound_effect_result: Optional[JsonDict] = None
    lip_sync_result: Optional[JsonDict] = None
    submission: JsonDict = {}
    video_id: Any = None
    status_payload: JsonDict = {}
    generation: JsonDict = {
        "generation_mode": "uploaded_video_media" if (
            sound_effect_video_media_id
            or sound_effect_video_file_path
            or sound_effect_video_file_url
            or lip_sync_video_media_id
            or lip_sync_video_file_path
            or lip_sync_video_file_url
        ) else "",
        "uploads": {},
    }
    final_generation_mode = ""
    with PixVerseMcpStdioClient(command=command, args=args, env=process_env, timeout_seconds=timeout_seconds) as client:
        if lip_sync_audio_file_path or lip_sync_audio_file_url:
            uploaded_audio = _upload_pixverse_media(
                client,
                file_path=lip_sync_audio_file_path,
                file_url=lip_sync_audio_file_url,
                media_type="audio",
            )
            lip_sync_audio_media_id = str(uploaded_audio["media_id"])
            generation["uploads"]["lip_sync_audio"] = uploaded_audio
        if lip_sync_video_file_path or lip_sync_video_file_url:
            uploaded_video = _upload_pixverse_media(
                client,
                file_path=lip_sync_video_file_path,
                file_url=lip_sync_video_file_url,
                media_type="video",
            )
            lip_sync_video_media_id = str(uploaded_video["media_id"])
            generation["uploads"]["lip_sync_video"] = uploaded_video
        if sound_effect_video_file_path or sound_effect_video_file_url:
            uploaded_video = _upload_pixverse_media(
                client,
                file_path=sound_effect_video_file_path,
                file_url=sound_effect_video_file_url,
                media_type="video",
            )
            sound_effect_video_media_id = str(uploaded_video["media_id"])
            generation["uploads"]["sound_effect_video"] = uploaded_video
        if sound_effect_video_media_id or lip_sync_video_media_id:
            final_generation_mode = "uploaded_video_media"
        else:
            generation = _submit_pixverse_video_generation(
                client,
                strategy=effective_strategy,
                prompt=prompt,
                model=model,
                duration=duration,
                aspect_ratio=aspect_ratio,
                quality=quality,
                motion_mode=motion_mode,
                reference_image_path=reference_upload_path,
                transition_image_path=transition_image_path,
                fusion_reference_specs=fusion_reference_specs,
            )
            submission = generation["submission"]
            video_id = _deep_find_first(submission, ["video_id", "videoId"])
            if video_id in (None, ""):
                raise HarnessError("PixVerse MCP submission did not return a video_id", ERROR_RETRYABLE, {"submission": submission})
            status_payload = _poll_pixverse_video_status(client, video_id=video_id, submission=submission)
            final_generation_mode = generation["generation_mode"]
            if _read_env_bool("KG_PIXVERSE_ENABLE_EXTEND", True) and extension_prompts:
                for extension_prompt in extension_prompts:
                    extension_submission = _call_pixverse_tool(
                        client,
                        name="extend_video",
                        arguments={
                            "prompt": extension_prompt,
                            "source_video_id": video_id,
                            "model": model,
                            "duration": duration,
                            "quality": quality,
                        },
                    )
                    extension_video_id = _deep_find_first(extension_submission, ["video_id", "videoId"])
                    if extension_video_id in (None, ""):
                        raise HarnessError(
                            "PixVerse MCP extend_video did not return a video_id",
                            ERROR_RETRYABLE,
                            {"submission": extension_submission},
                        )
                    extension_status = _poll_pixverse_video_status(client, video_id=extension_video_id, submission=extension_submission)
                    extension_chain.append({
                        "prompt": extension_prompt,
                        "submission": extension_submission,
                        "status": extension_status,
                    })
                    video_id = extension_video_id
                    status_payload = extension_status
                    final_generation_mode = "extend_video"
        if lip_sync_enabled:
            lip_sync_result = _apply_pixverse_lip_sync(
                client,
                source_video_id=video_id,
                video_media_id=lip_sync_video_media_id,
                tts_speaker_id=lip_sync_tts_speaker_id,
                tts_content=lip_sync_tts_content,
                audio_media_id=lip_sync_audio_media_id,
            )
            submission = lip_sync_result["submission"]
            video_id = lip_sync_result["video_id"]
            status_payload = lip_sync_result["status"]
            final_generation_mode = str(lip_sync_result["generation_mode"] or "lip_sync_video")
        if sound_effect_enabled:
            sound_effect_result = _apply_pixverse_sound_effect(
                client,
                source_video_id=video_id,
                video_media_id=sound_effect_video_media_id,
                sound_effect_prompt=sound_effect_prompt,
                keep_original_sound=keep_original_sound,
            )
            submission = sound_effect_result["submission"]
            video_id = sound_effect_result["video_id"]
            status_payload = sound_effect_result["status"]
            final_generation_mode = str(sound_effect_result["generation_mode"] or "sound_effect_video")
    video_url = str(_deep_find_first(status_payload, ["video_url", "videoUrl", "url"]) or "").strip()
    if not video_url:
        raise HarnessError("PixVerse status response did not include a video_url", ERROR_RETRYABLE, {"status": status_payload})
    preview_path = os.path.join(video_dir, "pixverse-video.html")
    manifest_path = os.path.join(video_dir, "pixverse-video.json")
    write_text(preview_path, render_pixverse_video_preview_html(title=title, video_url=video_url, provider="pixverse-mcp"))
    write_json(
        manifest_path,
        {
            "title": title,
            "provider": "pixverse-mcp",
            "provider_mode_requested": "pixverse",
            "provider_mode_resolved": "pixverse",
            "request": request_payload,
            "requested_strategy": strategy,
            "generation_mode": final_generation_mode,
            "base_generation_mode": generation["generation_mode"],
            "scene_count": scene_count,
            "extension_count": len(extension_chain),
            "extension_chain": extension_chain,
            "lip_sync": {
                "enabled": lip_sync_enabled,
                "mode": lip_sync_result["mode"] if lip_sync_result else ("custom-audio" if lip_sync_has_custom_audio else "tts"),
                "video_mode": lip_sync_result["video_mode"] if lip_sync_result else ("uploaded-video" if lip_sync_video_media_id else "generated-video"),
                "video_media_id": lip_sync_video_media_id,
                "video_file_path": lip_sync_video_file_path,
                "video_file_url": lip_sync_video_file_url,
                "audio_media_id": lip_sync_audio_media_id,
                "audio_file_path": lip_sync_audio_file_path,
                "audio_file_url": lip_sync_audio_file_url,
                "tts_speaker_id": lip_sync_tts_speaker_id,
                "tts_content": lip_sync_tts_content,
                "generation_mode": lip_sync_result["generation_mode"] if lip_sync_result else "",
                "tool_name": lip_sync_result["tool_name"] if lip_sync_result else "",
                "submission": lip_sync_result["submission"] if lip_sync_result else {},
                "status": lip_sync_result["status"] if lip_sync_result else {},
            },
            "sound_effect": {
                "enabled": sound_effect_enabled,
                "mode": sound_effect_result["mode"] if sound_effect_result else ("uploaded-video" if sound_effect_video_media_id else "generated-video"),
                "video_media_id": sound_effect_video_media_id,
                "video_file_path": sound_effect_video_file_path,
                "video_file_url": sound_effect_video_file_url,
                "prompt": sound_effect_prompt,
                "keep_original_sound": keep_original_sound,
                "generation_mode": sound_effect_result["generation_mode"] if sound_effect_result else "",
                "tool_name": sound_effect_result["tool_name"] if sound_effect_result else "",
                "submission": sound_effect_result["submission"] if sound_effect_result else {},
                "status": sound_effect_result["status"] if sound_effect_result else {},
            },
            "uploads": generation["uploads"],
            "submission": submission,
            "status": status_payload,
            "video_url": video_url,
        },
    )
    return {
        "video": {
            "path": preview_path,
            "url": video_url,
            "manifest_path": manifest_path,
            "media_kind": "video",
            "mime_type": "video/mp4",
            "provider": "pixverse-mcp",
            "provider_mode_resolved": "pixverse",
            "provider_status": "completed",
            "model": model,
            "duration_seconds": duration,
            "reference_image": str(image.get("path") or ""),
            "generation_mode": final_generation_mode,
            "base_generation_mode": generation["generation_mode"],
            "extension_count": len(extension_chain),
            "video_id": video_id,
            "lip_sync_enabled": lip_sync_enabled,
            "lip_sync_video_mode": "uploaded-video" if lip_sync_video_media_id else ("generated-video" if lip_sync_enabled else ""),
            "lip_sync_video_media_id": lip_sync_video_media_id,
            "lip_sync_mode": "custom-audio" if lip_sync_has_custom_audio else ("tts" if lip_sync_enabled else ""),
            "lip_sync_audio_media_id": lip_sync_audio_media_id,
            "lip_sync_tts_speaker_id": lip_sync_tts_speaker_id,
            "lip_sync_tts_content": lip_sync_tts_content,
            "sound_effect_enabled": sound_effect_enabled,
            "sound_effect_mode": "uploaded-video" if sound_effect_video_media_id else ("generated-video" if sound_effect_enabled else ""),
            "sound_effect_video_media_id": sound_effect_video_media_id,
            "sound_effect_prompt": sound_effect_prompt,
            "original_sound_switch": keep_original_sound,
        },
        "artifacts": [
            {
                "artifact_id": "video_storyboard_html",
                "kind": "video",
                "path": preview_path,
                "media_type": "text/html; charset=utf-8",
                "source_step_id": str(payload["step_id"]),
                "metadata": {
                    "provider": "pixverse-mcp",
                    "video_id": video_id,
                    "generation_mode": final_generation_mode,
                    "base_generation_mode": generation["generation_mode"],
                    "extension_count": len(extension_chain),
                    "lip_sync_enabled": lip_sync_enabled,
                    "sound_effect_enabled": sound_effect_enabled,
                },
            },
            {
                "artifact_id": "video_storyboard_manifest",
                "kind": "video",
                "path": manifest_path,
                "media_type": "application/json",
                "source_step_id": str(payload["step_id"]),
                "metadata": {
                    "provider": "pixverse-mcp",
                    "video_id": video_id,
                    "video_url": video_url,
                    "generation_mode": final_generation_mode,
                    "base_generation_mode": generation["generation_mode"],
                    "extension_count": len(extension_chain),
                    "lip_sync_enabled": lip_sync_enabled,
                    "sound_effect_enabled": sound_effect_enabled,
                },
            },
        ],
    }
