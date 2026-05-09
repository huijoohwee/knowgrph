import os
import sys

from knowgrph_parser import markdown_cmd

def main() -> int:    repo_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
    markdown_path = os.path.join(repo_root, 'docs/documents/knowgrph-testing-document.md')argv = ['--input', markdown_path] + sys.argv[1:]
    return markdown_cmd.main(argv)

if __name__ == '__main__':
    raise SystemExit(main())
