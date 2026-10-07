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

## SMS activation blocker

In Railway's app service variables, securely configure:
`OTP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `APP_SECRET`, and `SMS_ALLOWED_PREFIXES` (initially `+92` for Pakistan testing).

Configure the Verify service's geographic permissions, fraud protection and billing controls in the provider account. Credentials must never be committed or pasted into chat. Live texts cost money and country/carrier coverage varies. No SMS provider was provisioned or funded by this change. No real SMS has been sent or verified. Phone-only enforcement means login and signup are unavailable until the provider is configured; there is no email fallback.

Challenges are signed, expire after ten minutes, bind linking to the existing account, and require provider approval for the same number. Resend and verification limits are enforced in memory for this single app replica. Production test OTPs remain disabled.

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
