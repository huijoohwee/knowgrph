# Knowgrph Repo Hygiene (Artifacts + History Purge)

## Goal

Keep the repository fast to clone/pull/push by preventing large local artifacts from being tracked, and by purging previously-committed artifact blobs from git history.

## Artifact Policy (SSOT)

- `.knowgrph-workspace/` is a local artifact root (PDF workspace, website-import artifacts, per-URL `raw.html`, etc).
- `.knowgrph-workspace/` must never be committed.
- In this repo, `.knowgrph-workspace/` is physically stored at `sandbox/.knowgrph-workspace/` and referenced from `knowgrph/.knowgrph-workspace` via symlink.

## Ignore Rules

- `knowgrph/.gitignore` must include `.knowgrph-workspace` and `.knowgrph-workspace/`.
- `sandbox/.gitignore` must include `.knowgrph-workspace` and `.knowgrph-workspace/`.

## Cross-Repo Policy

Apply the same “no large local artifacts in git history” rule to these repos:

- `/GitHub/knowgrph`
- `/GitHub/curagrph`
- `/GitHub/gympgrph`
- `/GitHub/chatgrph`
- `/GitHub/sandbox`

Common paths to exclude from history (when they accidentally get committed):

- `node_modules/**`
- `backups/**`
- `git-error-*`
- `.DS_Store`
- `.knowgrph-workspace/**`

## When To Purge History

Purge history when any of the following are true:

- `.git` directory becomes unusually large.
- cloning/pulling becomes slow.
- large artifacts were previously committed (PDFs, `raw.html`, website-import blobs, generated preview outputs).

## History Purge Procedure (git-filter-repo)

This rewrites commit history. All collaborators must re-clone after the force-push.

1) Ensure the working tree is clean and all intended changes are committed.

2) Create a local backup tag/branch:

```bash
TS=$(date +%Y%m%d-%H%M%S)
git tag "backup/pre-history-purge-$TS"
git branch "backup/pre-history-purge-$TS"
```

3) Run `git-filter-repo` to drop artifact paths from all commits:

```bash
python3 -m pip install --user git-filter-repo
python3 -m git_filter_repo --force \
  --path .knowgrph-workspace \
  --path data/knowgrph-workflow-preview \
  --path-glob 'git-error-*' \
  --invert-paths
```

4) Garbage collect to actually reclaim space:

```bash
git reflog expire --expire=now --all
git gc --prune=now --aggressive
```

5) Restore the remote (git-filter-repo may remove `origin`):

```bash
git remote add origin https://github.com/<owner>/knowgrph.git
```

6) Force-push rewritten history:

```bash
git push --force-with-lease --set-upstream origin main
git push --force-with-lease --tags
```

## Post-Purge Requirements

- Anyone with an existing clone must do a fresh clone.
- Any open PRs based on old commit hashes must be recreated.

## Safety Invariants

- Never commit: `.knowgrph-workspace/**`.
- Never commit: generated preview outputs under `data/` unless explicitly needed and bounded.
- Never commit: `node_modules/**` or ad-hoc backup bundles under `backups/**`.
- Prefer storing large fixtures under `/GitHub/sandbox/test-data/` as local-only files (ignored); keep only small sample fixtures in git.
