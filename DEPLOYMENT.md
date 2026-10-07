# Deployment gate

Do not publish this checkpoint as a complete secure messenger.

1. Verify hosting budget/spending controls. Keep MySQL private; do not expose TCP for convenience.
2. Use authorized execution inside its private network or a separate local test MySQL database. Do not paste secrets into chat.
3. Inspect actual schema/migration history. The generated 0000 migration is a NEW DATABASE baseline, not an upgrade. Existing data needs a reviewed migration, finite retention backfill and media transfer plan.
4. Configure DATABASE_URL, APP_SECRET, MEDIA_STORAGE_DIR and optional STUN_URL/TURN_URL/TURN_SHARED_SECRET. Mount private persistent media outside dist/public.
5. Run npm ci, npm run security:production, npm test, npm run check, npm run build, and npm run lint. Review the full npm audit separately; development-tool findings remain documented in DEPENDENCY_SECURITY.md. npm start serves the build. /api/health confirms process health only.
6. Run two-user messaging and third-user authorization tests, concurrent reveal, deletion/storage checks, reconnect and real calls. Verify HTTPS, backups and cleanup monitoring before launch.

## Isolated Railway preview — October 7, 2026

Preview: https://quick-chat-preview-production.up.railway.app/auth

The user authorized this test deployment. It runs commit
`7a67c164bdb2967ed0b92bf5e0fad48f618c30d4` from
`feat/quick-chat-private-messaging` in Railway project `sincere-reflection`.
The existing database in the separate project was not modified.

- One app and one private MySQL service, each limited to 0.5 GB RAM and 1 vCPU.
- Media is mounted at `/data` on a 500 MB persistent volume.
- Separate generated app secret and database user credentials live only in Railway variables.
- The app uses `node scripts/start-preview.mjs`, which applies migrations only with explicit
  preview opt-in to `quick_chat_preview`; standard Docker startup does not migrate.
- Railway reports both services online; the browser renders the sign-in page and the
  health endpoint responds. Live API checks passed registration, password login,
  two-user message delivery, view acknowledgement, and view-once conceal/reveal/removal.
  CI run `37562356551` passed for the deployed commit. Browser validation covered the
  sign-in page; calls and the full interactive chat flow were not tested in this deployment.
- Resource limits are not billing caps. Monitor Railway usage; free credits are not guaranteed
  to cover continuous operation. No paid plan upgrade was performed.

Use test accounts and data. Email verification/recovery, production session hardening,
and full call validation remain unfinished. TURN is not configured for this preview.
