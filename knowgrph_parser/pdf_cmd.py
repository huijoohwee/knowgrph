import argparse
from typing import Optional, Sequence
import sys
import os
import re


def _coerce_asset_url_prefix(value: Optional[str]) -> str:
    raw = str(value or "").strip()
    if not raw:
        return ""
    return raw.rstrip("/")


def _infer_image_extension(data: bytes) -> str:
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"GIF87a") or data.startswith(b"GIF89a"):
        return ".gif"
    if data.startswith(b"RIFF") and b"WEBP" in data[8:16]:
        return ".webp"
    return ".bin"


def _sanitize_filename(value: str) -> str:
    s = str(value or "").strip().lower()
    s = re.sub(r"[^a-z0-9._-]+", "-", s)
    s = s.strip("._-")
    return s or "asset"


def _write_pdf_assets(reader, assets_dir: str) -> list[dict[str, str]]:
    assets: list[dict[str, str]] = []
    os.makedirs(assets_dir, exist_ok=True)
    for page_idx, page in enumerate(reader.pages):
        try:
            images = getattr(page, "images", None)
        except Exception:
            images = None
        if not images:
            continue
        for img_idx, image_obj in enumerate(images):
            try:
                data = bytes(image_obj.data)
            except Exception:
                continue
            ext = _infer_image_extension(data)
            name_hint = ""
            try:
                name_hint = str(getattr(image_obj, "name", "") or "")
            except Exception:
                name_hint = ""
            base = _sanitize_filename(name_hint) if name_hint else "img"
            filename = f"page-{page_idx+1:04d}-{base}-{img_idx+1:03d}{ext}"
            path = os.path.join(assets_dir, filename)
            try:
                with open(path, "wb") as f:
                    f.write(data)
            except Exception:
                continue
            assets.append({"page": str(page_idx + 1), "filename": filename})
    return assets

def main(argv: Optional[Sequence[str]] = None, *, parser_script_path: Optional[str] = None) -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, help="Path to input PDF file")
    parser.add_argument("--assets-dir", required=False, help="Directory to write extracted assets")
    parser.add_argument("--asset-url-prefix", required=False, help="URL prefix to use for asset links")
    parser.add_argument("--title", required=False, help="Markdown document title")
    args = parser.parse_args(list(argv) if argv is not None else None)

    try:
        from pypdf import PdfReader
    except ImportError:
        raise SystemExit("pypdf is required. Install with pip install pypdf.")

    try:
        reader = PdfReader(args.input)
        assets_dir = str(getattr(args, "assets_dir", "") or "").strip()
        asset_url_prefix = _coerce_asset_url_prefix(getattr(args, "asset_url_prefix", None))
        assets: list[dict[str, str]] = []
        if assets_dir:
            try:
                assets = _write_pdf_assets(reader, assets_dir)
            except Exception:
                assets = []

        markdown_output = []
        doc_title = str(getattr(args, "title", "") or "").strip() or os.path.basename(str(args.input or "").strip()) or "document.pdf"
        markdown_output.append(f"# {doc_title}\n")
        
        for i, page in enumerate(reader.pages):
            text = page.extract_text()
            markdown_output.append(f"## Page {i+1}\n")
            if asset_url_prefix and assets:
                page_assets = [a for a in assets if a.get("page") == str(i + 1)]
                for idx, a in enumerate(page_assets):
                    fn = a.get("filename") or ""
                    if not fn:
                        continue
                    markdown_output.append(f"![Page {i+1} image {idx+1}]({asset_url_prefix}/{fn})\n")
                if page_assets:
                    markdown_output.append("\n")
            if text:
                markdown_output.append(text.strip())
                markdown_output.append("\n")
            
            try:
                if page.annotations:
                    links = []
                    for annot in page.annotations:
                        obj = annot.get_object()
                        if obj.get("/Subtype") == "/Link":
                            action = obj.get("/A")
                            if action and action.get("/URI"):
                                uri = action.get("/URI")
                                links.append(uri)
                    if links:
                        markdown_output.append("\n### Links\n")
                        for link in links:
                            markdown_output.append(f"- <{link}>\n")
                        markdown_output.append("\n")
            except Exception:
                pass
        
        print("\n".join(markdown_output), end="")
        return 0

    except Exception as e:
        print(f"Error processing PDF: {e}", file=sys.stderr)
        return 1
