import base64
import json
import os
import tempfile
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


def _read_body(handler: BaseHTTPRequestHandler, max_bytes: int) -> bytes:
  length = int(handler.headers.get('content-length') or '0')
  if length <= 0 or length > max_bytes:
    raise ValueError('invalid request size')
  body = handler.rfile.read(length)
  if not body:
    raise ValueError('empty body')
  return body


def _select_output_text(output_dir: Path) -> str:
  if not output_dir.exists():
    return ''
  candidates = []
  for p in output_dir.rglob('*'):
    if not p.is_file():
      continue
    ext = p.suffix.lower()
    if ext in {'.md', '.markdown', '.txt'}:
      candidates.append(p)
  candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
  for p in candidates:
    try:
      s = p.read_text(encoding='utf-8', errors='ignore').strip()
      if s:
        return s
    except Exception:
      pass
  return ''


MODEL = None
TOKENIZER = None


def _load_model():
  global MODEL, TOKENIZER
  if MODEL is not None and TOKENIZER is not None:
    return
  from transformers import AutoModel, AutoTokenizer
  import torch

  model_name = os.environ.get('DEEPSEEK_OCR2_MODEL_NAME') or 'deepseek-ai/DeepSeek-OCR-2'
  device = 'cuda' if torch.cuda.is_available() else 'cpu'
  TOKENIZER = AutoTokenizer.from_pretrained(model_name, trust_remote_code=True)
  MODEL = AutoModel.from_pretrained(
    model_name,
    _attn_implementation=os.environ.get('DEEPSEEK_OCR2_ATTN') or 'flash_attention_2',
    trust_remote_code=True,
    use_safetensors=True,
  )
  MODEL = MODEL.eval()
  if device == 'cuda':
    dtype = torch.bfloat16 if hasattr(torch, 'bfloat16') else torch.float16
    MODEL = MODEL.cuda().to(dtype)


class Handler(BaseHTTPRequestHandler):
  def do_POST(self):
    try:
      _load_model()
      max_bytes = int(os.environ.get('DEEPSEEK_OCR2_MAX_REQUEST_BYTES') or str(8 * 1024 * 1024))
      body = _read_body(self, max_bytes)
      req = json.loads(body.decode('utf-8', errors='strict'))
      filename = str(req.get('filename') or 'image.png')
      prompt = str(req.get('prompt') or '<image>\n<|grounding|>Convert the document to markdown. ')
      b64 = str(req.get('imageBase64') or '')
      if not b64:
        raise ValueError('missing imageBase64')
      raw = base64.b64decode(b64, validate=False)
      if not raw:
        raise ValueError('decoded image empty')

      with tempfile.TemporaryDirectory(prefix='kg-ocr2-') as tmp:
        tmp_dir = Path(tmp)
        img_path = tmp_dir / filename
        img_path.write_bytes(raw)
        out_dir = tmp_dir / 'out'
        out_dir.mkdir(parents=True, exist_ok=True)
        res = MODEL.infer(
          TOKENIZER,
          prompt=prompt,
          image_file=str(img_path),
          output_path=str(out_dir),
          base_size=int(os.environ.get('DEEPSEEK_OCR2_BASE_SIZE') or '1024'),
          image_size=int(os.environ.get('DEEPSEEK_OCR2_IMAGE_SIZE') or '768'),
          crop_mode=(os.environ.get('DEEPSEEK_OCR2_CROP_MODE') or '1') == '1',
          save_results=True,
        )

        md = ''
        if isinstance(res, str):
          md = res.strip()
        elif isinstance(res, dict):
          for k in ['markdown', 'md', 'text', 'output', 'result']:
            v = res.get(k)
            if isinstance(v, str) and v.strip():
              md = v.strip()
              break
        if not md:
          md = _select_output_text(out_dir)
        if not md:
          raise ValueError('no markdown output produced')

        out = json.dumps({'ok': True, 'markdown': md}).encode('utf-8')
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(out)))
        self.end_headers()
        self.wfile.write(out)
    except Exception as e:
      msg = str(e) or 'ocr failed'
      out = json.dumps({'ok': False, 'error': msg}).encode('utf-8')
      self.send_response(400)
      self.send_header('Content-Type', 'application/json')
      self.send_header('Content-Length', str(len(out)))
      self.end_headers()
      self.wfile.write(out)

  def log_message(self, format, *args):
    if (os.environ.get('DEEPSEEK_OCR2_LOG') or '') == '1':
      super().log_message(format, *args)


def main():
  host = os.environ.get('DEEPSEEK_OCR2_HOST') or '127.0.0.1'
  port = int(os.environ.get('DEEPSEEK_OCR2_PORT') or '8910')
  started = time.time()
  _load_model()
  _ = started
  httpd = ThreadingHTTPServer((host, port), Handler)
  httpd.serve_forever()


if __name__ == '__main__':
  main()

