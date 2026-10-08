import { useState } from "react";
import { Button } from "@/components/ui/button";

const invite = "https://quick-chat-preview-production.up.railway.app/invite";
export function HelpAndInvite({ mode }: { mode: "help" | "invite" }) {
  const [status, setStatus] = useState("");
  const [feedback, setFeedback] = useState("");
  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setStatus("Copied to clipboard.");
    } catch {
      setStatus("Copy failed. Select and copy the text below.");
    }
  }
  if (mode === "invite")
    return (
      <div className="space-y-4 text-sm">
        <p>
          Invite friends on Android, iPhone, Windows, Mac or Linux. The link
          shows the options for their device.
        </p>
        <input
          aria-label="Quick Chat invite link"
          className="border rounded p-2 w-full bg-background"
          readOnly
          value={invite}
          onFocus={e => e.target.select()}
        />
        <Button
          onClick={async () => {
            try {
              if (navigator.share)
                await navigator.share({
                  title: "Quick Chat",
                  text: "Join me on Quick Chat",
                  url: invite,
                });
              else await copy(invite);
            } catch (e) {
              if ((e as Error).name !== "AbortError")
                setStatus("Sharing failed. Use Copy link.");
            }
          }}
        >
          Share invitation
        </Button>
        <Button variant="outline" onClick={() => void copy(invite)}>
          Copy link
        </Button>
        <p role="status">{status}</p>
      </div>
    );
  return (
    <div className="space-y-4 text-sm">
      <details>
        <summary>Calls do not connect</summary>
        <p className="mt-2">
          Allow microphone/camera access. Check both connections. Some networks
          need a TURN relay; if the app reports that it is unavailable, contact
          the app owner. Keep the app open for incoming calls.
        </p>
      </details>
      <details>
        <summary>Finding friends</summary>
        <p className="mt-2">
          Enter the exact username or full phone number including country code.
          Username privacy can hide a match; partial names are not searched.
        </p>
      </details>
      <details>
        <summary>View-once photos and videos</summary>
        <p className="mt-2">
          Choose an attachment, enable View once in the preview and confirm
          Send. Each recipient can open it once. Screenshots and recordings
          cannot be prevented.
        </p>
      </details>
      <details>
        <summary>SMS sign-in</summary>
        <p className="mt-2">
          Live SMS requires the owner's Firebase billing and country settings.
          Test numbers use their configured code, without sending a text.
        </p>
      </details>
      <label className="block">
        Feedback
        <textarea
          aria-label="Feedback"
          value={feedback}
          onChange={e => setFeedback(e.target.value)}
          maxLength={3000}
          rows={5}
          className="mt-2 w-full rounded border p-2 bg-background"
          placeholder="What happened? What did you expect? Include the device and steps to reproduce."
        />
      </label>
      <p className="text-xs text-muted-foreground">
        Reports on GitHub are public and require a GitHub account. Do not
        include phone numbers, passwords, codes or private messages.
      </p>
      <Button disabled={!feedback.trim()} onClick={() => void copy(feedback)}>
        Copy feedback
      </Button>
      <a
        className="block text-sky-600 underline"
        target="_blank"
        rel="noreferrer"
        href="https://github.com/zainnaqvi512/Quick-Chate/issues/new"
      >
        Open public issue form
      </a>
      <p role="status">{status}</p>
    </div>
  );
}
