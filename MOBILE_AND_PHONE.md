# Quick Chat: phone accounts and calling

## Current implementation

- Sign in and Create account both require a phone number and a provider-approved SMS code. Email login and registration are rejected by the API, even if the old email-signup flag is enabled.
- Existing email-only sessions can view their own account and link a verified phone. Messaging, calls, search and protected media are inaccessible until verification. Existing chats are retained. A signed-out email-only account cannot currently be recovered or migrated; do not delete its data or merge accounts by an unverified identifier.
- Profile setup requires a unique username. Username and phone searches return exact matches only, exclude blocked accounts, and honor avatar/about privacy. Display-name and partial-user matching are removed from both search endpoints. Message-content search is unchanged.
- The call screen has mute/unmute, hold/resume, audio output, camera on/off, camera flip, minimize/return and end controls. Hold disables local outgoing tracks and remote playback; the other caller receives hold state.
- Desktop screen sharing replaces the outgoing video track on video calls where the browser supports display capture. It does not share system audio. Video upgrade within a voice call, group calling, and native screen broadcasting are not implemented.
- WebRTC candidates wait for remote SDP; answer application is guarded, media survives minimize/restore, duplicate start/accept gestures are blocked, and cleanup closes tracks and releases native audio. Server starts lock both participants to prevent concurrent-call races; accept checks the conditional update.
- Android and iOS bridges control communication audio. Proximity monitoring is enabled only for a voice call whose actual output is the earpiece. Speaker, video and external-headset routes disable it. Devices without a receiver/sensor cannot offer those features.
- Browser builds use system output or a browser output picker where supported; they cannot claim native earpiece or proximity control.

## Firebase phone authentication (2026-10-08)

The web login now uses Firebase project `quick-chat-64f77`. Public client identifiers are in `shared/firebaseConfig.ts`; Analytics is not initialized. Firebase runs a visible reCAPTCHA challenge and delivers the SMS. The application exchanges the resulting ID token for its existing MySQL-backed session. The Admin SDK verifies Google's signature, issuer, audience and expiry; application checks require the phone provider, an E.164 phone number and authentication within five minutes. Email/password tokens and emulator tokens are rejected. The server uses only the verified phone claim, never a client-supplied phone number. Existing email-only sessions can link a phone without deleting their chats.

No service-account private key is required for public-key ID token verification. Firebase revocation/disabled-user lookup is not performed: Firebase user deletion or disabling does not automatically revoke existing Quick Chat sessions. Quick Chat logout/session controls remain authoritative for those sessions.

Console prerequisites still require account-owner setup: enable Authentication's Phone provider, enable Blaze billing, allow the intended SMS regions (start with Pakistan), and authorize `quick-chat-preview-production.up.railway.app`. Use Firebase's provider-side abuse controls and SMS quotas. The UI's 60-second resend timer is a convenience, not a server security boundary. Real SMS delivery and completed sign-in have not yet been verified. No WhatsApp OTP integration is included.

The legacy Twilio procedures remain inactive unless their environment is explicitly configured. The UI uses Firebase. There is no email or unverified phone fallback.

The supplied configuration registers a web app only. Bundled Capacitor builds cannot use localhost web phone auth; they show a web sign-in link instead of a broken SMS form. Browser login does not log in the native app. Native Firebase integration remains blocked on Android/iOS app registration, platform config files, Android signing fingerprints and iOS APNs setup. Do not advertise native phone login as complete.

## Native projects

Use Node 22+, `npm ci`, and `VITE_API_ORIGIN=https://quick-chat-preview-production.up.railway.app`.
Run `npm run mobile:android` or `npm run mobile:ios`.
The generated root `android/` and `ios/` folders are ignored. Versioned custom bridges live under `native/` and are installed by `scripts/mobile.mjs`, including permissions, registration and iOS storyboard configuration.

Backend `NATIVE_ORIGINS=capacitor://localhost,https://localhost` permits these WebViews. The provisional app ID is `app.quickchat.preview`. Android Studio/SDK/JDK and Xcode/macOS are needed for device builds. Store releases need developer accounts and signing.

CI builds an Android debug APK, compiles an unsigned iOS simulator app, checks TypeScript/lint/unit tests, and runs integration tests against disposable MySQL. Build success does not establish physical-device audio or proximity behavior.

## Physical-device acceptance

1. Install the new APK, or build/sign the iOS app on a device.
2. With SMS configured, verify two separate numbers and set usernames. Confirm partial names find nobody, exact username/phone finds the other account, and blocking hides the result.
3. Test calls in both directions on Wi-Fi and cellular with TURN configured. Verify remote audio/video, mute, hold/resume, camera flip, minimize/return and hangup.
4. Voice call: select earpiece and cover the proximity sensor. The physical display should turn off, then wake when uncovered. Repeat with speaker, video and headset; proximity should remain off.
5. Deny microphone/camera permission, cancel while preparing, decline, let ringing expire, interrupt connectivity, and end from either device. Check that the microphone/camera indicators disappear and normal device audio is restored.
6. Verify wired/Bluetooth output changes and speaker/receiver availability on each supported device/OS version. Older Android headset routing is system-controlled.

## Remaining gaps

### Published upgrade and validation

38 unit tests, application/API TypeScript, integration-suite TypeScript, lint and the web/server build passed. Three built-server smoke checks passed. Android and iOS scaffold generation/sync succeeded with the custom bridges installed.

Published with the owner's explicit approval to `feat/quick-chat-private-messaging`, code commit `5d9b2329164a6031a9da66a80efd368b52ee9178`. GitHub Actions run `37639450851` passed all four jobs: 38 unit tests, 14 disposable-MySQL integration tests, web/type/lint/security checks, Android debug APK compilation and unsigned iOS simulator compilation.

The Android APK is in the run's `quick-chat-android-debug` artifact (`11491536296`, expires 2026-10-14). The simulator build is not a signed iPhone/TestFlight release. Neither native build has been tested on physical hardware.

Railway deployment `975d7e5e-12cd-4781-ab61-d15b3f83f6b7` succeeded and is pinned to that tested code commit. The live `/auth` screen was checked: Sign in and Create account are visible, and email login is absent. SMS remains unavailable until provider configuration is completed.

- No physical Android/iOS call or sensor test has been performed.
- TURN relay service is not configured; cross-network connectivity is not guaranteed.
- No native push, background/terminated-app incoming calling, CallKit/Android Telecom integration, contact-book synchronization, or signed store distribution.
- No end-to-end message encryption, complete account recovery/migration, multi-device sync, group calls or live voice-to-video upgrade.
- Polling remains the signaling/message transport. This is an upgraded preview, not WhatsApp feature parity.
- Global availability depends on internet access, SMS delivery, device support and regional restrictions.

## Messaging and mobile usability update (2026-10-08)

- Voice calls show audio controls only; camera toggles/flip are video-only.
- Tabs, chats and settings pages are URL/history-backed. Android back uses application history and stays on the root screen. Browser back can still leave the site from the root. Back navigation minimizes an active call without ending it. Only one responsive layout is mounted, avoiding duplicate polling/composers.
- Photo, video, audio recording and document attachments enter a review screen before upload/send. Supported image/video/audio/text formats preview inline; other documents show filename/type/size. Failed batch sending retains unsent files. View once is selectable per photo/video; the existing atomic recipient receipt prevents reopening, forwarding and regular media downloads. Server cleanup deletes inaccessible attachments asynchronously (minute cadence); screenshots/recordings cannot be prevented.
- Six original built-in animated GIFs work without an API key. Optional GIPHY search still uses VITE_GIPHY_API_KEY. GIFs now pass through owned uploads instead of sending rejected external URLs. Search failures and empty results are visible.
- Incoming and outgoing synthesized call tones stop when ringing ends. Three incoming tones are selectable per device under Notifications. Browser autoplay restrictions require interaction; no background push/CallKit or closed-app ringing is implemented.
- Username discovery offers everyone, friends of friends, or nobody outside mutual contacts. Friends-of-friends requires reciprocal contact edges through an intermediary, with blocking honored. Exact phone lookup is unaffected. This is enforced in both search endpoints. Contacts do not imply independently verified knowledge of a phone number.
- Help includes troubleshooting and a copy-feedback/public GitHub issue flow. No private support inbox is provisioned. Invite links use /invite and show appropriate browser/home-screen instructions. Signed native/desktop installers and store links are not available; regional accessibility cannot be guaranteed.

### Relay activation still required

The backend supports Cloudflare Realtime TURN via CLOUDFLARE_TURN_KEY_ID and CLOUDFLARE_TURN_API_TOKEN, stored only as Railway server variables. The owner must create the TURN key in their Cloudflare account and place the values in the existing quick-chat-preview service; do not paste long-lived tokens into chat or client variables. Calls request one-hour credentials and cache them briefly per user. The provider token is never returned. coturn TURN_URL + TURN_SHARED_SECRET remains supported (comma-separated endpoints). Cloudflare STUN is the default, but STUN alone is not a relay. A missing/failed TURN provider leaves the relay warning visible.

Cloudflare advertises a 1,000 GB shared monthly Realtime egress free tier; paid overage/account terms must be reviewed in its dashboard. No Cloudflare account/key has been provisioned and no forced-relay device test has been performed. After configuration, verify calls between Wi-Fi and mobile data and test with iceTransportPolicy=relay in a dedicated diagnostic client.
