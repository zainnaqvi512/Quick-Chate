import { useEffect, useRef, useState } from "react";
import { Mic, Loader2 } from "lucide-react";
export function HoldVoice({
  onSend,
  disabled,
}: {
  onSend: (file: File) => Promise<void>;
  disabled: boolean;
}) {
  const session = useRef<{
    held: boolean;
    cancel: boolean;
    x: number;
    rec?: MediaRecorder;
    stream?: MediaStream;
    started: number;
    timer?: ReturnType<typeof setTimeout>;
  } | null>(null);
  const [active, setActive] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const [retry, setRetry] = useState<File | null>(null);
  useEffect(
    () => () => {
      const s = session.current;
      if (s) {
        s.cancel = true;
        s.held = false;
        clearTimeout(s.timer);
        if (s.rec?.state === "recording") s.rec.stop();
        s.stream?.getTracks().forEach(t => t.stop());
      }
    },
    []
  );
  async function deliver(file: File) {
    setBusy(true);
    try {
      await onSend(file);
      setRetry(null);
      setError("");
    } catch (e) {
      setRetry(file);
      setError(
        e instanceof Error ? e.message : "Sending failed. Retry or discard."
      );
    } finally {
      setBusy(false);
    }
  }
  async function start(x: number) {
    if (disabled || busy || session.current?.held || retry) return;
    const s: {
      held: boolean;
      cancel: boolean;
      x: number;
      rec?: MediaRecorder;
      stream?: MediaStream;
      started: number;
      timer?: ReturnType<typeof setTimeout>;
    } = { held: true, cancel: false, x, started: 0 };
    session.current = s;
    setError("");
    setActive(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      s.stream = stream;
      if (!s.held || s.cancel) {
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      const rec = new MediaRecorder(stream);
      s.rec = rec;
      s.started = Date.now();
      const chunks: Blob[] = [];
      rec.ondataavailable = e => chunks.push(e.data);
      rec.onstop = () => {
        clearTimeout(s.timer);
        stream.getTracks().forEach(t => t.stop());
        if (s.cancel || Date.now() - s.started < 500) return;
        const blob = new Blob(chunks, { type: rec.mimeType || "audio/webm" });
        if (!blob.size || blob.size > 15 * 1024 * 1024) {
          setError("Recording exceeds the 15 MB limit.");
          return;
        }
        void deliver(
          new File(
            [blob],
            `voice-${Date.now()}.${blob.type.includes("mp4") ? "m4a" : "webm"}`,
            { type: blob.type }
          )
        );
      };
      rec.start();
      s.timer = setTimeout(() => {
        finish(true);
        setError("Recording cancelled at the 2-minute limit.");
      }, 120000);
    } catch {
      finish(true);
      setError("Microphone unavailable. Check its permission and try again.");
    }
  }
  function finish(cancel: boolean) {
    const s = session.current;
    if (!s) return;
    s.held = false;
    s.cancel ||= cancel;
    clearTimeout(s.timer);
    if (s.rec?.state === "recording") s.rec.stop();
    setActive(false);
  }
  return (
    <div className="relative flex items-center">
      {active && (
        <div
          role="status"
          className="absolute right-12 bottom-0 w-52 rounded-xl bg-card border p-3 text-sm text-red-500"
        >
          Recording… slide left to cancel. Release to send.
        </div>
      )}
      <button
        type="button"
        aria-label="Hold to record; release to send; slide left to cancel"
        disabled={disabled || busy || !!retry}
        className={`p-2.5 rounded-full touch-none select-none ${active ? "bg-red-500 text-white" : "bg-sky-500 text-white"}`}
        onContextMenu={e => e.preventDefault()}
        onPointerDown={e => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          void start(e.clientX);
        }}
        onPointerMove={e => {
          const s = session.current;
          if (s?.held && e.clientX < s.x - 70) finish(true);
        }}
        onPointerUp={() => finish(false)}
        onPointerCancel={() => finish(true)}
        onLostPointerCapture={() => {
          if (session.current?.held) finish(true);
        }}
        onKeyDown={e => {
          if ((e.key === " " || e.key === "Enter") && !e.repeat) {
            e.preventDefault();
            void start(0);
          }
          if (e.key === "Escape") finish(true);
        }}
        onKeyUp={e => {
          if (e.key === " " || e.key === "Enter") {
            e.preventDefault();
            finish(false);
          }
        }}
        onBlur={() => finish(true)}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Mic className="h-5 w-5" />
        )}
      </button>
      {error && (
        <div
          role="alert"
          className="absolute bottom-14 right-0 bg-card border p-3 rounded-xl w-64 text-sm"
        >
          {error}
          {retry && (
            <div className="flex gap-4 mt-2">
              <button disabled={busy} onClick={() => void deliver(retry)}>
                Retry sending
              </button>
              <button
                disabled={busy}
                onClick={() => {
                  setRetry(null);
                  setError("");
                }}
              >
                Discard
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
