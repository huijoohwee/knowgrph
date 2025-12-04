from pathlib import Path
from rdflib import Graph

def convert(jsonld_path: Path, out_path: Path):
    g = Graph()
    data = jsonld_path.read_text(encoding="utf-8")
    g.parse(data=data, format="json-ld")
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(g.serialize(format="turtle"), encoding="utf-8")

def main():
    repo = Path(__file__).resolve().parents[1]
    jsonld_path = repo / "data" / "outputs" / "a0.jsonld"
    out_path = repo / "data" / "outputs" / "a0.ttl"
    convert(jsonld_path, out_path)

if __name__ == "__main__":
    main()

