# Retention

New messages default to 24 hours after each recipient views them; alternatives are 12h, 1h, view-once-until-chat-exit, and never disappear. Policy is snapshotted at send. Timed/unread ephemeral messages have a seven-day cap. Never-disappearing messages bypass that cap and stay stored until deleted. Viewed chat-exit messages use a 45-second renewable lease while the chat is visible; leaving/backgrounding consumes them immediately when the request arrives, and loss of connection expires them within 45 seconds. Individual view-once attachments retain their single-open behavior. Accounts, contacts, conversation shells and operational metadata remain; message expiry is not account deletion.

Fetches do not count as views. Foreground visibility triggers acknowledgements. Modified clients can withhold these, but cannot extend the absolute cap. Hidden read receipts still permit internal expiry bookkeeping. View-once grants one response; it can remain visible until closed.

API access expiry is independent of cleanup. Physical deletion normally runs each minute while the server runs and retries failures; this is not a physical-erasure SLA. Backups/snapshots and legacy storage require a verified operational policy, currently absent.

Browser rendering necessarily receives bytes. Screenshots, recordings, downloads, modified clients and external copies cannot be erased. Messages are server-readable, not E2EE.

Reports store reporter/target IDs, reason, and submission time for the app owner. Chat content is not automatically attached. No staffed moderation service is promised. Secure chat lock and end-to-end encryption are not implemented.
