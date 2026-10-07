# Phone-first and mobile implementation checkpoint

## What changed

- The primary sign-in screen accepts a phone number and verifies an SMS code through Twilio Verify.
- New email registration is disabled by default. Existing email/password users retain sign-in and can link a verified phone under Settings → Profile without losing chats.
- Login and linking challenges are signed, expire after ten minutes, are bound to the intended account, and require the provider's approved status for the same number. No production test OTP is exposed.
- SMS country allowlist, global/phone resend limits, and check limits are enforced. In-memory limits are only a single-replica defense; configure provider-side fraud/rate/spend controls before activation.
- Search explains name/@username/verified-phone lookup and displays usernames. It does not import WhatsApp accounts or a device address book.
- Capacitor Android/iOS project generation bundles the React UI locally and connects to the HTTPS backend, rather than loading a remote website as the app UI.

## SMS activation blocker

In Railway's app service variables, securely configure `OTP_PROVIDER=twilio`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `APP_SECRET`, and `SMS_ALLOWED_PREFIXES` (initially `+92` for Pakistan testing). Never commit or send credentials in chat.

Create/configure the Verify service and its Geo Permissions, fraud protection, rate limits and billing controls in your provider account. Live texts cost money and regional/carrier coverage varies. No SMS provider has been provisioned or funded by this change. Do not claim verification works end-to-end until a real send and check passes. New signup is unavailable until this is configured; existing email login continues.

## Reproduce the native projects

Install dependencies with `npm ci` using Node 22+. Set `VITE_API_ORIGIN=https://quick-chat-preview-production.up.railway.app` when building native apps (not needed for web builds).

Run `npm run mobile:android` or `npm run mobile:ios`. Generated platform folders are ignored and reproducible; preserve any future native customizations in the generation process or intentionally version those projects before editing them. Open with `npx cap open android` / `npx cap open ios`.

Configure backend `NATIVE_ORIGINS=capacitor://localhost,https://localhost` to permit authenticated API requests from native WebViews. Never allow arbitrary origins. The app ID `app.quickchat.preview` is a provisional test identifier, not a final store identity.

Android Studio/SDK/JDK and Xcode/macOS respectively are required for device builds. Generating projects does not mean an APK/IPA was compiled or tested. Store releases require the owner's developer accounts and signing setup.

## Still unfinished

- Real-device Android/iOS testing and signed distribution.
- Native push/incoming calls in background, contacts permission/sync, secure device credential storage, microphone/camera permissions and platform call/audio routing.
- Production rate-limit persistence, verified migration rollout, complete recovery flows and end-to-end encryption.
- Universal geographic availability is not guaranteed: connectivity, SMS coverage, local restrictions and store availability apply.

Tests mock Twilio; they do not send SMS. The existing dev-only OTP endpoint remains disabled in production.
