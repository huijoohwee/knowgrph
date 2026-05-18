# Knowgrph Branch Protection

## Overview

- This guide defines the GitHub branch protection settings that enforce `knowgrph` conflict-resolution compliance on the server side.
- Local hooks and CI reduce manual errors, but branch protection is the final gate that prevents non-compliant merges into `main`.
- Apply these settings in the GitHub repository settings for `huijoohwee/knowgrph`.

---

## Context-Intent-Directive (CID) Framework

### Definition

- **Context**: focus domain of concern
- **Intent**: desired principle or guiding goal
- **Directive**: explicit prohibition or required safeguard

### Sorting

Each mantra and table row stays alphabetized for predictable administration and review.

---

## Three-Beat Mantra Form

- Checks; require server-side validation; forbid merging with failing compliance status
- History; preserve auditable review flow; forbid direct unreviewed pushes to `main`
- Merges; gate integration through pull requests; forbid bypassing review and automation
- Reviews; require human approval; forbid self-merging without policy satisfaction
- Status; require `Conflict Compliance`; forbid merging with missing required checks

---

## Context-Intent-Directive Table

| Context | Intent | Directive |
|---|---|---|
| Checks | Require server-side validation | - [ ] Require passing status checks; enforce server-side validation; forbid merging with failing compliance status |
| History | Preserve auditable review flow | - [ ] Protect `main` branch history; preserve review flow; forbid direct unreviewed pushes |
| Merges | Gate integration through pull requests | - [ ] Require pull requests for `main`; gate integration; forbid bypassing review and automation |
| Reviews | Require human approval | - [ ] Require approving reviews before merge; preserve accountability; forbid self-merging without policy satisfaction |
| Status | Require `Conflict Compliance` | - [ ] Mark `Conflict Compliance` as required; enforce conflict policy; forbid merging with missing required checks |

---

## Required Settings

Apply these settings to the `main` branch in GitHub:

- **Require a pull request before merging**: `ON`
- **Require approvals**: `ON`
- **Required approving reviews**: `1` minimum
- **Dismiss stale pull request approvals when new commits are pushed**: `ON`
- **Require review from code owners**: `ON` when CODEOWNERS is added for `knowgrph`
- **Require status checks to pass before merging**: `ON`
- **Require branches to be up to date before merging**: `ON`
- **Required status checks**: select `Conflict Compliance`
- **Restrict who can push to matching branches**: `ON` if you want to block direct pushes entirely
- **Allow force pushes**: `OFF`
- **Allow deletions**: `OFF`

---

## Recommended Settings

- **Require conversation resolution before merging**: `ON`
- **Do not allow bypassing the above settings**: `ON`
- **Require linear history**: `ON` if the repo prefers rebase/squash-only history
- **Lock branch**: `OFF` by default; turn `ON` only for release freezes or emergency governance windows

---

## Required Status Check

The workflow added in this repo is:

- **Workflow name**: `Conflict Compliance`

Use this exact workflow/status check as a required merge gate. It runs:

- `npm run conflict:check`
- changed-file hygiene budget regression checks (`<600` lines/file and `<500 KiB` text chunks for new files; no growth for existing over-budget files)
- built JS/CSS chunk budgets after Pages build (`<500 KiB` per asset)
- graph cache semantic keys must use `canvas/src/lib/graph/semanticKey.ts`
- publish mirror drift detection
- merge-marker detection
- sibling `AgenticRAG` schema map validation when available

---

## Setup Steps

1. Open GitHub repository settings for `huijoohwee/knowgrph`.
2. Go to `Settings` -> `Branches`.
3. Add or edit a branch protection rule for `main`.
4. Enable pull request requirements and approval requirements.
5. Enable required status checks.
6. Select `Conflict Compliance` as a required check.
7. Disable force pushes and branch deletion.
8. Save the rule and verify the workflow appears on the next pull request.

---

## Validation Checklist

- [ ] `main` requires pull requests before merge
- [ ] `main` requires at least one approval
- [ ] `Conflict Compliance` is marked as a required status check
- [ ] stale approvals are dismissed on new commits
- [ ] force pushes are disabled
- [ ] direct pushes are restricted if strict protection is desired

---

## Role-Action-Outcome

- **Role: Repository Admin**  
-> Action: configures branch protection and required checks in GitHub  
-> Outcome: blocks non-compliant merges into `main`

- **Role: Maintainer**  
-> Action: routes all `main` updates through pull requests and required checks  
-> Outcome: preserves auditable conflict-resolution governance

- **Role: Reviewer**  
-> Action: approves only pull requests that satisfy automation and policy checks  
-> Outcome: maintains human oversight on top of automated enforcement

---

## Mantra Application

**"CID frames knowgrph branch gates, SRP isolates merge authority, RAO aligns admin actions, SVO clarifies enforcement."**

- **CID frames**: defines which GitHub controls matter, why they matter, and which shortcuts are forbidden.
- **SRP isolates**: keeps merge authority in protected branch settings instead of ad hoc maintainer habits.
- **RAO aligns**: maps admins, maintainers, and reviewers to explicit enforcement actions.
- **SVO clarifies**: turns branch protection into a concrete checklist rather than a vague repository preference.
