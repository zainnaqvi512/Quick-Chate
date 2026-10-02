import { useEffect, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { EmojiPicker, StickersPanel } from "./EmojiPicker";
import { fileToBase64 } from "@/lib/format";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Camera,
  Contact as ContactIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Mic,
  Paperclip,
  Send,
  Smile,
  Sticker,
  X,
} from "lucide-react";

const GIPHY_KEY = (import.meta as any).env?.VITE_GIPHY_API_KEY as string | undefined;

export function Composer({
  conversationId,
  onTyping,
  contacts,
  replyToId,
  onSent,
}: {
  conversationId: number;
  onTyping: () => void;
  contacts: { userId: number; name: string; phone: string }[];
  replyToId?: number | null;
  onSent?: () => void;
}) {
  const [text, setText] = useState("");
  const [attachOpen, setAttachOpen] = useState(false);
  const [gifOpen, setGifOpen] = useState(false);
  const [gifQuery, setGifQuery] = useState("");
  const [gifs, setGifs] = useState<{ id: string; url: string }[]>([]);
  const [gifLoading, setGifLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recStartRef = useRef(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const acceptRef = useRef("image/*");
  const typingThrottle = useRef(0);

  const utils = trpc.useUtils();
  const send = trpc.messages.send.useMutation({
    onSuccess: () => {
      utils.messages.list.invalidate({ conversationId });
      utils.conversations.list.invalidate();
      onSent?.();
    },
    onError: (e) => setError(e.message),
  });
  const upload = trpc.media.upload.useMutation();

  useEffect(() => {
    if (!recording) return;
    const t = setInterval(() => setRecSeconds(Math.floor((Date.now() - recStartRef.current) / 1000)), 250);
    return () => clearInterval(t);
  }, [recording]);

  function doSend(type: string, payload: { content?: string; mediaUrl?: string; mediaMeta?: string }) {
    setError("");
    send.mutate({ conversationId, type: type as any, replyToId: replyToId ?? undefined, ...payload });
  }

  function submitText() {
    const t = text.trim();
    if (!t) return;
    setText("");
    doSend("text", { content: t });
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files).slice(0, 10)) {
        if (file.size > 15 * 1024 * 1024) {
          setError(`"${file.name}" exceeds the 15 MB limit`);
          continue;
        }
        const base64 = await fileToBase64(file);
        const res = await upload.mutateAsync({
          name: file.name,
          contentBase64: base64,
          contentType: file.type || "application/octet-stream",
        });
        let type = "document";
        if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("video/")) type = "video";
        else if (file.type.startsWith("audio/")) type = "audio";
        doSend(type, {
          mediaUrl: res.key,
          mediaMeta: JSON.stringify({ name: file.name, size: file.size, mime: file.type }),
        });
      }
    } catch (e: any) {
      setError(e?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const rec = new MediaRecorder(stream);
      chunksRef.current = [];
      rec.ondataavailable = (e) => chunksRef.current.push(e.data);
      rec.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: rec.mimeType || "audio/webm" });
        const duration = Math.round((Date.now() - recStartRef.current) / 1000);
        if (duration < 1) return;
        setUploading(true);
        try {
          const base64 = await fileToBase64(blob);
          const res = await upload.mutateAsync({
            name: `voice-${Date.now()}.webm`,
            contentBase64: base64,
            contentType: blob.type,
          });
          doSend("audio", { mediaUrl: res.key, mediaMeta: JSON.stringify({ duration, mime: blob.type, size: blob.size }) });
        } catch (e: any) {
          setError(e?.message || "Voice upload failed");
        } finally {
          setUploading(false);
        }
      };
      recorderRef.current = rec;
      recStartRef.current = Date.now();
      rec.start();
      setRecording(true);
    } catch {
      setError("Microphone permission denied");
    }
  }

  function stopRecording(cancel: boolean) {
    const rec = recorderRef.current;
    if (!rec) return;
    if (cancel) {
      rec.onstop = () => rec.stream.getTracks().forEach((t) => t.stop());
      rec.stop();
    } else {
      rec.stop();
    }
    setRecording(false);
  }

  async function searchGifs(q: string) {
    if (!GIPHY_KEY) return;
    setGifLoading(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=18&rating=g`,
      );
      const data = await res.json();
      setGifs(
        (data.data || []).map((g: any) => ({
          id: g.id,
          url: g.images?.fixed_height_small?.url || g.images?.original?.url,
        })),
      );
    } catch {
      setGifs([]);
    } finally {
      setGifLoading(false);
    }
  }

  function shareLocation() {
    setAttachOpen(false);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        doSend("location", {
          mediaMeta: JSON.stringify({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        });
      },
      () => setError("Location permission denied"),
      { timeout: 10000 },
    );
  }

  const contactList = contacts;

  return (
    <div className="border-t bg-card px-2 sm:px-4 py-2">
      {error && (
        <div className="text-xs text-destructive px-2 pb-1 flex items-center gap-2" role="alert">
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      {recording ? (
        <div className="flex items-center gap-3 py-1.5 px-2">
          <span className="h-3 w-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-sm font-mono">
            {Math.floor(recSeconds / 60)}:{String(recSeconds % 60).padStart(2, "0")}
          </span>
          <span className="text-sm text-muted-foreground flex-1">Recording…</span>
          <button
            className="p-2 rounded-full hover:bg-accent text-muted-foreground"
            onClick={() => stopRecording(true)}
            aria-label="Cancel recording"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            className="p-2.5 rounded-full bg-sky-500 text-white hover:bg-sky-600"
            onClick={() => stopRecording(false)}
            aria-label="Send voice message"
          >
            <Send className="h-5 w-5" />
          </button>
        </div>
      ) : (
        <div className="flex items-end gap-1">
          {/* Emoji */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-2.5 rounded-full hover:bg-accent text-muted-foreground" aria-label="Emoji">
                <Smile className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-auto" align="start" side="top">
              <EmojiPicker onPick={(e) => setText((t) => t + e)} />
            </PopoverContent>
          </Popover>

          {/* Stickers */}
          <Popover>
            <PopoverTrigger asChild>
              <button className="p-2.5 rounded-full hover:bg-accent text-muted-foreground" aria-label="Stickers">
                <Sticker className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-auto" align="start" side="top">
              <StickersPanel onPick={(s) => doSend("sticker", { content: s, mediaUrl: undefined, mediaMeta: JSON.stringify({ sticker: s }) })} />
            </PopoverContent>
          </Popover>

          {/* GIF */}
          <Popover
            open={gifOpen}
            onOpenChange={(o) => {
              setGifOpen(o);
              if (o) searchGifs("");
            }}
          >
            <PopoverTrigger asChild>
              <button className="p-2.5 rounded-full hover:bg-accent text-muted-foreground" aria-label="GIF">
                <span className="text-[10px] font-bold border rounded px-1">GIF</span>
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-80" align="start" side="top">
              {GIPHY_KEY ? (
                <>
                  <input
                    className="w-full rounded-md border px-3 py-1.5 text-sm mb-2 bg-background"
                    placeholder="Search GIFs"
                    value={gifQuery}
                    onChange={(e) => {
                      setGifQuery(e.target.value);
                      searchGifs(e.target.value);
                    }}
                    aria-label="Search GIFs"
                  />
                  {gifLoading ? (
                    <div className="flex justify-center py-6">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1 max-h-64 overflow-y-auto">
                      {gifs.map((g) => (
                        <button
                          key={g.id}
                          onClick={() => {
                            doSend("gif", { mediaUrl: g.url });
                            setGifOpen(false);
                          }}
                        >
                          <img src={g.url} alt="GIF" className="rounded w-full h-20 object-cover" loading="lazy" />
                        </button>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-muted-foreground p-2">
                  GIF search is not configured. Set <code>VITE_GIPHY_API_KEY</code> to enable GIPHY.
                </p>
              )}
            </PopoverContent>
          </Popover>

          {/* Attachments */}
          <Popover open={attachOpen} onOpenChange={setAttachOpen}>
            <PopoverTrigger asChild>
              <button className="p-2.5 rounded-full hover:bg-accent text-muted-foreground" aria-label="Attach">
                <Paperclip className="h-5 w-5" />
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-56 p-1" align="start" side="top">
              <button
                className="menu-item"
                onClick={() => {
                  acceptRef.current = "image/*,video/*";
                  fileInputRef.current?.click();
                  setAttachOpen(false);
                }}
              >
                <ImageIcon className="h-4 w-4 text-sky-500" /> Photos & videos
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  acceptRef.current = "image/*";
                  fileInputRef.current?.setAttribute("capture", "environment");
                  fileInputRef.current?.click();
                  setAttachOpen(false);
                }}
              >
                <Camera className="h-4 w-4 text-emerald-500" /> Camera
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  acceptRef.current = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,application/*";
                  fileInputRef.current?.click();
                  setAttachOpen(false);
                }}
              >
                <FileText className="h-4 w-4 text-amber-500" /> Document
              </button>
              <button className="menu-item" onClick={shareLocation}>
                <MapPin className="h-4 w-4 text-rose-500" /> Location
              </button>
              {contactList.length > 0 && (
                <div className="border-t mt-1 pt-1">
                  <p className="text-[11px] text-muted-foreground px-2 pb-1 flex items-center gap-1">
                    <ContactIcon className="h-3 w-3" /> Share contact
                  </p>
                  {contactList.slice(0, 5).map((c) => (
                    <button
                      key={c.userId}
                      className="menu-item"
                      onClick={() => {
                        doSend("contact", { mediaMeta: JSON.stringify({ name: c.name, phone: c.phone }) });
                        setAttachOpen(false);
                      }}
                    >
                      <span className="truncate">{c.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </PopoverContent>
          </Popover>

          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              handleFiles(e.target.files);
              e.target.value = "";
              fileInputRef.current?.removeAttribute("capture");
            }}
          />

          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (Date.now() - typingThrottle.current > 2500) {
                typingThrottle.current = Date.now();
                onTyping();
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submitText();
              }
            }}
            placeholder="Type a message"
            rows={1}
            aria-label="Message input"
            className="flex-1 resize-none rounded-2xl border bg-background px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500 max-h-32"
          />

          {uploading ? (
            <span className="p-2.5">
              <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
            </span>
          ) : text.trim() ? (
            <button
              className="p-2.5 rounded-full bg-sky-500 text-white hover:bg-sky-600 transition-colors"
              onClick={submitText}
              aria-label="Send message"
            >
              <Send className="h-5 w-5" />
            </button>
          ) : (
            <button
              className="p-2.5 rounded-full hover:bg-accent text-muted-foreground"
              onClick={startRecording}
              aria-label="Record voice message"
            >
              <Mic className="h-5 w-5" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}

