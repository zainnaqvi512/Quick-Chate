import { Link } from "react-router";
import { Logo } from "@/components/Logo";
export default function InvitePage() {
  const ua = navigator.userAgent;
  const ios =
    /iPhone|iPad|iPod/.test(ua) ||
    (/Mac/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  return (
    <main className="min-h-dvh flex items-center justify-center p-6 bg-background">
      <div className="max-w-md rounded-2xl border bg-card p-8 space-y-5 text-center">
        <Logo size={56} />
        <h1 className="text-3xl font-bold text-sky-500">
          You're invited to Quick Chat
        </h1>
        <p>
          Private conversations with disappearing messages and voice/video
          calls.
        </p>
        <Link
          className="block rounded-xl bg-sky-500 text-white py-3"
          to="/auth"
        >
          {ios
            ? "Continue on iPhone / iPad"
            : android
              ? "Continue on Android"
              : "Continue on your computer"}
        </Link>
        <p className="text-sm text-muted-foreground">
          {ios
            ? "Open in Safari. Use Share → Add to Home Screen for a shortcut."
            : android
              ? "Open in Chrome. Use its menu → Add to Home screen for a shortcut."
              : "Open in Chrome, Edge, Firefox or Safari. Bookmark this page for quick access."}
        </p>
        <p className="text-xs text-muted-foreground">
          The web app is available now. App Store, Google Play and desktop
          installers are not published yet. Availability depends on your
          connection and local network. This version is not end-to-end
          encrypted.
        </p>
      </div>
    </main>
  );
}
