import os
import sys

from knowgrph_parser import markdown_cmd

def main() -> int:
    markdown_path = os.path.abspath('/Users/huijoohwee/Documents/GitHub/knowgrph/docs/documents/knowgrph-ingestor-document.md')
    argv = ['--input', markdown_path] + sys.argv[1:]
    return markdown_cmd.main(argv)

if __name__ == '__main__':
    raise SystemExit(main())
