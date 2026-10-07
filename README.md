# Quick Chat ⚡

> **Preview status (2026-10-07):** see [MOBILE_AND_PHONE.md](MOBILE_AND_PHONE.md) for current phone-only authentication, exact contact lookup, native call controls, build checks and remaining blockers. Email sign-in is disabled; SMS activation still requires provider setup. This is a deployed preview, not WhatsApp feature parity or a production-ready/E2EE messenger. The historical overview below is not a verification report. Use [DEPLOYMENT.md](DEPLOYMENT.md) before migrations.

A full-stack, real-time messaging application with an original sky-blue identity — and one defining twist:

> **A conversation remains accessible for only 12 hours after it is opened/read.**
> The window starts from a **server-recorded read event** and is enforced at the database, API, media-access and cleanup-worker levels. Client-side clocks can never extend it.

## Feature overview

- **Phone-number registration with OTP** — country picker, E.164 normalization, hashed OTP storage, 10-minute expiry, attempt limits, resend cooldown and rate limiting. Development builds surface a test OTP; production plugs into an SMS provider via env vars.
- **One-to-one and group chats** — roles (owner/admin/member), pin/archive/mute, clear chat.
- **Messages** — text, emoji (full categorized picker), stickers (packs + recents + favorites), GIFs (GIPHY, graceful fallback), photos, videos, documents, voice messages (MediaRecorder + waveform-style player), location, contact cards.
- **Message actions** — reply, react (❤️ 👍 😂 😮 😢 🙏), copy, forward, star, delete-for-everyone.
- **Delivery & read receipts** — single/double ticks, blue on read, server-derived from participant `lastReadAt`. Respects read-receipt privacy settings.
- **Typing indicators, online/last-seen presence** (server-side `lastSeenAt`).
- **Voice & video calls** — real WebRTC (configurable STUN/TURN), signaling over the API, incoming-call overlay, mute/camera toggles, duration, missed/rejected states, call history kept separate from chat expiration.
- **Status / stories** — text/photo/video, 24-hour auto-expiry, view tracking, contacts-based privacy.
- **Contacts** — add by phone number, search, block, remove.
- **Search** — messages and users; expired content never appears.
- **Settings** — profile, privacy (last seen/photo/about/read receipts), notifications, appearance (light/dark/system), security (active sessions, delete account), starred messages, about.
- **PWA manifest**, responsive mobile (bottom nav) / desktop (3-panel) layouts, full dark mode.

## Architecture

```
apps-in-one:
├── api/                Hono + tRPC backend
│   ├── auth.ts         OTP hashing, sessions, Bearer auth, presence
│   ├── expiration.ts   12h window engine + idempotent cleanup worker
│   ├── authRouter.ts   request-otp / verify-otp / logout / sessions
│   ├── usersRouter.ts  profile, privacy, notifications, block list
│   ├── contactsRouter.ts
│   ├── conversationsRouter.ts  direct+group, read events, typing
│   ├── messagesRouter.ts       send/list/react/star/delete/search
│   ├── statusRouter.ts         24h statuses + views
│   ├── callsRouter.ts          WebRTC signaling + call history
│   └── mediaRouter.ts          object-storage uploads, expiry-guarded URLs
├── db/schema.ts        Drizzle (MySQL) models with indexes
├── src/                React 19 + Tailwind frontend
└── public/             PWA manifest + icon
```

### The 12-hour expiration lifecycle

```
Message sent → delivered → unread
    → user opens chat (server records readAt on ConversationParticipant)
    → expiresAt = readAt + 12h (set once, atomically, race-safe)
    → countdown displayed ("Chat expires in 11h 32m")
    → expiresAt passes → every read path (messages, media URLs, search, starred)
      refuses access; cleanup worker purges messages/reactions when ALL
      participant windows have expired.
```

Per-participant `expiresAt` means group members keep independent windows — one person opening a group never expires it for anyone else.

### Real-time

Messaging uses short-interval polling (2.5–5s) over tRPC with instant cache invalidation on send, which works reliably through the hosting platform's HTTP stack. The backend remains the single authority for permissions and expiration.

## Running locally

```bash
npm install
npm run db:push      # sync schema (needs DATABASE_URL)
npm run dev          # http://localhost:3000
npm run test         # unit tests (OTP, phone normalization, 12h expiry)
npm run check        # type-check
npm run build && npm start   # production
```

## Environment

See `.env.example`. Secrets never reach the browser; the dev OTP is only returned outside production or when `OTP_PROVIDER=dev`.

## Security notes

- OTPs are stored only as salted SHA-256 hashes; 5-attempt limit; 45s resend cooldown; per-phone rate limits.
- Sessions are opaque 256-bit tokens, stored hashed, 30-day expiry, revocable.
- Media is served via short-lived presigned URLs minted only after a server-side participation + expiration check.
- All inputs validated with Zod; all queries parameterized via Drizzle.
