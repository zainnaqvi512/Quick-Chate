# Development checkpoint — 2026-10-06

Not a production-ready release. Product contract: QUICK_CHAT_MASTER_PROMPT.md. No paid resources created; existing Railway database untouched.

Implemented in source: email/password registration/login, salted scrypt, sanitized profiles, optional phone/username, configurable per-message recipient retention, delivered/view acknowledgements, atomic view-once reveal, private authenticated media, cleanup, secure TURN credential issuance and tighter message/call authorization. Existing blue responsive UI, groups, contacts, reactions, voice notes and statuses retained.

Verified: 27 unit tests pass, TypeScript check passes, production build passes, fresh schema migration generated (not applied). Lint passes with zero errors/warnings; no rules were disabled. Frontend bundle warning remains. The React review guided extraction of stable components and shared hooks, removal of redundant state-reset effects, and correction of effect dependencies.

Three built-server HTTP smoke checks pass: health, SPA login route and unauthenticated private media denial. These do not verify database messaging.

Release blockers:

- All 11 isolated MySQL integration/concurrency scenarios pass, including fresh migration execution and 20-way view-once consumption. See TESTING.md for the GitHub run. No real two-user browser test, actual voice/video test or production verification.
- Compatible dependency updates applied. On 2026-10-07, production dependency audit reports zero known vulnerabilities locally and in CI; full audit reports 11 development-tool findings locally and 12 in CI (5 high, 7 moderate in CI). See DEPENDENCY_SECURITY.md for affected paths and remaining work. Passing tests/audit are not a security clearance.
- Railway service named Quick Chat is currently a private MySQL database, not an app deployment. Credentials are redacted to the connector; no public app URL exists.
- Official Railway pricing verified in COST.md; account plan, credits and spending limits remain unverified. No billable provisioning authorized.
- Local database setup remains unavailable, but the approved GitHub Actions disposable MySQL job now runs without production secrets.
- Fresh-database migration is NOT safe to apply blindly over existing tables. Legacy data requires inspected upgrade/backfill and old provider-media migration.
- Email ownership verification/password recovery unimplemented. Bearer tokens still use localStorage; production needs hardened session handling and distributed abuse controls.
- Polling remains 2.5–5 seconds, not WebSockets. Background push, full offline PWA shell, reports/moderation and group calls absent.
- Group ownership transfer, all privacy settings, full foreign-key integrity and complete account erasure require further review.
- Media forwarding currently rejected. View-once documents lack preview. External GIF URLs need upload conversion.
- Private disk storage requires persistent volume; multi-node hosting needs shared storage. Cleanup is a single-process timer, not a durable worker. Downtime delays physical deletion; backups have not been verified.
- No E2EE. Server operators can read content. Screenshots/copies cannot be erased.

Next: resolve hosting cost and private DB-connected execution, inspect actual schema, test migrations and adversarial multi-user journeys before release.
