import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { EmojiPicker, StickersPanel } from "./EmojiPicker";
import { HoldVoice } from "./HoldVoice";
import { AttachmentPreview } from "./AttachmentPreview";
import { fileToBase64 } from "@/lib/format";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Camera,
  Contact as ContactIcon,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Paperclip,
  Send,
  Smile,
  Sticker,
  X,
} from "lucide-react";

const GIPHY_KEY = import.meta.env.VITE_GIPHY_API_KEY as string | undefined;

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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const sendingFiles = useRef(false);
  const gifRequest = useRef(0);

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
    onError: e => setError(e.message),
  });
  const upload = trpc.media.upload.useMutation();

  type MessageType = Parameters<typeof send.mutate>[0]["type"];

  function doSend(
    type: MessageType,
    payload: { content?: string; mediaUrl?: string; mediaMeta?: string }
  ) {
    setError("");
    send.mutate({
      conversationId,
      type,
      replyToId: replyToId ?? undefined,
      ...payload,
    });
  }

  function submitText() {
    const t = text.trim();
    if (!t) return;
    setText("");
    doSend("text", { content: t });
  }

  function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const selected = Array.from(files).slice(0, 10);
    if (selected.some(f => f.size > 15 * 1024 * 1024 || f.size === 0)) {
      setError("Choose files between 1 byte and 15 MB.");
      return;
    }
    setError("");
    setPendingFiles(selected);
  }

  async function confirmFiles(viewOnce: boolean, caption: string) {
    if (sendingFiles.current) return;
    sendingFiles.current = true;
    setUploading(true);
    setError("");
    try {
      for (const file of pendingFiles) {
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
        let type: MessageType = "document";
        if (file.type === "image/gif") type = "gif";
        else if (file.type.startsWith("image/")) type = "image";
        else if (file.type.startsWith("video/")) type = "video";
        else if (file.type.startsWith("audio/")) type = "audio";
        await send.mutateAsync({
          conversationId,
          type,
          viewOnce: viewOnce && type !== "gif",
          content: caption || undefined,
          replyToId: replyToId ?? undefined,
          mediaUrl: res.key,
          mediaMeta: JSON.stringify({
            name: file.name,
            size: file.size,
            mime: file.type,
          }),
        });
        setPendingFiles(current => current.filter(item => item !== file));
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
      sendingFiles.current = false;
    }
  }

  async function searchGifs(q: string) {
    const request = ++gifRequest.current;
    const builtIn = ["Hello", "LOL", "Thanks", "Wow", "Yes", "No"]
      .filter(name => name.toLowerCase().includes(q.toLowerCase()))
      .map(name => ({ id: name, url: `/gifs/${name.toLowerCase()}.gif` }));
    if (!GIPHY_KEY) {
      setGifs(builtIn);
      return;
    }
    setGifLoading(true);
    try {
      const res = await fetch(
        `https://api.giphy.com/v1/gifs/${q ? "search" : "trending"}?api_key=${GIPHY_KEY}&q=${encodeURIComponent(q)}&limit=18&rating=g`
      );
      const data = await res.json();
      if (!res.ok) throw new Error("GIF search unavailable");
      if (request !== gifRequest.current) return;
      setGifs(
        (data.data || []).map(
          (g: {
            id: string;
            images: {
              fixed_height_small?: { url: string };
              original: { url: string };
            };
          }) => ({
            id: g.id,
            url: g.images?.fixed_height_small?.url || g.images?.original?.url,
          })
        )
      );
    } catch {
      if (request === gifRequest.current) {
        setGifs(builtIn);
        setError("Online GIF search is unavailable. Showing built-in GIFs.");
      }
    } finally {
      if (request === gifRequest.current) setGifLoading(false);
    }
  }

  function shareLocation() {
    setAttachOpen(false);
    if (!navigator.geolocation) {
      setError("Geolocation is not supported on this device");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        doSend("location", {
          mediaMeta: JSON.stringify({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          }),
        });
      },
      () => setError("Location permission denied"),
      { timeout: 10000 }
    );
  }

  const contactList = contacts;

  return (
    <div className="shrink-0 border-t bg-card px-2 sm:px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      {pendingFiles.length > 0 && (
        <AttachmentPreview
          files={pendingFiles}
          busy={uploading}
          error={error}
          onCancel={() => {
            setPendingFiles([]);
            setError("");
          }}
          onSend={(once, caption) => void confirmFiles(once, caption)}
        />
      )}
      {error && (
        <div
          className="text-xs text-destructive px-2 pb-1 flex items-center gap-2"
          role="alert"
        >
          {error}
          <button onClick={() => setError("")} aria-label="Dismiss error">
            <X className="h-3 w-3" />
          </button>
        </div>
      )}
      <div className="flex items-end gap-1">
        {/* Emoji */}
        <Popover>
          <PopoverTrigger asChild>
            <button
              className="p-2.5 rounded-full hover:bg-accent text-muted-foreground"
              aria-label="Emoji"
            >
              <Smile className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 w-auto" align="start" side="top">
            <EmojiPicker onPick={e => setText(t => t + e)} />
            <div className="flex items-center border-t">
              {" "}
              {/* Stickers */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    className="p-2.5 rounded-full hover:bg-accent text-muted-foreground"
                    aria-label="Stickers"
                  >
                    <Sticker className="h-5 w-5" />
                  </button>
                </PopoverTrigger>
                <PopoverContent className="p-0 w-auto" align="start" side="top">
                  <StickersPanel
                    onPick={s =>
                      doSend("sticker", {
                        content: s,
                        mediaUrl: undefined,
                        mediaMeta: JSON.stringify({ sticker: s }),
                      })
                    }
                  />
                </PopoverContent>
              </Popover>
              {/* GIF */}
              <Popover
                open={gifOpen}
                onOpenChange={o => {
                  setGifOpen(o);
                  if (o) searchGifs("");
                }}
              >
                <PopoverTrigger asChild>
                  <button
                    className="p-2.5 rounded-full hover:bg-accent text-muted-foreground"
                    aria-label="GIF"
                  >
                    <span className="text-[10px] font-bold border rounded px-1">
                      GIF
                    </span>
                  </button>
                </PopoverTrigger>
                <PopoverContent
                  className="w-80 max-w-[calc(100vw-24px)] max-h-[65dvh] overflow-y-auto"
                  align="start"
                  side="top"
                >
                  <>
                    <input
                      className="w-full rounded-md border px-3 py-1.5 text-sm mb-2 bg-background"
                      placeholder="Search GIFs"
                      value={gifQuery}
                      onChange={e => {
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
                        {gifs.map(g => (
                          <button
                            key={g.id}
                            disabled={uploading}
                            onClick={async () => {
                              setUploading(true);
                              setError("");
                              try {
                                const response = await fetch(g.url, {
                                  signal: AbortSignal.timeout(15000),
                                });
                                if (!response.ok)
                                  throw new Error(
                                    "GIF could not be loaded. Try a different GIF."
                                  );
                                const blob = await response.blob();
                                if (blob.size > 15 * 1024 * 1024)
                                  throw new Error(
                                    "GIF exceeds the 15 MB limit."
                                  );
                                setPendingFiles([
                                  new File([blob], `${g.id}.gif`, {
                                    type: "image/gif",
                                  }),
                                ]);
                                setGifOpen(false);
                              } catch (e) {
                                setError(
                                  e instanceof Error
                                    ? e.message
                                    : "GIF failed to load"
                                );
                              } finally {
                                setUploading(false);
                              }
                            }}
                          >
                            <img
                              src={g.url}
                              alt="GIF"
                              className="rounded w-full h-20 object-cover"
                              loading="lazy"
                            />
                          </button>
                        ))}
                        {gifs.length === 0 && (
                          <p className="col-span-3 p-3 text-sm">
                            No GIFs found. Try another word or attach a GIF from
                            your device.
                          </p>
                        )}
                      </div>
                    )}
                  </>
                  <p className="text-xs text-muted-foreground mt-2">
                    {GIPHY_KEY
                      ? "Powered by GIPHY"
                      : "Quick Chat GIFs · Search Hello, LOL, Thanks, Wow, Yes or No"}
                  </p>
                </PopoverContent>
              </Popover>
            </div>
          </PopoverContent>
        </Popover>

        {/* Attachments */}
        <Popover open={attachOpen} onOpenChange={setAttachOpen}>
          <PopoverTrigger asChild>
            <button
              className="p-2.5 rounded-full hover:bg-accent text-muted-foreground"
              aria-label="Attach"
            >
              <Paperclip className="h-5 w-5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-1" align="start" side="top">
            <button
              className="menu-item"
              onClick={() => {
                acceptRef.current = "image/*,video/*";
                fileInputRef.current?.setAttribute("accept", acceptRef.current);
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
                fileInputRef.current?.setAttribute("accept", acceptRef.current);
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
                acceptRef.current =
                  ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,application/*";
                fileInputRef.current?.setAttribute("accept", acceptRef.current);
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
                {contactList.slice(0, 5).map(c => (
                  <button
                    key={c.userId}
                    className="menu-item"
                    onClick={() => {
                      doSend("contact", {
                        mediaMeta: JSON.stringify({
                          name: c.name,
                          phone: c.phone,
                        }),
                      });
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
          onChange={e => {
            handleFiles(e.target.files);
            e.target.value = "";
            fileInputRef.current?.removeAttribute("capture");
          }}
        />

        <textarea
          value={text}
          onChange={e => {
            setText(e.target.value);
            if (Date.now() - typingThrottle.current > 2500) {
              typingThrottle.current = Date.now();
              onTyping();
            }
          }}
          onKeyDown={e => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              submitText();
            }
          }}
          placeholder="Type a message"
          rows={1}
          aria-label="Message input"
          className="flex-1 min-w-0 min-h-12 resize-none rounded-2xl border bg-background px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-sky-500 max-h-32"
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
          <HoldVoice
            disabled={uploading || send.isPending}
            onSend={async file => {
              const res = await upload.mutateAsync({
                name: file.name,
                contentBase64: await fileToBase64(file),
                contentType: file.type,
              });
              await send.mutateAsync({
                conversationId,
                type: "audio",
                mediaUrl: res.key,
                mediaMeta: JSON.stringify({
                  name: file.name,
                  size: file.size,
                  mime: file.type,
                }),
                replyToId: replyToId ?? undefined,
              });
            }}
          />
        )}
      </div>
    </div>
  );
}
