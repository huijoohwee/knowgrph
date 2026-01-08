import os
import sys
from typing import Optional, Sequence

from . import codebase_index_cmd
from . import embed_codebase_index_cmd
from . import graphrag_pipeline_cmd
from . import graphrag_workflow_cmd
from . import jsonld_universal_cmd
from . import markdown_cmd
from . import pipeline_cmd
from . import pdf_cmd
from . import python_codebase_index_cmd
from . import test_embedding_sanity_cmd
from . import workflow_artifacts_cmd


def main(argv: Optional[Sequence[str]] = None) -> int:
    args = list(argv) if argv is not None else sys.argv[1:]
    base_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
    entrypoint = "python -m knowgrph_parser"

    if args:
        cmd = args[0].strip().lower()
        rest = args[1:]
        if cmd in {"markdown"}:
            return markdown_cmd.main(rest, parser_script_path=entrypoint)
        if cmd in {"pdf"}:
            return pdf_cmd.main(rest, parser_script_path=entrypoint)
        if cmd in {"codebase-index", "parse-codebase-index"}:
            return codebase_index_cmd.main(rest, base_dir=base_dir, parser_script_path=entrypoint)
        if cmd in {"embed-codebase-index"}:
            return embed_codebase_index_cmd.main(rest, base_dir=base_dir)
        if cmd in {"test-embedding-sanity"}:
            return test_embedding_sanity_cmd.main(rest, base_dir=base_dir)
        if cmd in {"workflow-artifacts", "parse-knowgrph-workflow"}:
            return workflow_artifacts_cmd.main(rest, base_dir=base_dir)
        if cmd in {"jsonld-universal", "parse-jsonld-universal"}:
            return jsonld_universal_cmd.main(rest)
        if cmd in {"python-codebase-index", "example-codebase-index"}:
            return python_codebase_index_cmd.main(rest, base_dir=base_dir, parser_script_path=entrypoint)
        if cmd in {"pipeline"}:
            return pipeline_cmd.main(list(rest))
        if cmd in {"graphrag-workflow"}:
            return graphrag_workflow_cmd.main(rest, base_dir=base_dir)
        if cmd in {"graphrag-pipeline"}:
            return graphrag_pipeline_cmd.main(rest)
    return markdown_cmd.main(args, parser_script_path=entrypoint)
