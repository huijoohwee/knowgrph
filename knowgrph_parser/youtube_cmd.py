import argparse
import json
import re
import sys
import urllib.parse
import urllib.request
from typing import Optional, Sequence


def _coerce_youtube_video_id(raw: str) -> Optional[str]:
    text = str(raw or "").strip()
    if not text:
        return None
    if re.fullmatch(r"[a-zA-Z0-9_-]{11}", text):
        return text
    candidate = text
    if not re.match(r"^https?://", candidate, flags=re.IGNORECASE):
        candidate = "https://" + candidate
    try:
        url = urllib.parse.urlsplit(candidate)
    except Exception:
        return None
    host = (url.hostname or "").lower().lstrip("www.")
    if host == "youtu.be":
        parts = [p for p in (url.path or "").split("/") if p]
        vid = parts[0] if parts else ""
        return vid if re.fullmatch(r"[a-zA-Z0-9_-]{11}", vid) else None
    if host.endswith("youtube.com"):
        qs = urllib.parse.parse_qs(url.query or "")
        v = (qs.get("v") or [""])[0]
        if re.fullmatch(r"[a-zA-Z0-9_-]{11}", v):
            return v
        parts = [p for p in (url.path or "").split("/") if p]
        if parts and parts[0] in {"shorts", "embed"} and len(parts) > 1:
            vid = parts[1]
            return vid if re.fullmatch(r"[a-zA-Z0-9_-]{11}", vid) else None
    return None


def _fetch_youtube_title(video_id: str) -> str:
    source = f"https://www.youtube.com/watch?v={video_id}"
    url = "https://www.youtube.com/oembed?" + urllib.parse.urlencode(
        {"url": source, "format": "json"}
    )
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0",
            "Accept": "application/json",
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            data = resp.read().decode("utf-8", errors="ignore")
        parsed = json.loads(data)
        title = str(parsed.get("title") or "").strip()
        return title or "YouTube Transcript"
    except Exception:
        return "YouTube Transcript"


def _group_paragraphs(segments: Sequence[dict]) -> list[str]:
    paragraphs: list[str] = []
    current: list[str] = []
    current_len = 0
    last_end_s: Optional[float] = None
    for seg in segments:
        text = str(seg.get("text") or "").strip()
        if not text:
            continue
        text = re.sub(r"\s+", " ", text).strip()
        start = seg.get("start")
        dur = seg.get("duration")
        try:
            start_s = float(start)
        except Exception:
            start_s = 0.0
        try:
            dur_s = float(dur)
        except Exception:
            dur_s = 0.0
        end_s = start_s + dur_s
        gap_s = (start_s - last_end_s) if last_end_s is not None else 0.0
        if gap_s >= 1.5 or current_len >= 700:
            if current:
                paragraphs.append(" ".join(current).strip())
                current = []
                current_len = 0
        current.append(text)
        current_len += len(text) + 1
        last_end_s = end_s
        if re.search(r"[.?!]$", text) and current_len >= 420:
            paragraphs.append(" ".join(current).strip())
            current = []
            current_len = 0
    if current:
        paragraphs.append(" ".join(current).strip())
    return [p for p in paragraphs if p]


def _render_markdown(title: str, source_url: str, lang: Optional[str], segments: Sequence[dict]) -> str:
    paragraphs = _group_paragraphs(segments)
    slide_every = 8 if len(paragraphs) > 18 else 6 if len(paragraphs) > 10 else 0
    out: list[str] = []
    out.append(f"# {title.strip() or 'YouTube Transcript'}")
    out.append(f"Source: {source_url}")
    if lang:
        out.append(f"Language: {lang}")
    out.append("")
    out.append("---")
    out.append("")
    out.append("## Transcript")
    out.append("")
    for idx, para in enumerate(paragraphs):
        out.append(para)
        out.append("")
        if slide_every and (idx + 1) % slide_every == 0 and (idx + 1) < len(paragraphs):
            out.append("---")
            out.append("")
    return "\n".join(out).rstrip() + "\n"


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = argparse.ArgumentParser(prog="youtube")
    parser.add_argument("--id", dest="video_id", type=str, default="")
    parser.add_argument("--url", dest="video_url", type=str, default="")
    parser.add_argument("--lang", dest="language", type=str, default="")
    args = parser.parse_args(list(argv) if argv is not None else None)

    raw = (args.video_id or "").strip() or (args.video_url or "").strip()
    video_id = _coerce_youtube_video_id(raw)
    if not video_id:
        print("Invalid YouTube URL or video ID", file=sys.stderr)
        return 2

    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except Exception:
        print(
            "Missing dependency: youtube-transcript-api. Install requirements.txt to enable YouTube transcript import.",
            file=sys.stderr,
        )
        return 3

    lang = (args.language or "").strip()
    source_url = f"https://www.youtube.com/watch?v={video_id}"
    title = _fetch_youtube_title(video_id)
    try:
        api = YouTubeTranscriptApi()
        transcripts = api.list(video_id)
        if lang:
            transcript = transcripts.find_transcript([lang])
        else:
            try:
                transcript = transcripts.find_manually_created_transcript(["en", "en-US", "en-GB"])
            except Exception:
                try:
                    transcript = transcripts.find_generated_transcript(["en", "en-US", "en-GB"])
                except Exception:
                    transcript = next(iter(transcripts))
        fetched = transcript.fetch(preserve_formatting=False)
        segments = fetched.to_raw_data()
    except Exception as e:
        msg = str(e or "").strip() or "Failed to fetch transcript"
        print(msg, file=sys.stderr)
        return 4

    markdown = _render_markdown(title=title, source_url=source_url, lang=lang or None, segments=segments)
    sys.stdout.write(markdown)
    return 0
