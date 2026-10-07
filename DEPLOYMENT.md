# Deployment gate

Do not publish this checkpoint as a complete secure messenger.

1. Verify hosting budget/spending controls. Keep MySQL private; do not expose TCP for convenience.
2. Use authorized execution inside its private network or a separate local test MySQL database. Do not paste secrets into chat.
3. Inspect actual schema/migration history. The generated 0000 migration is a NEW DATABASE baseline, not an upgrade. Existing data needs a reviewed migration, finite retention backfill and media transfer plan.
4. Configure DATABASE_URL, APP_SECRET, MEDIA_STORAGE_DIR and optional STUN_URL/TURN_URL/TURN_SHARED_SECRET. Mount private persistent media outside dist/public.
5. Run npm ci, npm run security:production, npm test, npm run check, npm run build, and npm run lint. Review the full npm audit separately; development-tool findings remain documented in DEPENDENCY_SECURITY.md. npm start serves the build. /api/health confirms process health only.
6. Run two-user messaging and third-user authorization tests, concurrent reveal, deletion/storage checks, reconnect and real calls. Verify HTTPS, backups and cleanup monitoring before launch.

No application URL has been deployed.
