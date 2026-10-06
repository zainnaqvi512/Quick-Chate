# Development checkpoint — 2026-10-06

Not a production-ready release. Product contract: QUICK_CHAT_MASTER_PROMPT.md. No paid resources created; existing Railway database untouched.

Implemented in source: email/password registration/login, salted scrypt, sanitized profiles, optional phone/username, configurable per-message recipient retention, delivered/view acknowledgements, atomic view-once reveal, private authenticated media, cleanup, secure TURN credential issuance and tighter message/call authorization. Existing blue responsive UI, groups, contacts, reactions, voice notes and statuses retained.

Verified: 27 unit tests pass, TypeScript check passes, production build passes, fresh schema migration generated (not applied). Frontend bundle warning remains. Lint fails; original repository also has 47 lint errors. No security rules were disabled to hide failures.

Three built-server HTTP smoke checks pass: health, SPA login route and unauthenticated private media denial. These do not verify database messaging.

Release blockers:

- No MySQL-backed integration/concurrency tests, real two-user browser test, actual voice/video test or production verification.
- Railway service named Quick Chat is currently a private MySQL database, not an app deployment. Credentials are redacted to the connector; no public app URL exists.
- Account plan, credits and spending limits unverified; no billable provisioning authorized.
- Fresh-database migration is NOT safe to apply blindly over existing tables. Legacy data requires inspected upgrade/backfill and old provider-media migration.
- Email ownership verification/password recovery unimplemented. Bearer tokens still use localStorage; production needs hardened session handling and distributed abuse controls.
- Polling remains 2.5–5 seconds, not WebSockets. Background push, full offline PWA shell, reports/moderation and group calls absent.
- Group ownership transfer, all privacy settings, full foreign-key integrity and complete account erasure require further review.
- Media forwarding currently rejected. View-once documents lack preview. External GIF URLs need upload conversion.
- Private disk storage requires persistent volume; multi-node hosting needs shared storage. Cleanup is a single-process timer, not a durable worker. Downtime delays physical deletion; backups have not been verified.
- No E2EE. Server operators can read content. Screenshots/copies cannot be erased.

Next: resolve hosting cost and private DB-connected execution, inspect actual schema, test migrations and adversarial multi-user journeys before release.
