---
title: Composite GitHub Actions must run from github.action_path, not self-checkout
date: 2026-06-26
category: best-practices
module: GitHub Action authoring
problem_type: best_practice
component: tooling
severity: high
applies_when:
  - Authoring a composite GitHub Action that ships its own script (Node, Python, shell)
  - A composite action needs its own source files available at runtime
  - Reviewing an internal or third-party composite action for supply-chain safety
tags: [github-actions, composite-action, supply-chain, version-pinning, action-path, fail-loud]
---

# Composite GitHub Actions must run from github.action_path, not self-checkout

## Context

A composite action shipped a script and made its own files available at runtime by
re-running `actions/checkout` against **its own repository with no `ref:`**, then
executing the freshly checked-out script:

```yaml
# action.yml — the trap
- uses: actions/checkout@v2
  with:
    repository: my-org/my-action   # no ref: -> defaults to the default branch (main)
    path: my-action
- run: node ./my-action/script.js  # runs whatever is on main, not the pinned ref
```

A consumer who pins `uses: my-org/my-action@v8` gets `action.yml` resolved at the `v8`
tag, but the **code that actually executes comes from `main`** — whatever is there at
run time. Version pinning is silently defeated, and because the run step has the
caller's secrets in scope (`GMAIL_REFRESH_TOKEN`, client secret, etc.), any push to
`main` (or a repo compromise) immediately executes in every consumer's workflow with
their credentials exposed. This is a supply-chain pin-bypass, not a cosmetic bug.

## Guidance

A composite action's own files are **already present** at `${{ github.action_path }}`,
checked out at the exact ref the consumer pinned. Run from there; never re-checkout the
action's own repo.

```yaml
# action.yml — correct
runs:
  using: composite
  steps:
    - uses: actions/setup-node@v4
      with:
        node-version: '24'
    - run: npm ci
      shell: bash
      working-directory: ${{ github.action_path }}
    - run: node send-email.js
      shell: bash
      working-directory: ${{ github.action_path }}
      env:
        # ... secrets and inputs ...
```

Two related hardening rules surfaced in the same review and belong with this practice:

- **Fail loud.** A composite action runs a script via `run:`; if that script swallows
  its error and exits 0, the **step turns green on failure**. The script must set a
  non-zero exit on any failure path (`process.exitCode = 1`), and should only auto-run
  under `if (require.main === module)` so it stays importable for tests.
- **Reproducible installs.** Commit a lockfile and use `npm ci`, not `npm install`, so
  the credential-handling step doesn't resolve unpinned transitive dependencies at run
  time.

## Why This Matters

The `uses: ...@<ref>` pin is the consumer's only supply-chain control over a third-party
action. A self-checkout of the default branch quietly removes that control: the consumer
believes they audited and pinned `v8`, but they run live `main`. Pair that with secrets
in the run step's `env:` and a swallowed error, and you get a credential-exposure path
that also reports success — the worst combination, because nothing looks wrong.

`github.action_path` is the supported mechanism precisely because it resolves to the
pinned ref. Using it makes the executed code match the audited code, which is the entire
point of pinning.

## When to Apply

- Any composite action that ships a script or other source files it executes at runtime.
- During review of a composite action: grep `action.yml` for an `actions/checkout` whose
  `repository:` is the action's own repo — that is the smell. Confirm it has no `ref:`
  to gauge severity.
- When a **consumer** reports deprecation warnings (Node runtime, `checkout@v2`) that
  trace to `uses:` lines they don't own — those references often live inside the action,
  not the consumer's workflow.

## Examples

Before (pin-bypass + green-on-failure):

```yaml
# action.yml
- uses: actions/checkout@v2
  with: { repository: my-org/my-action, path: my-action }
- run: node ./my-action/script.js   # default-branch code, secrets in env
```
```js
// script.js
catch (error) { console.log('Error:', error); }   // logs, then exits 0
```

After (runs pinned ref, fails loud):

```yaml
# action.yml
- run: node script.js
  working-directory: ${{ github.action_path }}
```
```js
// script.js
if (require.main === module) {
  send().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
```

## Related

- `CONCEPTS.md` — defines **Pin-bypass**, **Consumer**, and **Send credentials**.
- Verified fix shipped in this repo as `v9` (commit `299e502`).
