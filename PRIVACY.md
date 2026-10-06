# Retention

New messages default to 24 hours after each recipient views them; alternatives are 12h, 1h and view-once. Policy is snapshotted at send. Unread cap: seven days. Accounts, contacts, conversation shells and operational metadata remain; message expiry is not account deletion.

Fetches do not count as views. Foreground visibility triggers acknowledgements. Modified clients can withhold these, but cannot extend the absolute cap. Hidden read receipts still permit internal expiry bookkeeping. View-once grants one response; it can remain visible until closed.

API access expiry is independent of cleanup. Physical deletion normally runs each minute while the server runs and retries failures; this is not a physical-erasure SLA. Backups/snapshots and legacy storage require a verified operational policy, currently absent.

Browser rendering necessarily receives bytes. Screenshots, recordings, downloads, modified clients and external copies cannot be erased. Messages are server-readable, not E2EE.
