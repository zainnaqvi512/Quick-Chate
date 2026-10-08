import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Avatar } from "@/components/Logo";
import { usePrivateMedia } from "@/lib/media";
import { trpc } from "@/providers/trpc";
import { toast } from "sonner";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Pause,
  Play,
  Send,
} from "lucide-react";
import type { inferRouterOutputs } from "@trpc/server";
import type { AppRouter } from "../../api/router";
type Story = inferRouterOutputs<AppRouter>["status"]["list"][number];
export function StatusViewer({
  items,
  initialId,
  onClose,
}: {
  items: Story[];
  initialId: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(
    Math.max(
      0,
      items.findIndex(s => s.id === initialId)
    )
  );
  const s = items[index];
  return (
    <Dialog
      open
      onOpenChange={o => {
        if (!o) onClose();
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="max-w-none sm:max-w-2xl w-full h-dvh max-h-dvh border-0 rounded-none bg-slate-950 text-white p-0 gap-0 flex flex-col"
      >
        <DialogTitle className="sr-only">Status viewer</DialogTitle>
        {s && (
          <StorySlide
            key={s.id}
            story={s}
            index={index}
            count={items.length}
            onClose={onClose}
            onPrevious={() => setIndex(i => Math.max(0, i - 1))}
            onNext={() => {
              if (index + 1 < items.length) setIndex(index + 1);
              else onClose();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
function StorySlide({
  story: s,
  index,
  count,
  onClose,
  onPrevious,
  onNext,
}: {
  story: Story;
  index: number;
  count: number;
  onClose: () => void;
  onPrevious: () => void;
  onNext: () => void;
}) {
  const [paused, setPaused] = useState(false),
    [holding, setHolding] = useState(false),
    [progress, setProgress] = useState(0),
    [reply, setReply] = useState(""),
    [focused, setFocused] = useState(false),
    [ready, setReady] = useState(s.type === "text");
  const media = usePrivateMedia(s.mediaUrl),
    video = useRef<HTMLVideoElement>(null),
    advance = useRef(onNext);
  const stopped = paused || holding || focused;
  const view = trpc.status.view.useMutation(),
    direct = trpc.conversations.createDirect.useMutation(),
    send = trpc.messages.send.useMutation();
  const { mutate: markView } = view;
  useEffect(() => {
    advance.current = onNext;
  }, [onNext]);
  useEffect(() => {
    if (ready && !s.mine) markView({ id: s.id });
  }, [ready, s.id, s.mine, markView]);
  useEffect(() => {
    const t = setInterval(() => {
      if (new Date(s.expiresAt).getTime() <= Date.now()) {
        advance.current();
        return;
      }
      if (
        !stopped &&
        ready &&
        s.type !== "video" &&
        document.visibilityState === "visible"
      )
        setProgress(p => Math.min(100, p + 2));
    }, 100);
    return () => clearInterval(t);
  }, [stopped, ready, s.type, s.expiresAt]);
  useEffect(() => {
    if (progress >= 100) advance.current();
  }, [progress]);
  useEffect(() => {
    const v = video.current;
    if (!v) return;
    if (stopped) v.pause();
    else void v.play().catch(() => {});
  }, [stopped, media.url]);
  async function respond(content: string) {
    if (!content.trim() || send.isPending || direct.isPending) return;
    try {
      const c = await direct.mutateAsync({ userId: s.userId });
      await send.mutateAsync({
        conversationId: c.id,
        type: "text",
        content: `Reply to your status: ${content.trim()}`,
      });
      setReply("");
      toast.success("Reply sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reply failed");
    }
  }
  return (
    <>
      <div className="flex gap-1 px-3 pt-4">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="h-1 rounded bg-white/25 flex-1">
            <div
              className="h-full rounded bg-sky-400"
              style={{
                width: `${i < index ? 100 : i === index ? progress : 0}%`,
              }}
            />
          </div>
        ))}
      </div>
      <header className="flex gap-3 items-center p-4">
        <button aria-label="Close status" onClick={onClose}>
          <ArrowLeft />
        </button>
        <Avatar name={s.userName} url={s.userAvatar} size={40} />
        <div className="flex-1">
          <p>{s.mine ? "My status" : s.userName}</p>
          <p className="text-xs text-slate-400">
            {new Date(s.createdAt).toLocaleString()}
          </p>
        </div>
        <button
          aria-label={paused ? "Play status" : "Pause status"}
          onClick={() => setPaused(!paused)}
        >
          {paused ? <Play /> : <Pause />}
        </button>
      </header>
      <div
        className="flex-1 min-h-0 flex items-center justify-center relative select-none"
        onPointerDown={() => setHolding(true)}
        onPointerUp={() => setHolding(false)}
        onPointerCancel={() => setHolding(false)}
        onPointerLeave={() => setHolding(false)}
      >
        {s.type === "text" ? (
          <div
            className="w-full h-full flex items-center justify-center text-center p-10 text-3xl break-words whitespace-pre-wrap"
            style={{ backgroundColor: s.bgColor || "#0284c7" }}
          >
            {s.content}
          </div>
        ) : media.url ? (
          s.type === "video" ? (
            <video
              ref={video}
              src={media.url}
              autoPlay
              playsInline
              controls
              className="max-h-full w-full object-contain"
              onLoadedData={() => setReady(true)}
              onEnded={onNext}
              onTimeUpdate={e => {
                const v = e.currentTarget;
                setProgress(
                  v.duration ? (100 * v.currentTime) / v.duration : 0
                );
              }}
            />
          ) : (
            <img
              src={media.url}
              alt="Status"
              className="max-h-full w-full object-contain"
              onLoad={() => setReady(true)}
            />
          )
        ) : (
          <p>
            {media.loading ? "Loading status…" : "Status media unavailable."}
          </p>
        )}
      </div>
      <div className="flex justify-between px-4 py-2">
        <button
          aria-label="Previous status"
          disabled={index === 0}
          onClick={onPrevious}
        >
          <ChevronLeft />
        </button>
        <span className="text-xs text-slate-400">
          {index + 1} / {count} · hold to pause
        </span>
        <button aria-label="Next status" onClick={onNext}>
          <ChevronRight />
        </button>
      </div>
      {s.type !== "text" && s.content && (
        <p className="px-5 pb-3 text-center whitespace-pre-wrap">{s.content}</p>
      )}
      {!s.mine && (
        <form
          className="p-4 flex gap-2"
          onSubmit={e => {
            e.preventDefault();
            void respond(reply);
          }}
        >
          <input
            aria-label="Reply to status"
            className="min-w-0 flex-1 bg-white/10 rounded-full px-4 py-3"
            placeholder="Reply…"
            value={reply}
            maxLength={1800}
            onChange={e => setReply(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
          <button
            type="button"
            aria-label="React with heart"
            disabled={send.isPending || direct.isPending}
            onClick={() => void respond("❤️")}
          >
            ❤️
          </button>
          <button
            aria-label="Send status reply"
            disabled={!reply.trim() || send.isPending || direct.isPending}
          >
            <Send />
          </button>
        </form>
      )}
    </>
  );
}
