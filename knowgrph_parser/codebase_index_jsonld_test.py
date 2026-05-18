import unittest

from .codebase_index_jsonld import build_jsonld


class CodebaseIndexJsonldTest(unittest.TestCase):
    def test_graphdata_chunk_text_survives_index_build(self) -> None:
        graph = {
            "nodes": [
                {
                    "id": "node:a",
                    "data": {
                        "type": "Document",
                        "name": "A",
                        "chunk_text": "Grounded parser text for retrieval.",
                    },
                },
            ],
            "edges": [],
        }

        document = build_jsonld(
            graph,
            codebase_id="test",
            traversal_edges=[],
            ignored_paths=[],
            raw_ignored_patterns=[],
        )

        nodes = document["@graph"]
        self.assertEqual(nodes[0]["chunk_text"], "Grounded parser text for retrieval.")


if __name__ == "__main__":
    unittest.main()
