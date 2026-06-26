# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

A **public, composite GitHub Action** (consumed by third parties via `uses: fractionalytics/send-email-action@<ref>`) that sends an email through Gmail using Nodemailer + OAuth2. The entire surface is three files plus tests:

- `action.yml` — the composite action: sets up Node, installs deps, runs the script.
- `send-email.js` — the script that builds the message and sends it.
- `send-email.test.js` — unit tests (Node's built-in `node:test`).

## Commands

```bash
npm ci          # reproducible install (requires package-lock.json to be in sync)
npm test        # run all tests (node --test)
npm start       # run the sender against real env vars (will attempt a real send)

# run a single test by name
node --test --test-name-pattern "null token"
```

There is no build step and no linter configured.

## How the action is wired (the non-obvious part)

The action is invoked as `uses:` by a consumer's workflow. Credentials and message
flow into `send-email.js` **entirely through environment variables**, set in the
`env:` block of the run step in `action.yml`:

- Credentials (`GMAIL_CLIENT_ID`, `GMAIL_CLIENT_SECRET`, `GMAIL_REFRESH_TOKEN`,
  `GMAIL_USER`) are pulled from the **caller's job/workflow `env` context**
  (`${{ env.GMAIL_* }}`), *not* from action `inputs`. The consumer must export these
  (typically from repo secrets) into the job env. They are not action inputs.
- Message fields come from action `inputs` (`subject`, `text`, optional `from_email`/
  `to_email`) and are mapped to `SUBJECT`/`TEXT`/`FROM_EMAIL`/`TO_EMAIL` env vars.

`from`/`to` default to `GMAIL_USER` when not supplied. Gmail OAuth2 can only send as
the authenticated user (or a verified alias), so `from_email` is not arbitrary.

**Run from `github.action_path`, never re-checkout.** A composite action's own files
are already present at `${{ github.action_path }}` at the exact ref the consumer
pinned. Do **not** add an `actions/checkout` of this repo — an earlier version did,
without a `ref:`, which silently ran the default branch regardless of the pinned tag
(a version-pinning bypass and credential-exposure risk). Keep `working-directory:
${{ github.action_path }}`.

## Conventions that matter here

- **Failures must exit non-zero.** This action's whole job is delivery; a swallowed
  error that exits 0 makes a failed send look green. The script sets
  `process.exitCode = 1` on failure and only auto-runs under
  `if (require.main === module)`. Preserve both.
- **Never log credentials or full result/error objects.** Public-repo workflow logs
  can be world-readable, and OAuth error objects can embed unmasked tokens. Log
  `result.messageId` and `error.message` only.
- **`send-email.js` is structured for injection.** `sendEmail()` accepts `env`,
  `createTransport`, and `createOAuthClient` so tests run without network or real
  credentials. Keep env reads inside `buildConfig`, not at module top level, so
  importing the module never triggers a send.
- **Keep the lockfile in sync.** `action.yml` uses `npm ci`, which fails if
  `package-lock.json` doesn't match `package.json`. Run `npm install` and commit the
  updated lockfile whenever you change dependencies. Do not commit `node_modules/`.

## Releasing

Consumers pin to tags (e.g. `@v8`). Because the action runs from `github.action_path`,
the code that runs is whatever lives at the pinned ref — so a behavioral change is only
delivered when you cut and push a **new tag**. Bump the tag when `action.yml` or
`send-email.js` changes.

<!-- BEGIN david-brain BRAIN CONNECTION -->
## david-brain Brain

This repo is connected to `david-brain`, a brain for cross-repo lessons, playbooks, conventions, pointers, and shared skills.

At the start of significant work, search the configured brain for relevant lessons, playbooks, conventions, and client-safe context. Present useful hits briefly and let the user decide what to apply.

When a compound workflow creates `docs/solutions/`, `docs/plans/`, or similar durable project knowledge, automatically notice the new output and offer to use `send-to-brain` to promote an enriched copy to the configured brain. The offer requires user approval before writing to the brain. Before promoting frontmattered markdown, dry-run it through the brain's `brain_validate_markdown` MCP tool (read-only, writes nothing) to confirm it parses and meets the entry contract — don't hand-audit frontmatter.

Use `.brain-config` for this repo's sensitivity, domain tags, and configured brains.

Use `/start` at the beginning of a session to check for a previous session handoff and choose how to proceed.

## Coding Guidelines

**Tradeoff:** These guidelines bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them - don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it - don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

**These guidelines are working if:** fewer unnecessary changes in diffs, fewer rewrites due to overcomplication, and clarifying questions come before implementation rather than after mistakes.

## Spec-Writing Discipline

When planning features — whether through ce-brainstorm, ce-plan, or ad-hoc requirements — follow these practices.

### 1. Start with User Stories

Before writing requirements (R-IDs), write the user stories they come from. Use the Thoughtworks format:

> As a **[actor]**, I want to **[capability]**, so that **[value/outcome]**.

The "so that" clause is the most important part — it's the kill switch for scope creep. If a feature doesn't serve the "so that," question whether it belongs.

Each story should trace forward to the requirements it generates (e.g., `→ Generates: R1, R3, R7`).

### 2. Mandatory Acceptance Criteria

Every user story gets explicit acceptance criteria — not just the ambiguous ones. Use Given/When/Then format:

- **Given** [precondition], **when** [action], **then** [observable outcome].

Acceptance criteria are the contract between the spec and the implementation. They define "done" in terms of behavior, not code. A story without acceptance criteria is a story that can't be verified.

### 3. Actor-First Thinking

Name the actors before writing anything else. Ask:
- Who are the 2-3 people who will use this?
- What does each actor need that the others don't?
- Which actor's needs conflict?

Actors aren't just labels — they reveal when one story is actually two (different actors, different needs, different acceptance criteria).

### 4. Verify by Using, Not by Reading

"Done" means the acceptance criteria pass when you *use* the feature, not when the code compiles or the file exists. Prefer behavioral verification ("run the skill and check the output") over structural verification ("file exists at path").

## GitHub Operations

If a `github` MCP server is registered on your machine (e.g. via
`npx -y @modelcontextprotocol/server-github` with a token in
`GITHUB_PERSONAL_ACCESS_TOKEN`), prefer it over the `gh` CLI for remote GitHub
work, within these boundaries:

- **Use `github` MCP tools** for remote reads and collaboration: PRs
  (get/create/review), issues (create/update), commit and file reads, and code
  search. Call MCP tools sequentially — never in parallel (stdio pipe corruption).
- **Use local `git`** for commits and pushes — the MCP file-write tools commit
  server-side via the API and bypass local hooks, signing, and history.
- **Use `gh` only where the MCP server has no equivalent** — notably
  `gh release create` (no MCP release tool). The github MCP server complements
  `gh` and local git; it does not replace them.
<!-- END david-brain BRAIN CONNECTION -->
