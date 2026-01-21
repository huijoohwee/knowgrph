import argparse
import json
import sys
from typing import Any, Dict, List, Optional, Sequence, Tuple
from urllib.parse import parse_qs, urlparse

from .common import slugify


def _extract_youtube_video_id(url_or_id: str) -> Optional[str]:
    raw = str(url_or_id or "").strip()
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


def _format_transcript_paragraphs(snippets: List[Dict[str, Any]]) -> str:
    if not snippets:
        return ""
    paragraphs: List[str] = []
    current: List[str] = []
    last_end = 0.0
    gap_threshold_s = 2.0
    max_chars = 700

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
            paragraphs.append(" ".join(current).strip())
            current = []
        current.append(text)
        last_end = end
    if current:
        paragraphs.append(" ".join(current).strip())
    return "\n\n".join([p for p in paragraphs if p])


def _build_markdown(video_id: str, url: str, paragraphs: str) -> str:
    lines = [f"# YouTube Transcript: {video_id}", "", f"Source: {url}", ""]
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


def _fetch_transcript_snippets(video_id: str, *, languages: List[str]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
    from youtube_transcript_api import YouTubeTranscriptApi

    meta: Dict[str, Any] = {}
    list_fn = getattr(YouTubeTranscriptApi, "list_transcripts", None)
    if callable(list_fn):
        transcript_list = list_fn(video_id)
        transcript, is_generated = _select_transcript(transcript_list, languages=languages)
        fetched = transcript.fetch()
        snippets = [dict(s) if isinstance(s, dict) else {"text": getattr(s, "text", "")} for s in fetched]
        meta = {
            "languageCode": getattr(transcript, "language_code", None),
            "language": getattr(transcript, "language", None),
            "isGenerated": bool(is_generated),
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
            meta = {
                "languageCode": getattr(transcript, "language_code", None),
                "language": getattr(transcript, "language", None),
                "isGenerated": bool(is_generated),
            }
            return snippets, meta
        fetch_method = getattr(api, "fetch", None)
        if callable(fetch_method):
            fetched = fetch_method(video_id, languages=languages)
            snippets = [dict(s) if isinstance(s, dict) else {"text": getattr(s, "text", "")} for s in fetched]
            meta = {
                "languageCode": None,
                "language": None,
                "isGenerated": None,
            }
            return snippets, meta

    get_fn = getattr(YouTubeTranscriptApi, "get_transcript", None)
    if callable(get_fn):
        try:
            snippets = get_fn(video_id, languages=languages)
        except TypeError:
            snippets = get_fn(video_id)
        meta = {
            "languageCode": None,
            "language": None,
            "isGenerated": None,
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

    source_url = f"https://www.youtube.com/watch?v={video_id}"
    try:
        language = str(getattr(args, "lang", "") or "en").strip() or "en"
        languages = [language]
        if language != "en":
            languages.append("en")

        snippets, meta = _fetch_transcript_snippets(video_id, languages=languages)

        paragraphs = _format_transcript_paragraphs(snippets)
        markdown = _build_markdown(video_id, source_url, paragraphs)
        display_name = f"youtube-{slugify(video_id)}.md"

        if args.emit == "json":
            payload: Dict[str, Any] = {
                "ok": True,
                "type": "rag:YouTubeTranscript",
                "videoId": video_id,
                "url": source_url,
                "languageCode": meta.get("languageCode"),
                "language": meta.get("language"),
                "isGenerated": meta.get("isGenerated"),
                "snippets": snippets,
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
