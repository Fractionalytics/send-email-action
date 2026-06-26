# Concepts

Shared domain vocabulary for this project — entities, named processes, and status concepts with project-specific meaning. Seeded with core domain vocabulary, then accretes as ce-compound and ce-compound-refresh process learnings; direct edits are fine. Glossary only, not a spec or catch-all.

### Consumer
A downstream repository whose workflow invokes this action via a `uses:` step. The consumer supplies the credentials (through its own job environment) and pins the action to a ref. At least one consumer tracks the moving default branch rather than a fixed version tag, so the default branch must stay release-quality.

### Send credentials
The Gmail OAuth2 credential set that authorizes sending mail as a single Gmail account: a client credential (id + secret), a long-lived refresh token used to mint short-lived access tokens at run time, and the authenticated user address. The refresh token is the durable secret — possession grants persistent send-as access until it is revoked, so it is treated as a rotatable secret, never committed.

The action can only send *as* the authenticated user (or a verified alias); an arbitrary "from" address is not honored by Gmail.

### Pin-bypass
The failure mode where a consumer pins the action to a specific ref but the code that actually executes comes from a different ref — typically because the action re-checks-out its own repository at the default branch instead of running from the pinned checkout. The consumer believes they audited and pinned a version, but they run live default-branch code with their secrets in scope. Avoided by running the action from its own already-pinned checkout rather than re-fetching source at run time.
