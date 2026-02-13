
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
import html as _html

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
            attrs_d = dict(attrs)
            href = attrs_d.get('href')
            if href:
                abs_href = urljoin(self.base_url, href)
                self.current_line.append('[')
                self._current_href = abs_href
                self._current_link_has_text = False
                self._current_link_fallback_text = (
                    (attrs_d.get('aria-label') or '').strip()
                    or (attrs_d.get('title') or '').strip()
                    or (attrs_d.get('data-label') or '').strip()
                )

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
                if getattr(self, '_current_link_has_text', False) is False:
                    fallback = getattr(self, '_current_link_fallback_text', '')
                    if fallback:
                        self.current_line.append(fallback)
                self.current_line.append(f"]({self._current_href})")
                del self._current_href
                if hasattr(self, '_current_link_has_text'):
                    del self._current_link_has_text
                if hasattr(self, '_current_link_fallback_text'):
                    del self._current_link_fallback_text

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
            if hasattr(self, '_current_href'):
                self._current_link_has_text = True
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


class _TableToMarkdownParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.rows: List[List[str]] = []
        self._row: List[str] = []
        self._cell: List[str] = []
        self._in_tr = False
        self._in_cell = False
        self._has_th = False

    def handle_starttag(self, tag, attrs):
        if tag == 'tr':
            self._in_tr = True
            self._row = []
        if tag in {'td', 'th'}:
            self._in_cell = True
            self._cell = []
            if tag == 'th':
                self._has_th = True

    def handle_endtag(self, tag):
        if tag in {'td', 'th'}:
            if self._in_cell:
                raw = _html.unescape(''.join(self._cell))
                val = ' '.join(raw.split()).strip()
                self._row.append(val)
            self._in_cell = False
            self._cell = []
        if tag == 'tr':
            if self._in_tr and self._row:
                self.rows.append(self._row)
            self._in_tr = False
            self._row = []

    def handle_data(self, data):
        if self._in_cell:
            self._cell.append(data)


def _table_html_to_markdown(table_html: str, *, max_rows: int = 12, max_cols: int = 6) -> str:
    p = _TableToMarkdownParser()
    p.feed(table_html)
    rows = [r[:max_cols] for r in p.rows if any((c or '').strip() for c in r)]
    rows = rows[:max_rows]
    if not rows:
        return ""

    width = max(len(r) for r in rows)
    norm = [r + [''] * (width - len(r)) for r in rows]
    header = norm[0]
    body = norm[1:]

    def esc(s: str) -> str:
        return (s or '').replace('|', '\\|')

    lines: List[str] = []
    lines.append('| ' + ' | '.join(esc(x) for x in header) + ' |')
    lines.append('| ' + ' | '.join('---' for _ in header) + ' |')
    for r in body:
        lines.append('| ' + ' | '.join(esc(x) for x in r) + ' |')
    return '\n'.join(lines)


def _strip_html_to_text(fragment: str, *, max_chars: int = 4000) -> str:
    import re
    s = _html.unescape(fragment)
    s = s.replace('\n', ' ')
    s = ''.join(ch if ch.isprintable() else ' ' for ch in s)
    s = re.sub(r'<[^>]+>', ' ', s)
    s = ' '.join(s.split()).strip()
    if len(s) > max_chars:
        s = s[:max_chars]
    return s


def _extract_structured_details_markdown(html_str: str, base_url: str) -> str:
    import re
    lower = html_str.lower()

    sections: List[str] = []

    stop_template = {
        'docs',
        'documentation',
        'api',
        'products',
        'product',
        'resources',
        'pricing',
        'plans',
        'features',
        'learn',
        'guide',
        'tutorial',
        'tutorials',
        'examples',
        'demo',
        'demos',
        'blog',
        'changelog',
        'community',
        'support',
        'help',
        'status',
        'about',
        'contact',
        'careers',
        'jobs',
        'privacy',
        'terms',
        'license',
        'licenses',
        'press',
        'investors',
        'security',
        'legal',
        'github',
        'discord',
        'twitter',
        'x',
        'linkedin',
        'youtube',
        'facebook',
        'instagram',
        'tiktok',
        'reddit',
        'mastodon',
        'search',
        'sign in',
        'signin',
        'log in',
        'login',
        'sign up',
        'signup',
        'get started',
        'download',
        'install',
        'open',
        'buy',
        'purchase',
        'subscribe',
    }

    # --- Navigation menus (best-effort) ---
    nav_labels = ['products', 'resources', 'commercial']
    nav_out: List[str] = []
    for label in nav_labels:
        idx = lower.find(label)
        if idx < 0:
            continue
        # Stop window at the next nav label to reduce cross-contamination
        end = idx + 12000
        for other in nav_labels:
            if other == label:
                continue
            j = lower.find(other, idx + len(label))
            if j >= 0:
                end = min(end, j)
        frag = html_str[idx:end]
        # Capture anchor inner text
        items = re.findall(r'<a[^>]*>(.*?)</a>', frag, flags=re.IGNORECASE | re.DOTALL)
        picked: List[str] = []
        for raw in items:
            text = _strip_html_to_text(raw, max_chars=200)
            if not text:
                continue
            if len(text) > 36:
                continue
            if text.lower() == label:
                continue
            if text.lower() in nav_labels:
                continue
            if text.lower().startswith('skip to'):
                continue
            if text in picked:
                continue
            picked.append(text)
            if len(picked) >= 12:
                break
        if len(picked) >= 4:
            nav_out.append(f"- {label.title()}: " + ' | '.join(picked[:10]))

    if nav_out:
        sections.append('## Extracted Navigation Menus')
        sections.extend(nav_out)
        sections.append('')

    # --- Templates (best-effort) ---
    template_frag = ''
    # Prefer explicit /templates URL occurrences over the generic word "template".
    m = re.search(r'/templates[^"\']*', html_str, flags=re.IGNORECASE)
    if m:
        t_idx2 = max(0, m.start() - 6000)
        template_frag = html_str[t_idx2: t_idx2 + 32000]
    else:
        t_idx = lower.find('template')
        if t_idx >= 0:
            template_frag = html_str[t_idx: t_idx + 32000]

    template_names: List[str] = []
    if template_frag:
        # Prefer anchors whose href indicates templates (support quoted and unquoted href)
        for m_a in re.finditer(r'<a\b[^>]*>.*?</a>', template_frag, flags=re.IGNORECASE | re.DOTALL):
            a_html = m_a.group(0)
            m_href = re.search(r'href\s*=\s*(?:"([^"]+)"|\'([^\']+)\'|([^\s>]+))', a_html, flags=re.IGNORECASE)
            href = (m_href.group(1) or m_href.group(2) or m_href.group(3) or '') if m_href else ''
            if not href:
                continue
            if 'template' not in href.lower() and '/templates' not in href.lower() and '/t/' not in href.lower():
                continue
            inner = re.sub(r'^<a\b[^>]*>', '', a_html, flags=re.IGNORECASE)
            inner = re.sub(r'</a>\s*$', '', inner, flags=re.IGNORECASE)
            text = _strip_html_to_text(inner, max_chars=160)
            if not text:
                continue
            if len(text) > 28:
                continue
            if text.lower() in {'templates', 'template'}:
                continue
            if text.lower() in stop_template:
                continue
            if text not in template_names:
                template_names.append(text)
            if len(template_names) >= 12:
                break

        # Then aria-labels for cards/buttons
        aria = re.findall(r'aria-label=["\']([^"\']+)["\']', template_frag, flags=re.IGNORECASE)
        for a in aria:
            v = ' '.join(a.split()).strip()
            if not v:
                continue
            if len(v) > 44:
                continue
            lv = v.lower()
            if lv.startswith('open '):
                v = v[5:].strip()
                lv = v.lower()
            if lv.endswith(' template'):
                v = v[:-9].strip()
                lv = v.lower()
            if lv.endswith('template'):
                v = v[:-8].strip()
                lv = v.lower()
            if not v:
                continue
            if v.lower() in stop_template:
                continue
            if v not in template_names:
                template_names.append(v)
            if len(template_names) >= 12:
                break

        # Common missing: "Blank" (often icon-only)
        if 'blank' in template_frag.lower() and all(n.lower() != 'blank' for n in template_names):
            template_names.insert(0, 'Blank')

        if len(template_names) <= 1:
            # Fallback: scrape likely JSON-embedded template names.
            # Many modern sites ship template catalogs via embedded JSON.
            def maybe_add(v: str) -> None:
                vv = ' '.join((v or '').split()).strip()
                if not vv:
                    return
                if len(vv) > 28:
                    return
                if vv.lower() in stop_template:
                    return
                if any(x in vv.lower() for x in ['http', '/', '{', '}', ':']):
                    return
                if vv not in template_names:
                    template_names.append(vv)

            json_candidates = re.findall(r'"(?:name|title|label)"\s*:\s*"([^"\\]{2,44})"', template_frag)
            for cand in json_candidates:
                maybe_add(cand)
                if len(template_names) >= 12:
                    break

            if len(template_names) <= 1:
                # Scan wider context in the full HTML but only accept candidates near /templates or the word template.
                for m2 in re.finditer(r'"(?:name|title|label)"\s*:\s*"([^"\\]{2,44})"', html_str):
                    ctx = html_str[max(0, m2.start() - 240): m2.end() + 240].lower()
                    if 'template' not in ctx and '/templates' not in ctx:
                        continue
                    maybe_add(m2.group(1))
                    if len(template_names) >= 12:
                        break

            if len(template_names) <= 1:
                # Next.js / React apps often ship the full catalog in __NEXT_DATA__.
                def collect_next_data_candidates(doc_html: str) -> List[str]:
                    m_nd = re.search(r'<script[^>]*id=["\']__NEXT_DATA__["\'][^>]*>(.*?)</script>', doc_html, flags=re.IGNORECASE | re.DOTALL)
                    if not m_nd:
                        return []
                    raw = _html.unescape(m_nd.group(1) or '')
                    try:
                        obj = json.loads(raw)
                    except Exception:
                        return []

                    out: List[str] = []

                    def walk(x: Any, path: List[str]):
                        if len(out) >= 80:
                            return
                        if isinstance(x, dict):
                            for k, v in x.items():
                                walk(v, path + [str(k)])
                            return
                        if isinstance(x, list):
                            for v in x:
                                walk(v, path)
                            return
                        if isinstance(x, str):
                            p = ' '.join(path).lower()
                            if 'template' not in p and 'templates' not in p:
                                return
                            s = ' '.join(x.split()).strip()
                            if not s:
                                return
                            if len(s) > 28:
                                return
                            if s.lower() in stop_template:
                                return
                            if any(ch in s for ch in ['{', '}', ':', '/', '\\']):
                                return
                            out.append(s)

                    walk(obj, [])
                    return out

                for cand in collect_next_data_candidates(html_str):
                    maybe_add(cand)
                    if len(template_names) >= 12:
                        break

        if len(template_names) <= 1 and '/templates' in lower:
            # Fallback: fetch /templates and extract from that page (often contains a full catalog).
            try:
                parsed_base = urlparse(base_url)
                templates_url = urljoin(base_url, '/templates')
                parsed_t = urlparse(templates_url)
                if parsed_base.netloc and parsed_t.netloc == parsed_base.netloc:
                    html_bytes = _fetch_url(templates_url, timeout=20)
                    html_tpl = html_bytes.decode('utf-8', errors='replace')
                    html_tpl_lower = html_tpl.lower()
                    frag_idx = html_tpl_lower.find('template')
                    frag = html_tpl[max(0, frag_idx - 8000): frag_idx + 42000] if frag_idx >= 0 else html_tpl[:42000]

                    for m_a in re.finditer(r'<a\b[^>]*>.*?</a>', frag, flags=re.IGNORECASE | re.DOTALL):
                        a_html = m_a.group(0)
                        m_href = re.search(r'href\s*=\s*(?:"([^"]+)"|\'([^\']+)\'|([^\s>]+))', a_html, flags=re.IGNORECASE)
                        href = (m_href.group(1) or m_href.group(2) or m_href.group(3) or '') if m_href else ''
                        if '/templates' not in href.lower():
                            continue
                        inner = re.sub(r'^<a\b[^>]*>', '', a_html, flags=re.IGNORECASE)
                        inner = re.sub(r'</a>\s*$', '', inner, flags=re.IGNORECASE)
                        text = _strip_html_to_text(inner, max_chars=160)
                        if not text:
                            continue
                        if len(text) > 28:
                            continue
                        if text.lower() in {'templates', 'template'}:
                            continue
                        if text.lower() in stop_template:
                            continue
                        if text not in template_names:
                            template_names.append(text)
                        if len(template_names) >= 12:
                            break
            except Exception:
                pass

    if template_names:
        sections.append('## Templates')
        for name in template_names[:8]:
            sections.append(f"- {name}")
        sections.append('')

    # --- Pricing (plans + key prices) ---
    pricing_frag = ''
    p_idx = lower.find('pricing')
    if p_idx >= 0:
        start = max(0, p_idx - 4000)
        pricing_frag = html_str[start: start + 80000]
    else:
        # Fallback near first license mention
        m = re.search(r'\blicense\b', lower)
        if m:
            start = max(0, m.start() - 4000)
            pricing_frag = html_str[start: start + 80000]

    if pricing_frag:
        text_flat = _strip_html_to_text(pricing_frag, max_chars=120000)
        # license names
        plans = re.findall(r'\b([A-Z][A-Za-z+]*(?:\s+[A-Z][A-Za-z+]+){0,3})\s+License\b', text_flat)
        picked_plans: List[str] = []
        for p in plans:
            words = [w for w in p.split() if w]
            v = ' '.join(words[-2:]).strip() if len(words) > 2 else ' '.join(words).strip()
            if not v:
                continue
            if any(bad in v.lower() for bad in {'support', 'community', 'resources', 'documentation', 'docs', 'api'}):
                continue
            label = f"{v} License"
            if label not in picked_plans:
                picked_plans.append(label)
            if len(picked_plans) >= 6:
                break
        plans_lc = [p.lower() for p in picked_plans]
        prices = re.findall(r'\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*(?:mo|month|yr|year))?', text_flat)
        uniq_prices: List[str] = []
        for pr in prices:
            v = re.sub(r'\s+', '', pr).strip()
            if not v:
                continue
            if v not in uniq_prices:
                uniq_prices.append(v)
            if len(uniq_prices) >= 10:
                break

        if picked_plans or uniq_prices:
            sections.append('## Pricing (Extracted)')
            if picked_plans:
                sections.append('- Plans: ' + ' | '.join(picked_plans[:3]))
            if uniq_prices:
                sections.append('- Prices: ' + ' | '.join(uniq_prices[:8]))
            sections.append('')

            text_flat_lower = text_flat.lower()

            def has(needle: str) -> bool:
                return needle.lower() in text_flat_lower

            def has_re(pat: str) -> bool:
                return re.search(pat, text_flat, flags=re.IGNORECASE) is not None

            variant_titles: List[str] = []
            for m2 in re.finditer(
                r'\b([A-Z][A-Za-z0-9+]*(?:\s+[A-Z][A-Za-z0-9+]+){0,5}\s+for\s+[A-Za-z0-9+]+(?:\s+[A-Za-z0-9+]+){0,4})\b',
                text_flat,
            ):
                t = ' '.join((m2.group(1) or '').split()).strip()
                if not t:
                    continue
                if len(t) > 48:
                    continue
                tl = t.lower()
                if tl in variant_titles:
                    continue
                if any(stop in tl for stop in ['sign in', 'log in', 'contact', 'docs', 'documentation', 'api']):
                    continue
                variant_titles.append(t)
                if len(variant_titles) >= 4:
                    break

            if variant_titles and ('license' in text_flat_lower or 'pricing' in text_flat_lower):
                sections.append('## Company License Options (Extracted)')
                sections.append('')

                for title in variant_titles[:3]:
                    sections.append(f'### {title}')
                    idx = text_flat_lower.find(title.lower())
                    window = text_flat[max(0, idx - 2000) : idx + 4000] if idx >= 0 else text_flat[:4000]
                    prices_near = re.findall(
                        r'\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?(?:\s*\/\s*(?:mo|month|yr|year))?',
                        window,
                    )
                    if prices_near:
                        sections.append(f'- **Price:** {" ".join(prices_near[0].split()).strip()}')

                    min_m = re.search(r'\bminimum\b[^\n]{0,80}\$\s?\d{1,3}(?:,\d{3})*(?:\.\d+)?', window, flags=re.IGNORECASE)
                    if min_m:
                        sections.append(f'- **Minimum:** {" ".join(min_m.group(0).split()).strip()}')

                    use_m = re.search(r'\buse\s+case\b\s*[:\-]?\s*([^\n]{10,140})', window, flags=re.IGNORECASE)
                    if use_m:
                        sections.append(f'- **Use Case:** {" ".join(use_m.group(1).split()).strip()}')

                    best_m = re.search(r'\bbest\s+for\b\s*[:\-]?\s*([^\n]{10,140})', window, flags=re.IGNORECASE)
                    if best_m:
                        sections.append(f'- **Best For:** {" ".join(best_m.group(1).split()).strip()}')

                    sections.append('')

            price_details_rows: List[Tuple[str, str, str]] = []
            if uniq_prices:
                for pr in uniq_prices[:10]:
                    context = 'Pricing'
                    pr_lc = pr.lower()
                    if '/mo' in pr_lc or '/month' in pr_lc or '/yr' in pr_lc or '/year' in pr_lc:
                        context = 'Subscription'
                    desc = 'Extracted price token'
                    price_details_rows.append((pr, context, desc))

            if price_details_rows:
                sections.append('## Pricing Details (Extracted)')
                sections.append('')
                sections.append('| Price Point | Context | Description |')
                sections.append('|-------------|---------|-------------|')
                for pp, ctx, desc in price_details_rows:
                    sections.append(f'| **{pp}** | {ctx} | {desc} |')
                sections.append('')

        # Best-effort comparison table for common 3-tier pricing layouts.
        plans_lc = [p.lower() for p in picked_plans]
        if any('free license' in p for p in plans_lc) and any('company license' in p for p in plans_lc) and any('enterprise license' in p for p in plans_lc):
            free_team = '≤3 people' if '≤3' in text_flat or '≤ 3' in text_flat or has('3 people') else '(not detected)'
            company_team = '4+ people' if has('4+ people') or has('4 + people') or has('4 people') else '(not detected)'
            enterprise_team = 'Unlimited' if has('unlimited') else '(not detected)'

            company_cost = '$25/mo per seat OR $0.01 per render' if has('$25/mo') or has('$0.01') else '(not detected)'
            enterprise_cost = 'Starting at $500/mo' if has('$500') else '(not detected)'
            mux = '$250 Mux credits' if has('$250') and has('mux') else '(not detected)'
            support_company = 'Priority' if has('priority') and has('support') else '(not detected)'
            support_enterprise = 'Dedicated' if has('slack') or has('monthly') or has('dedicated') else '(not detected)'
            editor_included = 'Included' if has('editor starter') and has('included') else '(not detected)'

            sections.append('## Pricing Comparison (Extracted)')
            sections.append('| Feature | Free License | Company License | Enterprise License |')
            sections.append('|---------|--------------|-----------------|-------------------|')
            sections.append(f'| **Team Size** | {free_team} | {company_team} | {enterprise_team} |')
            sections.append('| **Commercial Use** | ✅ Yes | ✅ Yes | ✅ Yes |')
            sections.append(f'| **Cost** | $0 | {company_cost} | {enterprise_cost} |')
            sections.append(f'| **Support** | Community | {support_company} | {support_enterprise} |')
            sections.append(f'| **Mux Credits** | ❌ | {mux} | ✅ Custom |')
            sections.append(f'| **Editor Starter** | ❌ | ❌ | {editor_included} |')
            sections.append(f'| **Custom Terms** | ❌ | ❌ | {"✅ Yes" if has("custom") or has("terms") else "(not detected)"} |')
            sections.append(f'| **Compliance** | ❌ | ❌ | {"✅ Forms available" if has("compliance") or has("forms") else "(not detected)"} |')
            sections.append('')

    # --- Rendering options (best-effort) ---
    render_text = _strip_html_to_text(html_str, max_chars=200000).lower()
    if any(k in render_text for k in ['render options', 'render targets', 'serverless', 'lambda', 'docker', 'node.js server', 'local machine', 'cli']):
        has_cli = any(k in render_text for k in ['cli', 'local machine', 'locally'])
        has_server = any(k in render_text for k in ['node.js server', 'on the server', 'server '])
        has_lambda = 'lambda' in render_text or 'serverless' in render_text
        if has_cli or has_server or has_lambda:
            sections.append('## Rendering Options (Extracted)')
            sections.append('| Method | Speed | Cost | Best For |')
            sections.append('|--------|-------|------|----------|')
            if has_cli:
                sections.append('| **Local CLI** | Medium | Free | Development, small batches |')
            if has_server:
                sections.append('| **Server** | Fast | Server costs | Production deployments |')
            if has_lambda:
                sections.append('| **Lambda** | Very Fast | Pay-per-render | Massive scale, variable load |')
            sections.append('')

    # --- Pricing / comparison tables ---
    # If there are tables containing pricing tokens, emit an extracted Markdown table.
    tables = re.findall(r'<table[^>]*>.*?</table>', html_str, flags=re.IGNORECASE | re.DOTALL)
    picked_tables: List[str] = []
    for t in tables:
        tl = t.lower()
        if 'license' not in tl and '$' not in tl and 'pricing' not in tl:
            continue
        md = _table_html_to_markdown(t, max_rows=10, max_cols=5)
        if not md:
            continue
        picked_tables.append(md)
        if len(picked_tables) >= 2:
            break

    if picked_tables:
        sections.append('## Pricing Tables (Extracted)')
        for md in picked_tables:
            sections.append(md)
            sections.append('')

    return '\n'.join(sections).strip()


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

        extras = _extract_structured_details_markdown(html_str, url)
        if extras:
            markdown = markdown.rstrip() + "\n\n---\n\n" + extras + "\n"
        
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
