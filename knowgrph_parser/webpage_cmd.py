
import argparse
import json
import sys
import time
from html.parser import HTMLParser
from urllib.parse import urljoin, urlparse
from urllib.request import Request, build_opener, HTTPCookieProcessor
import gzip
import http.cookiejar
from typing import Any, Dict, List, Optional, Tuple

from .common import slugify

# --- Fetch Utilities (Shared/Copied from youtube_cmd.py to avoid circular imports if any, or move to common?) ---
# For now, I'll keep it self-contained or import if common.py has them. 
# common.py only has slugify based on previous LS. 
# youtube_cmd.py has the fetch logic. I'll replicate it here for "neutrality" and "isolation".

_COOKIE_JAR = http.cookiejar.CookieJar()
_OPENER = build_opener(HTTPCookieProcessor(_COOKIE_JAR))
_OPENER.addheaders = [
    ("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"),
    ("Accept", "*/*"),
    ("Accept-Language", "en-US,en;q=0.9"),
    ("Accept-Encoding", "gzip, deflate, br"),
]

def _fetch_url(url: str, timeout: int = 30) -> bytes:
    # Retry loop for 429/403/5xx
    max_retries = 3
    for attempt in range(max_retries):
        try:
            import requests
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
                "Accept": "*/*",
                "Accept-Language": "en-US,en;q=0.9",
            }
            # verify=False to bypass legacy SSL issues if any
            resp = requests.get(url, headers=headers, timeout=timeout, verify=False)
            if resp.status_code in {429, 403, 503}:
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))
                    continue
            resp.raise_for_status()
            return resp.content
        except ImportError:
            break # Fallback to urllib
        except Exception:
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
            # If requests failed repeatedly, try urllib fallback or raise
            pass

    req = Request(url, headers={})
    # urllib handles gzip automatically if we don't manually set Accept-Encoding, 
    # but _OPENER sets it. So we need to handle decompression.
    last_err = None
    for attempt in range(max_retries):
        try:
            with _OPENER.open(req, timeout=timeout) as resp:
                content = resp.read()
                if resp.headers.get('Content-Encoding') == 'gzip':
                    return gzip.decompress(content)
                return content
        except Exception as e:
            last_err = e
            # HTTPError is raised for non-200 codes by urllib
            if hasattr(e, 'code') and e.code in {429, 403, 503}:
                if attempt < max_retries - 1:
                    time.sleep(1 * (attempt + 1))
                    continue
            if attempt < max_retries - 1:
                time.sleep(1)
                continue
    
    if last_err:
        raise last_err
    raise Exception("Fetch failed")

# --- HTML Parser ---

class SimpleMarkdownParser(HTMLParser):
    def __init__(self, base_url: str, include_images: bool = True):
        super().__init__()
        self.base_url = base_url
        self.include_images = include_images
        self.output_lines: List[str] = []
        self.current_line: List[str] = []
        self.in_script_or_style = False
        self.title: str = ""
        self.in_title = False
        self.links: List[str] = []
        self.images: List[str] = []
        self.indent_level = 0
        self.list_stack: List[str] = [] # 'ul' or 'ol'
        
        # Fidelity state
        self.in_pre = False
        self.in_code = False
        self.in_table = False
        self.table_buffer: List[str] = [] # To capture HTML for tables
        
    def handle_starttag(self, tag, attrs):
        if tag in {'script', 'style', 'noscript', 'head', 'template'}:
            self.in_script_or_style = True
            return

        if self.in_script_or_style:
            return

        # Pass-through HTML for tables and complex elements for 100% fidelity
        if tag == 'table':
            self.in_table = True
            self.flush_line()
            self.table_buffer = ['<table' + self._attrs_to_str(attrs) + '>']
            return
        if self.in_table:
            self.table_buffer.append('<' + tag + self._attrs_to_str(attrs) + '>')
            # Handle images inside tables
            if tag == 'img' and self.include_images:
                src = dict(attrs).get('src')
                if src:
                    abs_src = urljoin(self.base_url, src)
                    self.images.append(abs_src)
            return

        if tag == 'title':
            self.in_title = True
            return

        if tag in {'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside'}:
            self.flush_line()
        
        if tag in {'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}:
            level = int(tag[1])
            self.current_line.append('#' * level + ' ')

        if tag == 'blockquote':
            self.current_line.append('> ')

        if tag == 'ul':
            self.flush_line()
            self.list_stack.append('ul')
            self.indent_level += 1
        elif tag == 'ol':
            self.flush_line()
            self.list_stack.append('ol')
            self.indent_level += 1
        elif tag == 'li':
            self.flush_line()
            indent = '  ' * (self.indent_level - 1)
            marker = '- ' if self.list_stack and self.list_stack[-1] == 'ul' else '1. '
            self.current_line.append(indent + marker)

        if tag == 'pre':
            self.flush_line()
            self.in_pre = True
            self.output_lines.append("```")
            return

        if tag == 'code' and not self.in_pre:
            self.in_code = True
            self.current_line.append('`')

        if tag in {'strong', 'b'}:
            self.current_line.append('**')
        
        if tag in {'em', 'i'}:
            self.current_line.append('*')

        if tag == 'a':
            href = dict(attrs).get('href')
            if href:
                abs_href = urljoin(self.base_url, href)
                self.current_line.append('[')
                # We store href to close it later
                self._current_href = abs_href

        if tag == 'img':
            if not self.include_images:
                return
            src = dict(attrs).get('src')
            alt = dict(attrs).get('alt', 'Image')
            if src:
                abs_src = urljoin(self.base_url, src)
                self.images.append(abs_src)
                self.flush_line()
                self.output_lines.append(f"![{alt}]({abs_src})")
                self.output_lines.append("")

        if tag == 'hr':
            self.flush_line()
            self.output_lines.append("---")
            self.output_lines.append("")

        if tag == 'br':
            self.output_lines.append("".join(self.current_line))
            self.current_line = []
            
        # Pass-through specific HTML tags that Markdown doesn't handle well or for fidelity
        if tag in {'iframe', 'video'}:
            self.flush_line()
            self.output_lines.append('<' + tag + self._attrs_to_str(attrs) + '>')

    def handle_endtag(self, tag):
        if tag in {'script', 'style', 'noscript', 'head', 'template'}:
            self.in_script_or_style = False
            return

        if self.in_script_or_style:
            return

        if tag == 'table':
            self.in_table = False
            self.table_buffer.append('</table>')
            self.output_lines.append("".join(self.table_buffer))
            self.output_lines.append("")
            self.table_buffer = []
            return
        
        if self.in_table:
            self.table_buffer.append(f'</{tag}>')
            return

        if tag == 'title':
            self.in_title = False
            return

        if tag in {'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'section', 'article', 'header', 'footer', 'nav', 'main', 'aside'}:
            self.flush_line()
            if tag in {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'}:
                self.output_lines.append("")

        if tag in {'ul', 'ol'}:
            if self.list_stack:
                self.list_stack.pop()
            if self.indent_level > 0:
                self.indent_level -= 1
            self.flush_line()
            self.output_lines.append("")

        if tag == 'pre':
            self.output_lines.append("```")
            self.output_lines.append("")
            self.in_pre = False
            return

        if tag == 'code' and not self.in_pre:
            self.in_code = False
            self.current_line.append('`')

        if tag in {'strong', 'b'}:
            self.current_line.append('**')
        
        if tag in {'em', 'i'}:
            self.current_line.append('*')

        if tag == 'a':
            if hasattr(self, '_current_href'):
                self.current_line.append(f"]({self._current_href})")
                del self._current_href

        if tag in {'iframe', 'video'}:
            self.output_lines.append(f'</{tag}>')
            self.output_lines.append("")

    def handle_data(self, data):
        if self.in_script_or_style:
            return
            
        if self.in_table:
            self.table_buffer.append(data)
            return

        if self.in_title:
            self.title += data
            return
        
        if self.in_pre:
            self.output_lines.append(data)
            return
            
        text = data.replace('\n', ' ').strip()
        if text:
            if self.current_line and not self.current_line[-1].endswith(' ') and not self.current_line[-1].endswith('`') and not text.startswith(' ') and not text.startswith('.') and not text.startswith(','):
                 self.current_line.append(' ')
            self.current_line.append(text)

    def _attrs_to_str(self, attrs):
        if not attrs:
            return ""
        return " " + " ".join(f'{k}="{v}"' for k, v in attrs)

    def flush_line(self):
        if self.current_line:
            self.output_lines.append("".join(self.current_line).strip())
            self.current_line = []

    def get_markdown(self) -> str:
        self.flush_line()
        # Clean up empty lines
        cleaned = []
        for line in self.output_lines:
            if line.strip():
                cleaned.append(line)
            elif cleaned and cleaned[-1].strip():
                cleaned.append("")
        
        # Prepend title
        if self.title:
            return f"# {self.title}\n\n" + "\n".join(cleaned)
        return "\n".join(cleaned)


def main(argv: Optional[List[str]] = None, *, parser_script_path: Optional[str] = None) -> int:
    parser = argparse.ArgumentParser(description="Extract webpage to Markdown")
    parser.add_argument("--url", required=True, help="Webpage URL")
    parser.add_argument("--emit", choices=["markdown", "json"], default="markdown")
    parser.add_argument("--no-images", action="store_true", help="Disable image extraction")
    args = parser.parse_args(list(argv) if argv is not None else None)

    url = args.url.strip()
    try:
        html_bytes = _fetch_url(url)
        html_str = html_bytes.decode('utf-8', errors='replace')
        
        parser = SimpleMarkdownParser(url, include_images=not args.no_images)
        parser.feed(html_str)
        markdown = parser.get_markdown()
        
        title = parser.title.strip() or "Webpage Import"
        name = f"webpage-{slugify(title) or slugify(url)}.md"
        
        if args.emit == "json":
            payload = {
                "ok": True,
                "name": name,
                "markdown": markdown,
                "title": title,
                "source_url": url,
                "images": parser.images
            }
            print(json.dumps(payload, ensure_ascii=False))
        else:
            print(markdown)
            
        return 0
    except Exception as e:
        msg = f"Error processing webpage: {e}"
        if args.emit == "json":
            print(json.dumps({"ok": False, "error": msg}, ensure_ascii=False))
            return 0
        print(msg, file=sys.stderr)
        return 1

if __name__ == "__main__":
    sys.exit(main())
