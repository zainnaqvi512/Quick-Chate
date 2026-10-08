import { useCallback, useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { formatBytes } from "@/lib/format";

function FilePreview({ file }: { file: File }) {
  const attachPreview = useCallback(
    (
      element: HTMLImageElement | HTMLVideoElement | HTMLAudioElement | null
    ) => {
      if (!element) return;
      const url = URL.createObjectURL(file);
      element.src = url;
      return () => {
        element.removeAttribute("src");
        URL.revokeObjectURL(url);
      };
    },
    [file]
  );
  const [text, setText] = useState("");
  useEffect(() => {
    let active = true;
    if (file.type.startsWith("text/") || /\.(txt|csv|md)$/i.test(file.name))
      void file
        .slice(0, 6000)
        .text()
        .then(value => {
          if (active) setText(value);
        });
    return () => {
      active = false;
    };
  }, [file]);
  return (
    <div className="rounded-xl border p-3 space-y-2">
      {file.type.startsWith("image/") ? (
        <img
          ref={attachPreview}
          alt={file.name}
          className="max-h-52 mx-auto object-contain"
        />
      ) : file.type.startsWith("video/") ? (
        <video
          ref={attachPreview}
          controls
          playsInline
          className="max-h-52 w-full"
        />
      ) : file.type.startsWith("audio/") ? (
        <audio ref={attachPreview} controls className="w-full" />
      ) : text ? (
        <pre className="text-xs whitespace-pre-wrap max-h-40 overflow-auto">
          {text}
        </pre>
      ) : (
        <p className="text-sm">
          Document ready to send. A visual preview is not available for this
          format.
        </p>
      )}
      <p className="text-sm font-medium break-all">{file.name}</p>
      <p className="text-xs text-muted-foreground">
        {formatBytes(file.size)} · {file.type || "File"}
      </p>
    </div>
  );
}
export function AttachmentPreview({
  files,
  busy,
  error,
  onCancel,
  onSend,
}: {
  files: File[];
  busy: boolean;
  error: string;
  onCancel: () => void;
  onSend: (viewOnce: boolean, caption: string) => void;
}) {
  const [once, setOnce] = useState(false);
  const [caption, setCaption] = useState("");
  const eligible = files.every(
    f =>
      (f.type.startsWith("image/") && f.type !== "image/gif") ||
      f.type.startsWith("video/")
  );
  return (
    <Dialog
      open={files.length > 0}
      onOpenChange={open => {
        if (!open && !busy) onCancel();
      }}
    >
      <DialogContent className="max-h-[90dvh] overflow-y-auto max-w-lg">
        <DialogHeader>
          <DialogTitle>Review before sending</DialogTitle>
        </DialogHeader>
        {files.map((file, i) => (
          <FilePreview key={`${file.name}-${i}`} file={file} />
        ))}
        <label className="text-sm">
          Caption (optional)
          <textarea
            aria-label="Attachment caption"
            className="w-full mt-1 border rounded p-2 bg-background"
            value={caption}
            disabled={busy}
            onChange={e => setCaption(e.target.value)}
            maxLength={2000}
          />
        </label>
        {eligible && (
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              checked={once}
              disabled={busy}
              onChange={e => setOnce(e.target.checked)}
            />
            <span>
              View once
              <span className="block text-xs text-muted-foreground">
                Each recipient can open each photo/video once. No reopening or
                forwarding. Screenshots cannot be prevented.
              </span>
            </span>
          </label>
        )}
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="outline" disabled={busy} onClick={onCancel}>
            Cancel
          </Button>
          <Button
            disabled={busy}
            onClick={() => onSend(eligible && once, caption.trim())}
          >
            {busy
              ? "Sending…"
              : `Send ${files.length} attachment${files.length === 1 ? "" : "s"}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
