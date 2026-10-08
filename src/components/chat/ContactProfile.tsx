import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Logo";
import { useCall } from "@/components/call/context";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePrivateMedia } from "@/lib/media";
import { MediaContent } from "./MediaContent";
import { toast } from "sonner";
import { Phone, Video, MessageCircle, Heart, Info } from "lucide-react";
export function ContactProfile({
  conversationId,
  onClose,
  onMessage,
  quick = false,
}: {
  conversationId: number;
  onClose: () => void;
  onMessage: () => void;
  quick?: boolean;
}) {
  const [details, setDetails] = useState(!quick),
    [photo, setPhoto] = useState(false),
    [media, setMedia] = useState(false),
    [reason, setReason] = useState(""),
    [reporting, setReporting] = useState(false);
  const q = trpc.conversations.get.useQuery({ id: conversationId });
  const c = q.data;
  const u = c?.otherUser;
  const items = trpc.messages.list.useQuery(
    { conversationId },
    { enabled: media, refetchInterval: 3000 }
  );
  const utils = trpc.useUtils(),
    call = useCall();
  const avatar = usePrivateMedia(c?.avatarUrl);
  const flags = trpc.conversations.setFlags.useMutation({
    onSuccess: () => {
      q.refetch();
      utils.conversations.list.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const timer = trpc.conversations.setExpiration.useMutation({
    onSuccess: () => {
      q.refetch();
      utils.conversations.get.invalidate();
    },
    onError: e => toast.error(e.message),
  });
  const clear = trpc.conversations.clear.useMutation({
    onSuccess: () => {
      utils.messages.invalidate();
      utils.conversations.invalidate();
      toast.success("Chat cleared for you.");
    },
    onError: e => toast.error(e.message),
  });
  const block = trpc.users.block.useMutation({
    onSuccess: () => toast.success("User blocked."),
    onError: e => toast.error(e.message),
  });
  const report = trpc.users.report.useMutation({
    onSuccess: () => {
      setReporting(false);
      setReason("");
      toast.success("Report saved. Review is not guaranteed in this preview.");
    },
    onError: e => toast.error(e.message),
  });
  const controls = (
    <div className="flex justify-center gap-5 py-4">
      <Button variant="outline" aria-label="Message" onClick={onMessage}>
        <MessageCircle />
      </Button>
      {u && (
        <>
          <Button
            variant="outline"
            aria-label="Voice call"
            onClick={() => {
              call.startCall(
                { id: u.id, name: c!.title, avatarUrl: c!.avatarUrl },
                "voice",
                conversationId
              );
              onClose();
            }}
          >
            <Phone />
          </Button>
          <Button
            variant="outline"
            aria-label="Video call"
            onClick={() => {
              call.startCall(
                { id: u.id, name: c!.title, avatarUrl: c!.avatarUrl },
                "video",
                conversationId
              );
              onClose();
            }}
          >
            <Video />
          </Button>
        </>
      )}
      {!details && (
        <Button
          variant="outline"
          aria-label="Profile information"
          onClick={() => setDetails(true)}
        >
          <Info />
        </Button>
      )}
    </div>
  );
  return (
    <Dialog
      open
      onOpenChange={o => {
        if (!o) onClose();
      }}
    >
      <DialogContent className="max-w-md max-h-[92dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{c?.title || "Contact profile"}</DialogTitle>
        </DialogHeader>
        {q.isLoading ? (
          <p>Loading profile…</p>
        ) : q.error ? (
          <p role="alert">{q.error.message}</p>
        ) : (
          c && (
            <>
              <button
                className="mx-auto block"
                aria-label="Open profile photo"
                onClick={() => setPhoto(!photo)}
              >
                {photo && avatar.url ? (
                  <img
                    src={avatar.url}
                    alt={c.title}
                    className="max-h-[60dvh] w-full object-contain"
                  />
                ) : (
                  <Avatar
                    name={c.title}
                    url={c.avatarUrl}
                    size={details ? 120 : 220}
                  />
                )}
              </button>
              <div className="text-center">
                <h2 className="text-2xl font-semibold">{c.title}</h2>
                {details && (
                  <>
                    <p className="text-muted-foreground">{u?.phone}</p>
                    <p className="text-sky-500">
                      {u?.username ? `@${u.username}` : ""}
                    </p>
                    <p className="mt-3 whitespace-pre-wrap">
                      {u?.about || c.description}
                    </p>
                  </>
                )}
              </div>
              {controls}
              {details && (
                <div className="space-y-4 border-t pt-4">
                  <button
                    className="w-full text-left"
                    onClick={() => setMedia(!media)}
                  >
                    Media and documents <span className="float-right">›</span>
                  </button>
                  {media && (
                    <div className="space-y-3 max-h-64 overflow-auto">
                      <p className="text-xs text-muted-foreground">
                        Attachments in the latest 50 accessible messages.
                        Expired and view-once media are excluded.
                      </p>
                      {(items.data?.messages ?? [])
                        .filter(
                          m =>
                            m.mediaUrl &&
                            !["after_view", "after_chat"].includes(
                              m.expirationMode
                            )
                        )
                        .map(m => (
                          <div className="border rounded-lg p-2" key={m.id}>
                            <MediaContent
                              type={m.type}
                              mediaUrl={m.mediaUrl}
                              mediaMeta={m.mediaMeta}
                              content={m.content}
                            />
                          </div>
                        ))}
                    </div>
                  )}
                  <label className="flex justify-between">
                    Notifications
                    <input
                      type="checkbox"
                      checked={!c.muted}
                      disabled={flags.isPending}
                      onChange={() =>
                        flags.mutate({ id: conversationId, muted: !c.muted })
                      }
                    />
                  </label>
                  <label className="flex justify-between gap-2">
                    Disappearing messages
                    <select
                      aria-label="Disappearing messages"
                      value={c.expirationMode}
                      disabled={
                        timer.isPending ||
                        (c.type === "group" && c.myRole === "member")
                      }
                      onChange={e =>
                        timer.mutate({
                          id: conversationId,
                          mode: e.target.value as
                            "24h" | "12h" | "1h" | "after_chat" | "never",
                        })
                      }
                    >
                      <option value="24h">24 hours</option>
                      <option value="12h">12 hours</option>
                      <option value="1h">1 hour</option>
                      <option value="after_chat">View once · leave chat</option>
                      <option value="never">Never disappear</option>
                      {c.expirationMode === "after_view" && (
                        <option value="after_view">Legacy single-open</option>
                      )}
                    </select>
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Applies to new messages. Never-disappearing content remains
                    stored until deleted.
                  </p>
                  <div className="rounded-xl bg-muted p-3 text-sm">
                    <p className="font-medium">Encryption and chat lock</p>
                    <p>
                      This preview is not end-to-end encrypted. Secure chat lock
                      is not available yet; a visual PIN screen would not
                      protect server access.
                    </p>
                  </div>
                  <button
                    className="flex gap-3 items-center"
                    disabled={flags.isPending}
                    onClick={() =>
                      flags.mutate({
                        id: conversationId,
                        favorite: !c.favorite,
                      })
                    }
                  >
                    <Heart
                      className={c.favorite ? "fill-sky-500 text-sky-500" : ""}
                    />
                    {c.favorite ? "Remove from favorites" : "Add to favorites"}
                  </button>
                  <button
                    className="block text-destructive"
                    onClick={() => {
                      if (
                        confirm(
                          "Clear this chat for you? This cannot be undone."
                        )
                      )
                        clear.mutate({ id: conversationId });
                    }}
                  >
                    Clear chat
                  </button>
                  {u && (
                    <>
                      <button
                        className="block text-destructive"
                        onClick={() => {
                          if (confirm(`Block ${c.title}?`))
                            block.mutate({ userId: u.id });
                        }}
                      >
                        Block {c.title}
                      </button>
                      <button
                        className="block text-destructive"
                        onClick={() => setReporting(!reporting)}
                      >
                        Report {c.title}
                      </button>
                    </>
                  )}
                  {reporting && u && (
                    <div className="space-y-2">
                      <p className="text-xs">
                        Your reason and both account IDs will be stored for the
                        app owner. Chat contents are not attached. This preview
                        has no staffed moderation service.
                      </p>
                      <textarea
                        aria-label="Report reason"
                        className="w-full border rounded p-2 bg-background"
                        value={reason}
                        maxLength={1000}
                        onChange={e => setReason(e.target.value)}
                      />
                      <Button
                        disabled={reason.trim().length < 5 || report.isPending}
                        onClick={() => report.mutate({ userId: u.id, reason })}
                      >
                        Submit report
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </>
          )
        )}
      </DialogContent>
    </Dialog>
  );
}
