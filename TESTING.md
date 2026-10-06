# Verification

Executed successfully: 27 unit tests/four files, TypeScript, production build, git diff --check, Drizzle baseline generation. Generation is not migration execution. Build warns of a large client chunk.

Built-server HTTP smoke checks also pass (3): process health, SPA login route, unauthenticated private media returns 401 with no-store. No database was used in these smoke checks.

Lint passes with zero errors and zero warnings. Shared hooks/context and style recipes were split from component exports, nested components were hoisted, and unsafe any types and effect dependencies were corrected. No lint/security rules were disabled.

Not run: live DB integration/concurrency, two-browser messaging, real WebRTC media, push, mobile installation or production smoke tests.

Local MySQL setup is blocked: no database server or Docker is installed, and the package manager failed with environment permission errors. No permission bypass was attempted. The private Railway database was not accessed or altered. Next database tests must use an approved disposable MySQL runner, not the existing production database.

Next adversarial cases: cross-user read/reply/star/media IDs; independent group expiry; unread cap; hidden receipts; repeated ACKs; one winner in concurrent reveal; removed/re-added members cannot resurrect content; media access during cleanup failure; cleanup retry; forwarding ceiling; logout cache purge; existing-data upgrade and old storage migration.

## Isolated MySQL integration job

The GitHub Actions workflow now defines a disposable MySQL 9 service with synthetic credentials and no production secrets. Its 11 scenarios exercise real SQL, transactions, sessions and selected tRPC procedures. Only the connection factory and the file-deletion adapter are replaced; storage failure/retry is simulated, not a real disk failure.

Run with `npm run test:integration`. This requires an explicitly supplied `TEST_DATABASE_URL`, loopback host, database `quick_chat_test`, user `quick_chat_ci`, and an empty schema. It never reads `DATABASE_URL`, drops tables, or resets an existing database. Each run requires a fresh container. The checked-in baseline migration is applied before fixtures are inserted.

Integration execution status: pending the first GitHub Actions run. Typechecking is separate: `npx tsc --project tsconfig.integration.json`. Passing this suite does not establish browser behavior, complete API coverage, production migration safety or real media deletion.
