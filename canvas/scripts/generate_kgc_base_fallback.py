from pathlib import Path
import base64


def main() -> None:
    repo_canvas = Path(__file__).resolve().parents[1]
    github_root = repo_canvas.parents[1]
    template_path = github_root / "huijoohwee.github.io" / "docs" / "kgc-ai-pipeline-chat-response-base-template.md"
    output_path = repo_canvas / "src" / "features" / "chat" / "chatHistoryWorkspace.kgc.baseFallback.ts"

    template = template_path.read_text(encoding="utf-8").replace("\r\n", "\n")
    b64 = base64.b64encode(template.encode("utf-8")).decode("ascii")

    content = f"""type BaseFallbackArgs = {{
  timestampMs: number
  fileName: string
  requestText: string
}}

const KGC_BASE_TEMPLATE_B64 = {b64!r}

const decodeBase64Utf8 = (raw: string): string => {{
  const b64 = String(raw || '').trim()
  if (!b64) return ''
  const bin = atob(b64)
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i)
  return new TextDecoder('utf-8').decode(bytes)
}}

export const buildDeterministicBaseTemplateKgcTurn = (args: BaseFallbackArgs): string => {{
  void args.timestampMs
  void args.fileName
  void args.requestText
  return decodeBase64Utf8(KGC_BASE_TEMPLATE_B64).replace(/\\r\\n/g, '\\n').trimEnd() + '\\n'
}}
"""
    output_path.write_text(content, encoding="utf-8")
    print(f"Wrote {output_path}")


if __name__ == "__main__":
    main()

