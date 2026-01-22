import argparse
import json
import os
import re
import sys
import time
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import parse_qs, quote, urlparse
from urllib.request import Request, urlopen

from .common import slugify
from .youtube_tools import try_fetch_segments_with_ytdlp_subtitles, try_transcribe_with_whisper


def _unwrap_user_provided_text(text: str) -> str:
    raw = str(text or "").strip()
    if not raw:
        return ""
    s = raw
    for _ in range(6):
        s2 = s.strip()
        if len(s2) >= 2 and s2[0] == "`" and s2[-1] == "`":
            s = s2[1:-1]
            continue
        if len(s2) >= 2 and s2[0] == "(" and s2[-1] == ")":
            s = s2[1:-1]
            continue
        if len(s2) >= 2 and s2[0] == "<" and s2[-1] == ">":
            s = s2[1:-1]
            continue
        if len(s2) >= 2 and s2[0] == "[" and s2[-1] == "]":
            s = s2[1:-1]
            continue
        if len(s2) >= 2 and s2[0] == "{" and s2[-1] == "}":
            s = s2[1:-1]
            continue
        s = s2
        break
    s = s.strip()
    s = s.strip(" \t\r\n`'\".,;:!?")
    if s.startswith("(") and s.endswith(")"):
        s = s[1:-1].strip()
    if s.startswith("<") and s.endswith(">"):
        s = s[1:-1].strip()
    return s.strip()


def _extract_youtube_video_id(url_or_id: str) -> Optional[str]:
    raw = _unwrap_user_provided_text(str(url_or_id or ""))
    if not raw:
        return None
    if len(raw) == 11 and all(c.isalnum() or c in "_-" for c in raw):
        return raw
    try:
        parsed = urlparse(raw)
    except Exception:
        return None
    if not parsed.scheme and not parsed.netloc:
        return None
    host = (parsed.netloc or "").lower()
    path = parsed.path or ""
    query = parse_qs(parsed.query or "")
    if "v" in query and query["v"]:
        candidate = str(query["v"][0] or "").strip()
        if len(candidate) == 11:
            return candidate
    if host.endswith("youtu.be"):
        candidate = path.strip("/").split("/")[0] if path else ""
        if len(candidate) == 11:
            return candidate
    parts = [p for p in path.split("/") if p]
    for idx, part in enumerate(parts):
        if part in {"embed", "shorts"} and idx + 1 < len(parts):
            candidate = parts[idx + 1]
            if len(candidate) == 11:
                return candidate
    for part in parts:
        if len(part) == 11:
            return part
    return None


def _parse_language_codes(raw: str) -> List[str]:
    s = str(raw or "").strip()
    if not s:
        return ["en"]
    out: List[str] = []
    seen: set[str] = set()
    for part in s.split(","):
        code = str(part or "").strip().lower()
        if not code:
            continue
        if code in seen:
            continue
        seen.add(code)
        out.append(code)
    return out or ["en"]


def _build_youtube_source_url(video_id: str, start_s: int) -> str:
    vid = str(video_id or "").strip()
    if not vid:
        return ""
    t = int(start_s or 0)
    if t > 0:
        return f"https://youtu.be/{vid}?t={t}"
    return f"https://youtu.be/{vid}"


def _parse_time_to_seconds(raw: str) -> int:
    s = str(raw or "").strip().lower()
    if not s:
        return 0
    if s.isdigit():
        return int(s)
    m = re.fullmatch(r"(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?", s)
    if not m:
        return 0
    h = int(m.group(1) or 0)
    mm = int(m.group(2) or 0)
    ss = int(m.group(3) or 0)
    return h * 3600 + mm * 60 + ss


def _extract_requested_start_time_s(url_or_id: str) -> int:
    raw = _unwrap_user_provided_text(str(url_or_id or ""))
    if not raw:
        return 0
    try:
        parsed = urlparse(raw)
    except Exception:
        return 0
    query = parse_qs(parsed.query or "")
    cand = ""
    if "t" in query and query["t"]:
        cand = str(query["t"][0] or "")
    elif "start" in query and query["start"]:
        cand = str(query["start"][0] or "")
    if not cand and parsed.fragment:
        frag = parsed.fragment
        if "=" in frag:
            frag_qs = parse_qs(frag)
            if "t" in frag_qs and frag_qs["t"]:
                cand = str(frag_qs["t"][0] or "")
        else:
            cand = frag
    return _parse_time_to_seconds(cand)


def _normalize_segments(segments: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for seg in segments or []:
        if not seg or not isinstance(seg, dict):
            continue
        text = str(seg.get("text", "") or "").strip()
        if not text:
            continue
        start: Optional[float] = None
        duration: Optional[float] = None

        if start is None and "start" in seg:
            try:
                start = float(seg.get("start") or 0.0)
            except Exception:
                start = None
        if start is None and "start_s" in seg:
            try:
                start = float(seg.get("start_s") or 0.0)
            except Exception:
                start = None
        if start is None and "start_ms" in seg:
            try:
                start = float(seg.get("start_ms") or 0.0) / 1000.0
            except Exception:
                start = None

        if duration is None and "duration" in seg:
            try:
                duration = float(seg.get("duration") or 0.0)
            except Exception:
                duration = None
        if duration is None and "duration_s" in seg:
            try:
                duration = float(seg.get("duration_s") or 0.0)
            except Exception:
                duration = None

        if (duration is None or duration <= 0.0) and "end" in seg and start is not None:
            try:
                end = float(seg.get("end") or 0.0)
                duration = max(0.0, end - start)
            except Exception:
                duration = duration
        if (duration is None or duration <= 0.0) and "end_ms" in seg and start is not None:
            try:
                end = float(seg.get("end_ms") or 0.0) / 1000.0
                duration = max(0.0, end - start)
            except Exception:
                duration = duration
        if start is None:
            start = 0.0
        if duration is None:
            duration = 0.0
        out.append({"text": text, "start": float(start), "duration": float(duration)})
    out.sort(key=lambda x: float(x.get("start", 0.0) or 0.0))
    return out


def _compute_timing_metrics(segments: List[Dict[str, Any]]) -> Dict[str, Any]:
    segs = _normalize_segments(segments or [])
    if not segs:
        return {"start_s": 0.0, "end_s": 0.0, "duration_s": 0.0, "segment_count": 0}
    start_s = min(float(s.get("start") or 0.0) for s in segs)
    end_s = max(float(s.get("start") or 0.0) + float(s.get("duration") or 0.0) for s in segs)
    return {
        "start_s": float(start_s),
        "end_s": float(end_s),
        "duration_s": float(max(0.0, end_s - start_s)),
        "segment_count": int(len(segs)),
    }


def _collect_segments_from_obj(obj: Any) -> List[Dict[str, Any]]:
    if not obj or not isinstance(obj, dict):
        return []
    if isinstance(obj.get("segments"), list):
        return [s for s in obj.get("segments") if isinstance(s, dict)]
    out: List[Dict[str, Any]] = []
    chunks = obj.get("chunks")
    if isinstance(chunks, list):
        for ch in chunks:
            if not isinstance(ch, dict):
                continue
            segs = ch.get("segments")
            if isinstance(segs, list):
                out.extend([s for s in segs if isinstance(s, dict)])
    return out


def _parse_whisper_json_obj(obj: Any) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    if not obj or not isinstance(obj, dict):
        return [], {}
    meta: Dict[str, Any] = {}
    if isinstance(obj.get("language"), str) and obj.get("language"):
        meta["language"] = str(obj.get("language") or "")
    if isinstance(obj.get("text"), str) and obj.get("text"):
        meta["transcript_text"] = str(obj.get("text") or "")
    segments_raw = obj.get("segments")
    segs: List[Dict[str, Any]] = []
    if isinstance(segments_raw, list):
        for s in segments_raw:
            if not isinstance(s, dict):
                continue
            text = str(s.get("text", "") or "").strip()
            if not text:
                continue
            start = float(s.get("start") or 0.0)
            if "duration" in s:
                duration = float(s.get("duration") or 0.0)
            else:
                duration = max(0.0, float(s.get("end") or 0.0) - start)
            segs.append({"text": text, "start": float(start), "duration": float(duration)})
    return _normalize_segments(segs), meta


def _format_transcript_paragraphs(snippets: List[Dict[str, Any]], *, video_id: Optional[str] = None) -> str:
    if not snippets:
        return ""
    vid = str(video_id or "").strip()
    paragraphs: List[str] = []
    current: List[str] = []
    last_end = 0.0
    gap_threshold_s = 2.0
    max_chars = 700
    current_start_s: Optional[int] = None

    for entry in snippets:
        text = str(entry.get("text", "") or "").strip()
        if not text:
            continue
        start = float(entry.get("start", 0.0) or 0.0)
        duration = float(entry.get("duration", 0.0) or 0.0)
        end = start + duration
        gap = start - last_end
        cur_len = sum(len(t) for t in current)
        if current and (gap > gap_threshold_s or cur_len >= max_chars):
            prefix = ""
            if vid and current_start_s is not None:
                prefix = f"https://youtu.be/{vid}?t={int(current_start_s)}\n"
            paragraphs.append(prefix + " ".join(current).strip())
            current = []
            current_start_s = None
        if current_start_s is None:
            current_start_s = int(max(0.0, start))
        current.append(text)
        last_end = end
    if current:
        prefix = ""
        if vid and current_start_s is not None:
            prefix = f"https://youtu.be/{vid}?t={int(current_start_s)}\n"
        paragraphs.append(prefix + " ".join(current).strip())
    return "\n\n".join([p for p in paragraphs if p])


def _build_markdown(*, title: str, video_id: str, source_url: str, paragraphs: str) -> str:
    safe_title = str(title or "").strip() or f"YouTube Transcript: {video_id}"
    lines = [f"# {safe_title}", "", f"Video ID: {video_id}", f"Source: [{source_url}]({source_url})", ""]
    if paragraphs.strip():
        lines.append(paragraphs.strip())
    else:
        lines.append("(No transcript text returned.)")
    return "\n".join(lines).rstrip() + "\n"


def _select_transcript(
    transcript_list: Any, *, languages: List[str]
) -> Tuple[Any, bool]:
    from youtube_transcript_api import NoTranscriptFound

    try:
        return transcript_list.find_manually_created_transcript(languages), False
    except NoTranscriptFound:
        try:
            return transcript_list.find_generated_transcript(languages), True
        except NoTranscriptFound:
            return transcript_list.find_transcript(languages), True


def _fetch_oembed(*, watch_url: str) -> Optional[Dict[str, Any]]:
    url = str(watch_url or "").strip()
    if not url:
        return None
    endpoint = f"https://www.youtube.com/oembed?url={quote(url, safe='')}&format=json"
    try:
        req = Request(endpoint, headers={"User-Agent": "knowgrph/1.0"})
        with urlopen(req, timeout=5) as resp:
            data = resp.read()
        if not data:
            return None
        parsed = json.loads(data.decode("utf-8", errors="replace"))
        if parsed and isinstance(parsed, dict):
            return parsed
        return None
    except Exception:
        return None


def _normalize_translation_languages(obj: Any) -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    if not obj:
        return out
    if isinstance(obj, list):
        for item in obj:
            if isinstance(item, dict):
                code = str(item.get("language_code", "") or item.get("languageCode", "") or "").strip()
                lang = str(item.get("language", "") or "").strip()
                if code or lang:
                    out.append({"language_code": code or None, "language": lang or None})
            else:
                code = str(getattr(item, "language_code", "") or getattr(item, "languageCode", "") or "").strip()
                lang = str(getattr(item, "language", "") or "").strip()
                if code or lang:
                    out.append({"language_code": code or None, "language": lang or None})
    return out


def _fetch_transcript_snippets(video_id: str, *, languages: List[str]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    from youtube_transcript_api import YouTubeTranscriptApi

    meta: Dict[str, Any] = {}
    list_fn = getattr(YouTubeTranscriptApi, "list_transcripts", None)
    if callable(list_fn):
        transcript_list = list_fn(video_id)
        transcript, is_generated = _select_transcript(transcript_list, languages=languages)
        fetched = transcript.fetch()
        snippets = [dict(s) if isinstance(s, dict) else {"text": getattr(s, "text", "")} for s in fetched]
        is_translatable = bool(getattr(transcript, "is_translatable", False))
        translation_languages = _normalize_translation_languages(getattr(transcript, "translation_languages", None))
        meta = {
            "selected_language_code": getattr(transcript, "language_code", None),
            "selected_language": getattr(transcript, "language", None),
            "is_generated": bool(is_generated),
            "is_translatable": bool(is_translatable),
            "translation_languages": translation_languages,
        }
        return snippets, meta

    try:
        api = YouTubeTranscriptApi()
    except Exception:
        api = None

    if api is not None:
        list_method = getattr(api, "list", None)
        if callable(list_method):
            transcript_list = list_method(video_id)
            transcript, is_generated = _select_transcript(transcript_list, languages=languages)
            fetched = transcript.fetch()
            snippets = [dict(s) if isinstance(s, dict) else {"text": getattr(s, "text", "")} for s in fetched]
            is_translatable = bool(getattr(transcript, "is_translatable", False))
            translation_languages = _normalize_translation_languages(getattr(transcript, "translation_languages", None))
            meta = {
                "selected_language_code": getattr(transcript, "language_code", None),
                "selected_language": getattr(transcript, "language", None),
                "is_generated": bool(is_generated),
                "is_translatable": bool(is_translatable),
                "translation_languages": translation_languages,
            }
            return snippets, meta
        fetch_method = getattr(api, "fetch", None)
        if callable(fetch_method):
            fetched = fetch_method(video_id, languages=languages)
            snippets = [dict(s) if isinstance(s, dict) else {"text": getattr(s, "text", "")} for s in fetched]
            meta = {
                "selected_language_code": None,
                "selected_language": None,
                "is_generated": None,
                "is_translatable": None,
                "translation_languages": [],
            }
            return snippets, meta

    get_fn = getattr(YouTubeTranscriptApi, "get_transcript", None)
    if callable(get_fn):
        try:
            snippets = get_fn(video_id, languages=languages)
        except TypeError:
            snippets = get_fn(video_id)
        meta = {
            "selected_language_code": None,
            "selected_language": None,
            "is_generated": None,
            "is_translatable": None,
            "translation_languages": [],
        }
        return [dict(s) for s in (snippets or [])], meta

    raise AttributeError("youtube-transcript-api does not expose list_transcripts or get_transcript")


def main(argv: Optional[Sequence[str]] = None, *, parser_script_path: Optional[str] = None) -> int:
    parser = argparse.ArgumentParser(description="Extract YouTube transcript to Markdown or JSON")
    parser.add_argument("--url", required=True, help="YouTube video URL or ID")
    parser.add_argument("--lang", default="en", help="Language code priority (default: en)")
    parser.add_argument("--emit", choices=["markdown", "json"], default="markdown")
    args = parser.parse_args(list(argv) if argv is not None else None)

    video_id = _extract_youtube_video_id(args.url)
    if not video_id:
        message = f"Could not extract video ID from '{args.url}'"
        if args.emit == "json":
            print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
            return 1
        print(f"Error: {message}", file=sys.stderr)
        return 1

    try:
        from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound
    except ImportError:
        message = "youtube-transcript-api is required. Install with python3 -m pip install youtube-transcript-api."
        if args.emit == "json":
            print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
            return 1
        print(f"Error: {message}", file=sys.stderr)
        return 1

    try:
        requested_languages = _parse_language_codes(getattr(args, "lang", "") or "en")
        if "en" not in requested_languages:
            requested_languages.append("en")
        requested_language_code = requested_languages[0] if requested_languages else "en"
        languages = requested_languages

        requested_start_s = _extract_requested_start_time_s(args.url)
        source_url = _build_youtube_source_url(video_id, requested_start_s)
        watch_url = f"https://www.youtube.com/watch?v={video_id}"

        tools_timeout_s = 180
        try:
            raw = int(os.environ.get("KG_YOUTUBE_TOOLS_TIMEOUT_S", "") or "0")
            if raw > 0:
                tools_timeout_s = max(10, min(3600, raw))
        except Exception:
            tools_timeout_s = 180
        whisper_model = str(os.environ.get("KG_WHISPER_MODEL", "") or "").strip() or "base"

        segments: List[Dict[str, Any]] = []
        meta: Dict[str, Any] = {}
        try:
            snippets, meta = _fetch_transcript_snippets(video_id, languages=languages)
            segments = _normalize_segments(snippets)
        except (TranscriptsDisabled, NoTranscriptFound):
            segs_and_meta = try_fetch_segments_with_ytdlp_subtitles(
                args.url, languages=languages, timeout_s=tools_timeout_s
            )
            if segs_and_meta:
                segments = _normalize_segments(segs_and_meta[0])
                meta = dict(segs_and_meta[1] or {})
            if not segments:
                whisper_obj = try_transcribe_with_whisper(
                    args.url,
                    language_code=requested_language_code,
                    timeout_s=tools_timeout_s,
                    whisper_model=whisper_model,
                )
                if whisper_obj:
                    w_segments, w_meta = _parse_whisper_json_obj(whisper_obj)
                    segments = _normalize_segments(w_segments)
                    w_lang = (
                        str(w_meta.get("language") or "").strip().lower()
                        if isinstance(w_meta.get("language"), str)
                        else ""
                    )
                    selected = w_lang or requested_language_code
                    meta = {
                        "selected_language_code": selected,
                        "selected_language": selected,
                        "is_generated": True,
                        "is_translatable": False,
                        "translation_languages": [],
                    }
        if not segments:
            raise NoTranscriptFound("Transcript unavailable via youtube-transcript-api and tool fallbacks")

        timing = _compute_timing_metrics(segments)
        oembed = _fetch_oembed(watch_url=watch_url) or {}
        title = str(oembed.get("title") or "").strip() or f"YouTube Transcript: {video_id}"
        paragraphs = _format_transcript_paragraphs(segments, video_id=video_id)
        markdown = _build_markdown(title=title, video_id=video_id, source_url=source_url, paragraphs=paragraphs)
        display_name = f"youtube-{slugify(video_id)}.md"
        generated_at_ms = int(time.time() * 1000)
        selected_language_code = meta.get("selected_language_code")
        selected_language = meta.get("selected_language")
        is_generated = meta.get("is_generated")
        is_translatable = meta.get("is_translatable")
        translation_languages = meta.get("translation_languages") or []
        if not isinstance(selected_language_code, str) or not selected_language_code.strip():
            selected_language_code = requested_language_code
        if not isinstance(selected_language, str) or not selected_language.strip():
            selected_language = selected_language_code
        if not isinstance(is_generated, bool):
            is_generated = True
        if not isinstance(is_translatable, bool):
            is_translatable = False
        if not isinstance(translation_languages, list):
            translation_languages = []

        if args.emit == "json":
            payload: Dict[str, Any] = {
                "ok": True,
                "type": "rag:YouTubeTranscript",
                "title": title,
                "video_id": video_id,
                "source_url": source_url,
                "requested_language_code": requested_language_code,
                "requested_language": requested_language_code,
                "requested_languages": requested_languages,
                "requested_start_s": int(requested_start_s),
                "selected_language_code": selected_language_code,
                "selected_language": selected_language,
                "is_generated": is_generated,
                "is_translatable": is_translatable,
                "translation_languages": translation_languages,
                "oembed": oembed,
                "start_s": float(timing.get("start_s") or 0.0),
                "end_s": float(timing.get("end_s") or 0.0),
                "duration_s": float(timing.get("duration_s") or 0.0),
                "segment_count": int(timing.get("segment_count") or 0),
                "generated_at_ms": int(generated_at_ms),
                "segments": segments,
                "markdown": markdown,
                "name": display_name,
            }
            print(json.dumps(payload, ensure_ascii=False))
            return 0

        print(markdown, end="")
        return 0

    except (TranscriptsDisabled, NoTranscriptFound) as e:
        message = f"Transcript not available for video {video_id}. {str(e)}"
        if args.emit == "json":
            print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
            return 1
        print(f"Error: {message}", file=sys.stderr)
        return 1
    except Exception as e:
        message = f"Error processing YouTube video: {e}"
        if args.emit == "json":
            print(json.dumps({"ok": False, "error": message}, ensure_ascii=False))
            return 1
        print(message, file=sys.stderr)
        return 1
