import subprocess
from pathlib import Path

def run(cmd, cwd):
    subprocess.check_call(cmd, cwd=cwd)

def main():
    repo = Path(__file__).resolve().parents[1]
    py = repo / ".venv" / "bin" / "python"
    if not py.exists():
        py = Path("python3")
    out_dir = repo / "data" / "outputs"
    out_dir.mkdir(parents=True, exist_ok=True)
    run([str(py), "scripts/md_to_a0_csv.py"], repo)
    run([str(py), "scripts/csv_to_jsonld.py"], repo)
    run([str(py), "scripts/jsonld_to_rdf.py"], repo)

if __name__ == "__main__":
    main()
