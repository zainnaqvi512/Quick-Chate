# Quick Chat — unified autonomous build prompt

Act as the lead full-stack engineer responsible for designing, implementing, testing, securing and deploying **Quick Chat**, a real messaging application with an original blue identity. Coordinate available specialists and connected tools when they improve delivery. Produce working software, never a frontend demonstration represented as a complete product.

## 1. Outcome and execution rules

Build a mobile-first, responsive full-stack messenger with the familiar capabilities of modern messaging apps. Use original branding, layouts and assets; do not copy proprietary source, logos or graphics. Default to #1677FF blue, #0958D9 dark blue, #E6F4FF light blue, white, and a coherent dark theme. Create an original Q/conversation mark. Desktop uses a conversation sidebar and active chat; mobile uses separate full-screen list and chat views with back navigation.

First inspect the current workspace, repository instructions, connected GitHub repositories and relevant existing infrastructure. If Quick Chat already exists, preserve its architecture and useful code, audit actual behavior, and improve it on an isolated branch. Do not rebuild merely to use a preferred framework. Do not overwrite unrelated work or create duplicate infrastructure.

Work autonomously through reversible implementation and verification. Ask only for missing access, credentials, spending authorization, required provider confirmations, or consequential irreversible decisions. Complete independent implementation before pausing at an external blocker. Never bypass platform approvals. Never claim an action, test or deployment occurred without evidence.

Maintain an execution plan and a feature-status matrix distinguishing implemented, locally tested, production verified, blocked and unimplemented. A polished screen is not proof that its backend works. Continue toward the complete requested scope; if blocked, provide the concrete work completed and the exact next action.

## 2. Cost and infrastructure

Target PKR 0 / USD 0 for development and light initial usage. Deleting messages does not eliminate compute, transfer, authentication, storage or call-relay costs. Never promise unlimited or permanent free operation.

Inspect actual account plans and current official provider limits before provisioning. Use one primary database. Prefer existing compatible infrastructure when economical and secure. Options include PostgreSQL/Supabase, an existing MySQL backend, or another suitable supported platform. Next.js/React/TypeScript/Tailwind are suggestions, not mandatory migrations. Vercel, Railway and other hosting options are conditional on runtime needs and costs. Verify that the selected host supports persistent realtime and background cleanup; do not put a long-lived WebSocket server on an incompatible runtime.

Use private media storage, secure authentication, backend authorization, and a reliable cleanup worker. Use WebRTC for voice/video, with STUN and authenticated TURN where necessary. Peer-to-peer calls still require signaling and sometimes bandwidth-intensive relaying. Never embed long-lived TURN secrets in browser bundles.

Do not enable paid plans, add payment methods, increase billable resources or depend on expiring trial credits as a permanent solution. Configure available spend controls, quotas and graceful failure at limits. If the full scope cannot operate within the verified free allowance, document the limitation and request approval only after the free implementation is reviewable.

## 3. Tools and specialist coordination

Inspect tools actually available; naming a plugin does not install or authorize it.

- **GitHub:** source control, isolated branches, meaningful commits, reviewable pull requests, CI and deployment-ready source. Never commit secrets, credentials, uploaded private content or runtime data.
- **Figma:** use when a design system or design-to-code workflow materially improves the product. Define blue tokens, typography, spacing, responsive layouts, chat components, auth, settings and calling states.
- **MagicPath:** use for useful interactive flow exploration. Maintain one final design direction, not competing design systems.
- **Railway:** use for appropriate existing or verified economical backend, database, realtime, worker and signaling workloads. Inspect plans before provisioning.
- **Vercel:** use for compatible frontend/full-stack deployments, previews, environment management and debugging. Verify important journeys after deployment, not only build status.
- **Supabase:** use when selected for the primary database/auth/realtime/storage. Enforce RLS and private buckets, and verify grants and policies with hostile-user tests.
- **Canva / Adobe Express:** optional branding or launch assets after core functionality is sound.
- **Higgsfield / Runway:** optional promotional content only after the actual app works, not runtime dependencies.

Delegate bounded, non-conflicting work to available architecture, frontend, backend, security, realtime, WebRTC, ephemeral-data, QA and cost specialists. Establish ownership and API/schema contracts before parallel edits. The lead integrates results and reviews cross-cutting risks. Use cross-review for architecture/security, schema/authorization, UI/accessibility, realtime/reconnect, expiry/media cleanup, calls/cost and deployment/QA. Do not invoke tools merely because they exist.

## 4. Authentication, profiles and discovery

Implement real email authentication initially: registration, login, logout, password recovery/reset using a configured delivery provider, safe session expiry/revocation and device management where supported. Use a maintained authentication provider/library or established password hashing. Never return password hashes or session secrets in profile APIs.

Profiles include stable ID, unique username, display name, photo, bio, privacy preferences and optional phone number. Phone verification must not require paid SMS in the initial version. Never fabricate an SMS delivery adapter or expose development OTPs in production. Development test accounts and fixed codes must be impossible to enable accidentally in production.

Support username search, contacts and starting conversations with registered users. Do not expose email addresses, phone numbers or private profile fields through general search without a defined user-facing rule.

## 5. Messaging and organization

Implement one-to-one and group conversations with real backend persistence and synchronized updates. Prefer supported push realtime/WebSockets; if temporarily using polling, label it accurately and document its latency and cost. Include reconnect, duplicate-send protection, pagination, error recovery and offline-state handling.

Conversation list: avatar/name, authorized nonexpired preview, time, unread count, pin/archive/mute and typing status. Chat: text/emoji, camera/images, video, audio, voice notes, documents, location and contact cards. GIF-compatible media and stickers must respect the same authorization and expiration rules.

Actions: reply, react, copy eligible content, forward eligible content, edit own eligible messages, delete for self, delete for everyone where authorized, star eligible messages and inspect delivery/read information. Replies store references, not permanent quoted-body copies. Distinguish sending, sent, delivered and read using actual server acknowledgements; membership does not prove delivery.

Support chat pin/unpin, archive/unarchive, mute/unmute, mark read/unread, clear/delete conversation, block/unblock and reporting. Apply permissions on the server for every operation, including reactions, stars, forwards, search, media and signaling.

## 6. Exact expiration contract

The defining feature is expiration **after viewing**, not merely hiding messages in the interface.

- Conversation policies: **24 hours after viewing (default), 12 hours, 1 hour, and After viewing**. Store the chosen policy on each message when sent. Changing the conversation policy affects future messages only and must be visible to participants.
- Snapshot eligible recipient IDs at send time. A later group join gives no access to earlier messages. Removal revokes access immediately.
- For timed modes, record each recipient's first authenticated foreground view using server time. Fetching history, background polling, push delivery or sender viewing does not start that recipient's timer.
- Timed access ends at `min(first_viewed_at + chosen_duration, sent_at + 7 days)`. The seven-day unread limit is a disclosed starting product choice; it prevents indefinite retention of unread content. Make it configurable server-side and explicit in the privacy UI.
- Acknowledgements must be atomic and idempotent. Repeated views, device changes, reconnection, editing or policy changes cannot extend an existing deadline.
- For **After viewing**, show a concealed message with an explicit reveal action. Atomically consume the recipient's access when returning its content. Allow that response to remain in the current viewer until dismissed, then clear it. Reopening and simultaneous claims must fail. Do not conflate fetching a chat with consuming every message.
- Each group recipient has an independent window. Delete the shared server content once all eligible recipients have expired/consumed it, or at the absolute unread limit. Removed recipients must not keep content alive. Sender access ends when shared content is no longer retained; sender viewing never starts another recipient's timer.
- Read receipts can be hidden from peers, but private internal view acknowledgements are still required for expiry. Explain this distinction; do not expose hidden timestamps or infer them through peer-visible API fields.
- Stars do not exempt content. Replies show “Expired message” once their source is unavailable. Disable copy/forward controls for after-view and view-once content. Ordinary forwarding preserves the source's absolute deletion ceiling and never silently resets retention.
- Deny expired content at every API, search, media and synchronization read even when physical cleanup is delayed. Client countdowns are informational, not the authority.
- Use idempotent cleanup with retries and observable failures. Remove bodies, objects, thumbnails, transcodes, orphan uploads, reactions, content-bearing previews and search copies. Keep a deletion job/reference until an object deletion succeeds.
- Cache only the PWA shell. Private API/media responses use `Cache-Control: no-store`; do not persist message bodies in localStorage, IndexedDB or service-worker caches. Clear in-memory content on expiry, logout, account switch and reconnection before rendering stale data.
- Clearly distinguish loss of access from eventual physical deletion. Publish actual cleanup interval, retry behavior, operational metadata retention, backup/snapshot retention and limitations. Never claim forensic erasure or prevention of screenshots, external recordings, downloads or modified clients.

## 7. Media and view-once

Support private images, videos, audio/voice notes and documents with limits, signature/MIME checks, safe filenames and bounded memory use. Compress images appropriately and impose sensible video/file quotas. Bind uploads to their authenticated owner and intended use; reject attaching another user's key. Clean up failed/orphaned uploads.

Do not expose permanent public URLs. Prefer authenticated media delivery that checks membership, block policy and per-recipient expiry on each request. Signed URLs, if used, must not outlive the deadline; disclose that already issued bearer URLs cannot always be revoked immediately.

Implement view-once images/videos with atomic per-recipient claim and no normal reopening. Expire their storage according to the recipient contract, and do not confuse UI restrictions with capture prevention. Ensure stars, forwards, replies and media endpoints cannot bypass view-once consumption.

Voice recording: request microphone permission, record/cancel, preview/send, duration, actual playback progress and supported playback speed. Use real media playback, not decorative state indicating playback when no audio exists.

## 8. Groups, presence, calling and notifications

Groups: create/name/photo/description, add/remove members, leave, owner/admin/member roles, role promotion/demotion, controlled metadata/membership changes and optional send restrictions. Prevent privilege escalation and removal of the last owner without a defined transfer rule. Add appropriate system events without leaking old content to new members.

Presence: online/offline, last seen, typing and recording indicators with everyone/contacts/nobody privacy controls. Throttle writes and clear stale presence. Block policy must be consistent across discovery, direct messaging, shared groups and calls, with shared-group limitations explicitly explained.

Calls: actual one-to-one voice and video via WebRTC; calling/ringing/connecting/connected/ended/declined/missed/failed states. Authorize both participants and signaling; validate call transitions and SDP/candidate sizes. Implement mic mute, camera toggle, camera switching and audio controls where supported. Handle permission denial, cleanup of tracks, disconnects and timeouts. Group calls are a later capability only when the infrastructure supports them; do not show a working control for an absent feature.

Use short-lived TURN credentials issued by the backend. Test across networks that require relay and disclose when TURN is unconfigured. A successful signaling exchange alone does not prove a working call.

Notifications: actual supported Web Push for messages, mentions, groups and calls; respect mute and preview privacy, handle permission denial/revocation and clear expired notifications where possible. In-app alerts are not background push. Mobile browser restrictions must be documented.

## 9. Settings, accessibility and PWA

Settings: account/profile/privacy/security, notification previews, chats, storage/data, appearance, blocked users, sessions/devices, help and accurate app/security information. Light/dark mode may use local device preferences.

Provide manifest, proper icons, installability and a shell-only service worker. Support Android, desktop and iOS/iPadOS within real platform limits. Never cache private content to make an offline feature appear complete.

Use semantic HTML, keyboard navigation, visible focus, meaningful accessible labels, screen-reader feedback and sufficient contrast. Verify mobile/desktop layouts, scrolling, long messages, empty states, disabled states, errors, loading and 200% text enlargement.

## 10. Security requirements

Threat-model authentication, account enumeration, brute force, session theft, authorization/IDOR, XSS, CSRF, injection, unsafe files, upload abuse, media enumeration, presence leaks, signaling abuse, retention bypass and secrets.

Validate all input server-side; derive user identity from authenticated sessions. Use parameterized queries, appropriate foreign keys and indexes, bounded pagination, secure cookies/session handling, rate limits and private storage. For Supabase, use correct RLS/grants and never expose service-role keys. Do not weaken authorization to fix a failed test.

Keep secrets only in ignored local environment files and provider secret stores. `.env.example` contains variable names and explanatory comments, with no real credentials. Never log passwords, OTPs in production, tokens, message bodies or signed private URLs.

Do not claim E2EE because TLS is enabled. Initially label server-readable messaging accurately. If implementing E2EE, use maintained audited protocols/libraries, explain key custody, multi-device behavior and metadata, and obtain appropriate independent review. Never invent a cryptographic protocol.

## 11. Database and migrations

Model users/profiles, credentials/sessions, contacts, conversations, membership and roles, messages, immutable recipient snapshots/receipts, reactions/stars, attachments/deletion jobs, blocks/reports, presence, calls/signals, notification subscriptions and preferences as needed.

Use server timestamps, policy snapshot, first view, per-recipient expiry/consumption and absolute retention ceiling. Enforce uniqueness and relational integrity. Generate reviewed versioned migrations; don't run destructive schema push against a populated database. Preserve existing migration history. Reconcile legacy retained content under a documented bounded migration policy before claiming the new deletion guarantee.

## 12. Implementation order and verification gates

1. Inspect existing project, connected infrastructure and costs; record architecture and blockers.
2. Save this unified brief as `QUICK_CHAT_MASTER_PROMPT.md` and track feature status.
3. Repair security blockers, establish schema/migrations, auth/session handling and authorization.
4. Implement profiles/discovery, direct conversations and synchronized messages.
5. Implement actual receipts, exact per-recipient expiry and secure media lifecycle.
6. Implement groups, message actions, voice notes, search and presence.
7. Implement calls, push notifications, settings and PWA.
8. Run meaningful automated tests, build checks, adversarial authorization tests and two-user browser verification.
9. Deploy only a reviewable functional version, apply migrations safely and verify real production behavior.
10. Produce accurate handoff and remaining blockers.

**Core messaging gate:** two independent real test accounts register/login, discover each other, send/reply without refresh, receive honest delivery/read state, and reconnect without duplicates or unauthorized data.

**Retention gate:** accelerated internal test clocks verify 1h/12h/24h/after-view semantics; different group view times; unread limit; disabled read receipts; duplicate acknowledgements; concurrent view-once claims; membership removal; expired history/search/star/reply/media access; offline cache clearing; cleanup failures and retries. Check database and storage, not just the UI.

**Security gate:** a third user cannot read, acknowledge, edit, react, star, download, enumerate private data or signal unrelated conversations. Test blocked-user restrictions and malicious IDs/file keys. Ensure hashes, OTPs and secrets never appear in responses/bundles/logs.

**Calling gate:** two actual clients establish audio/video and verify mute, camera, decline/end, missed calls and failure handling. Test relay-required networks when TURN is available.

**Release gate:** lint, type checking, relevant unit/integration tests, production build, critical end-to-end tests and production smoke tests. Report pre-existing failures and external blockers exactly; never claim completion based on mocked tests alone. Fix root causes and rerun affected checks; do not delete meaningful tests to obtain a pass.

## 13. Documentation and final handoff

Maintain `README.md`, `ARCHITECTURE.md`, `SECURITY.md`, `PRIVACY.md`, `COST.md`, `DEPLOYMENT.md`, `TESTING.md` and `IMPLEMENTATION_STATUS.md`.

`COST.md` records each selected provider, dated official source, actual verified plan, free limits, observed/unknown usage, charge triggers, quota behavior and mitigation. Cover database, compute, media, transfer, realtime, TURN, email/SMS, background workers and push. Do not invent account usage or pricing.

Final handoff: working URL if actually deployed, repository/branch/PR, architecture, implemented and verified features, remaining limitations, security and E2EE status, test results, actual cost status and precise user action required for any external blocker. Do not equate “started building” with “finished.”

Begin execution now. Preserve existing work, make concrete changes, test them, and continue until the requested product works or a genuine external blocker is reached.
