import argparse
import json
import os
from contextlib import contextmanager
from typing import Dict, Iterator, Optional, Sequence

from .superagent_harness import RunBudget, run_harness


@contextmanager
def _temporary_env(patch: Dict[str, str]) -> Iterator[None]:
    previous = {key: os.environ.get(key) for key in patch}
    try:
        for key, value in patch.items():
            os.environ[key] = value
        yield
    finally:
        for key, value in previous.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value


def main(argv: Optional[Sequence[str]] = None, *, base_dir: str) -> int:
    parser = argparse.ArgumentParser(prog="pixverse-smoke", add_help=True)
    parser.add_argument(
        "--input",
        "-i",
        default=os.path.join(base_dir, "knowgrph_parser", "fixtures", "superagent-neutral.md"),
    )
    parser.add_argument(
        "--output-dir",
        "-o",
        default=os.path.join(base_dir, "data", "outputs", "pixverse-smoke"),
    )
    parser.add_argument("--run-id", default="pixverse-smoke")
    parser.add_argument(
        "--goal-text",
        default="Verify the local PixVerse MCP super-agent path end-to-end and stop only when deterministic validation passes or a blocker is recorded.",
    )
    parser.add_argument(
        "--strategy",
        choices=["auto", "text-to-video", "image-to-video", "transition-video", "fusion-video"],
        default="auto",
    )
    parser.add_argument(
        "--sound-effect-prompt",
        default="",
        help="Optional sound-effect prompt. When set, the smoke run enables PixVerse sound-effect post-processing.",
    )
    parser.add_argument(
        "--sound-effect-video-media-id",
        default="",
        help="Optional uploaded PixVerse video_media_id. When set, the smoke run applies sound effects to that uploaded video instead of a generated clip.",
    )
    parser.add_argument(
        "--sound-effect-video-file",
        default="",
        help="Optional local video file path to upload before applying sound effects.",
    )
    parser.add_argument(
        "--sound-effect-video-url",
        default="",
        help="Optional video URL to upload before applying sound effects.",
    )
    parser.add_argument(
        "--lip-sync-speaker-id",
        default="",
        help="Optional PixVerse TTS speaker id. When set, the smoke run enables additive lip-sync post-processing.",
    )
    parser.add_argument(
        "--lip-sync-audio-media-id",
        default="",
        help="Optional uploaded PixVerse audio_media_id. When set, the smoke run uses custom-audio lip sync instead of TTS.",
    )
    parser.add_argument(
        "--lip-sync-video-media-id",
        default="",
        help="Optional uploaded PixVerse video_media_id. When set, the smoke run applies lip sync to that uploaded video instead of a generated clip.",
    )
    parser.add_argument(
        "--lip-sync-video-file",
        default="",
        help="Optional local video file path to upload before applying lip sync.",
    )
    parser.add_argument(
        "--lip-sync-video-url",
        default="",
        help="Optional video URL to upload before applying lip sync.",
    )
    parser.add_argument(
        "--lip-sync-audio-file",
        default="",
        help="Optional local audio file path to upload before applying custom-audio lip sync.",
    )
    parser.add_argument(
        "--lip-sync-audio-url",
        default="",
        help="Optional audio URL to upload before applying custom-audio lip sync.",
    )
    parser.add_argument(
        "--lip-sync-text",
        default="",
        help="Optional TTS text for lip sync. When omitted, the harness derives speech from the scene plan.",
    )
    parser.add_argument(
        "--replace-original-sound",
        action="store_true",
        help="Replace original clip audio instead of retaining it when sound effects are enabled.",
    )
    parser.add_argument("--allow-fallback", action="store_true")
    parser.add_argument("--print-summary", action="store_true")
    arguments = parser.parse_args(list(argv) if argv is not None else None)

    if not str(os.getenv("PIXVERSE_API_KEY", "") or "").strip():
        print("PIXVERSE_API_KEY is required for pixverse-smoke")
        return 2

    env_patch = {"KG_PIXVERSE_STRATEGY": arguments.strategy}
    lip_sync_speaker_id = str(arguments.lip_sync_speaker_id or "").strip()
    lip_sync_audio_media_id = str(arguments.lip_sync_audio_media_id or "").strip()
    lip_sync_video_media_id = str(arguments.lip_sync_video_media_id or "").strip()
    lip_sync_video_file = str(arguments.lip_sync_video_file or "").strip()
    lip_sync_video_url = str(arguments.lip_sync_video_url or "").strip()
    lip_sync_audio_file = str(arguments.lip_sync_audio_file or "").strip()
    lip_sync_audio_url = str(arguments.lip_sync_audio_url or "").strip()
    sound_effect_prompt = str(arguments.sound_effect_prompt or "").strip()
    sound_effect_video_media_id = str(arguments.sound_effect_video_media_id or "").strip()
    sound_effect_video_file = str(arguments.sound_effect_video_file or "").strip()
    sound_effect_video_url = str(arguments.sound_effect_video_url or "").strip()
    lip_sync_text = str(arguments.lip_sync_text or "").strip()
    lip_sync_has_custom_audio = bool(lip_sync_audio_media_id or lip_sync_audio_file or lip_sync_audio_url)
    lip_sync_has_video_input = bool(lip_sync_video_media_id or lip_sync_video_file or lip_sync_video_url)
    lip_sync_requested = bool(lip_sync_speaker_id or lip_sync_has_custom_audio or lip_sync_has_video_input)
    if sound_effect_prompt and lip_sync_requested:
        print("pixverse-smoke failed: sound effect and lip sync cannot both be enabled in the same run")
        return 2
    if lip_sync_has_custom_audio and lip_sync_speaker_id:
        print("pixverse-smoke failed: custom-audio lip sync cannot be combined with TTS lip sync")
        return 2
    if lip_sync_has_custom_audio and lip_sync_text:
        print("pixverse-smoke failed: custom-audio lip sync cannot be combined with lip-sync-text")
        return 2
    if lip_sync_audio_media_id and (lip_sync_audio_file or lip_sync_audio_url):
        print("pixverse-smoke failed: lip-sync-audio-media-id cannot be combined with local audio upload inputs")
        return 2
    if lip_sync_video_media_id and (lip_sync_video_file or lip_sync_video_url):
        print("pixverse-smoke failed: lip-sync-video-media-id cannot be combined with local video upload inputs")
        return 2
    if sound_effect_video_media_id and (sound_effect_video_file or sound_effect_video_url):
        print("pixverse-smoke failed: sound-effect-video-media-id cannot be combined with local video upload inputs")
        return 2
    if sound_effect_prompt:
        env_patch["KG_PIXVERSE_ENABLE_SOUND_EFFECT"] = "true"
        env_patch["KG_PIXVERSE_SOUND_EFFECT_PROMPT"] = sound_effect_prompt
        env_patch["KG_PIXVERSE_KEEP_ORIGINAL_SOUND"] = "false" if arguments.replace_original_sound else "true"
        if sound_effect_video_media_id:
            env_patch["KG_PIXVERSE_SOUND_EFFECT_VIDEO_MEDIA_ID"] = sound_effect_video_media_id
        if sound_effect_video_file:
            env_patch["KG_PIXVERSE_SOUND_EFFECT_VIDEO_FILE_PATH"] = sound_effect_video_file
        if sound_effect_video_url:
            env_patch["KG_PIXVERSE_SOUND_EFFECT_VIDEO_FILE_URL"] = sound_effect_video_url
    if lip_sync_speaker_id or lip_sync_has_custom_audio:
        env_patch["KG_PIXVERSE_ENABLE_LIP_SYNC"] = "true"
        if lip_sync_video_media_id:
            env_patch["KG_PIXVERSE_LIP_SYNC_VIDEO_MEDIA_ID"] = lip_sync_video_media_id
        if lip_sync_video_file:
            env_patch["KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_PATH"] = lip_sync_video_file
        if lip_sync_video_url:
            env_patch["KG_PIXVERSE_LIP_SYNC_VIDEO_FILE_URL"] = lip_sync_video_url
        if lip_sync_audio_media_id:
            env_patch["KG_PIXVERSE_LIP_SYNC_AUDIO_MEDIA_ID"] = lip_sync_audio_media_id
        if lip_sync_audio_file:
            env_patch["KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_PATH"] = lip_sync_audio_file
        if lip_sync_audio_url:
            env_patch["KG_PIXVERSE_LIP_SYNC_AUDIO_FILE_URL"] = lip_sync_audio_url
        if not lip_sync_has_custom_audio:
            env_patch["KG_PIXVERSE_LIP_SYNC_TTS_SPEAKER_ID"] = lip_sync_speaker_id
        if lip_sync_text and not lip_sync_has_custom_audio:
            env_patch["KG_PIXVERSE_LIP_SYNC_TTS_CONTENT"] = lip_sync_text
    elif lip_sync_video_media_id or lip_sync_video_file or lip_sync_video_url:
        print("pixverse-smoke failed: lip-sync video upload inputs require lip sync TTS or custom audio inputs")
        return 2
    with _temporary_env(env_patch):
        state = run_harness(
            input_path=os.path.abspath(str(arguments.input)),
            output_dir=os.path.abspath(str(arguments.output_dir)),
            goal_text=str(arguments.goal_text),
            run_id=str(arguments.run_id),
            provider_mode="pixverse",
            budget=RunBudget(max_steps=40, max_retries_per_task=2, max_wall_seconds=180),
        )

    status = str(state.get("run", {}).get("status") or "")
    verification_passed = bool(state.get("verification", {}).get("passed"))
    observation = state.get("memory", {}).get("observations", {}).get("generate_video", {})
    video = observation.get("video") if isinstance(observation, dict) else {}
    resolved = str(video.get("provider_mode_resolved") or "")
    generation_mode = str(video.get("generation_mode") or "")
    lip_sync_enabled = bool(video.get("lip_sync_enabled"))
    sound_effect_enabled = bool(video.get("sound_effect_enabled"))
    if status != "completed" or not verification_passed:
        print("PixVerse smoke failed: harness did not complete with passing verification")
        return 1
    if resolved != "pixverse" and not arguments.allow_fallback:
        print(f"PixVerse smoke failed: resolved provider_mode={resolved or 'unknown'} (expected pixverse)")
        return 1
    if arguments.print_summary:
        print(json.dumps({
            "run_id": arguments.run_id,
            "status": status,
            "verification_passed": verification_passed,
            "provider_mode_requested": "pixverse",
            "provider_mode_resolved": resolved,
            "generation_mode": generation_mode,
            "lip_sync_enabled": lip_sync_enabled,
            "lip_sync_video_mode": video.get("lip_sync_video_mode"),
            "lip_sync_video_media_id": video.get("lip_sync_video_media_id"),
            "lip_sync_mode": video.get("lip_sync_mode"),
            "lip_sync_audio_media_id": video.get("lip_sync_audio_media_id"),
            "lip_sync_tts_speaker_id": video.get("lip_sync_tts_speaker_id"),
            "lip_sync_tts_content": video.get("lip_sync_tts_content"),
            "sound_effect_enabled": sound_effect_enabled,
            "sound_effect_mode": video.get("sound_effect_mode"),
            "sound_effect_video_media_id": video.get("sound_effect_video_media_id"),
            "sound_effect_prompt": video.get("sound_effect_prompt"),
            "video_url": video.get("url"),
            "manifest_path": video.get("manifest_path"),
        }, indent=2))
    return 0
