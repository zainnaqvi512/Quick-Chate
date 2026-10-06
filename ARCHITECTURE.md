# Architecture

Preserve React 19/Vite + Hono/tRPC Node + Drizzle/MySQL. Existing work did not justify an unverified framework/database migration.

Server sessions identify users. Visibility combines membership, recipient snapshot and deadlines. Clients poll and explicitly acknowledge delivered/foreground-visible messages. This is polling, not push realtime.

Private UUID-keyed files live outside public assets. Authenticated requests recheck access; client object URLs are revoked on unmount. View-once reads bytes before an atomic claim and returns only to its winner. Real MySQL concurrency verification remains required.

Cleanup runs every minute and deletes storage before deleting its DB retry reference. Multi-process races, distributed rate limits and durable deletion jobs remain review work. Production would need a Node service and persistent private media volume alongside MySQL; these were not provisioned.
