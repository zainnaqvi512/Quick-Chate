import { useEffect, useMemo, useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import type { Me } from "@/lib/auth";
import { Avatar } from "@/components/Logo";
import { expiryCountdown, formatLastSeen, isOnline } from "@/lib/format";
import { MessageBubble, type ChatMessage } from "./MessageBubble";
import { Composer } from "./Composer";
import { useCall } from "@/components/call/CallManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Archive,
  BellOff,
  Eraser,
  Forward,
  Loader2,
  MoreVertical,
  Phone,
  Pin,
  ShieldBan,
  TimerOff,
  Video,
  X,
} from "lucide-react";

export function ChatWindow({
  me,
  conversationId,
  onClose,
}: {
  me: Me;
  conversationId: number;
  onClose: () => void;
}) {
  const utils = trpc.useUtils();
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const lastCountRef = useRef(0);

  const convQuery = trpc.conversations.get.useQuery({ id: conversationId }, { refetchInterval: 5000 });
  const msgsQuery = trpc.messages.list.useQuery(
    { conversationId },
    { refetchInterval: 2500 },
  );
  const typingQuery = trpc.conversations.typingList.useQuery(
    { id: conversationId },
    { refetchInterval: 3000 },
  );
  const contactsQuery = trpc.contacts.list.useQuery();
  const convListQuery = trpc.conversations.list.useQuery(undefined, { enabled: forwardMsg !== null });

  const conv = convQuery.data;
  const expired = msgsQuery.data?.expired ?? false;
  const expiresAt = msgsQuery.data?.expiresAt ?? conv?.myExpiresAt ?? null;
  const messages = (msgsQuery.data?.messages ?? []) as ChatMessage[];

  const react = trpc.messages.react.useMutation({
    onSuccess: () => utils.messages.list.invalidate({ conversationId }),
  });
  const star = trpc.messages.star.useMutation({
    onSuccess: () => utils.messages.list.invalidate({ conversationId }),
  });
  const del = trpc.messages.deleteForEveryone.useMutation({
    onSuccess: () => utils.messages.list.invalidate({ conversationId }),
  });
  const typing = trpc.conversations.typing.useMutation();
  const setFlags = trpc.conversations.setFlags.useMutation({
    onSuccess: () => {
      utils.conversations.list.invalidate();
      convQuery.refetch();
    },
  });
  const clear = trpc.conversations.clear.useMutation({
    onSuccess: () => utils.messages.list.invalidate({ conversationId }),
  });
  const block = trpc.users.block.useMutation();
  const forward = trpc.messages.send.useMutation({
    onSuccess: () => utils.conversations.list.invalidate(),
  });

  // scroll to bottom on new messages
  useEffect(() => {
    if (messages.length !== lastCountRef.current) {
      lastCountRef.current = messages.length;
      bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    }
  }, [messages.length]);

  const countdown = expiryCountdown(expiresAt);
  const online = conv?.otherUser?.lastSeenAt ? isOnline(conv.otherUser.lastSeenAt) : false;
  const typingUsers = typingQuery.data ?? [];

  const statusLine = useMemo(() => {
    if (typingUsers.length > 0) return `${typingUsers.map((t) => t.name).join(", ")} typing…`;
    if (conv?.type === "group") return `${conv.participants.length} participants`;
    if (online) return "online";
    if (conv?.otherUser?.lastSeenAt) return formatLastSeen(conv.otherUser.lastSeenAt);
    return "offline";
  }, [typingUsers, conv, online]);

  const call = useCall();

  if (convQuery.isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
      </div>
    );
  }
  if (!conv) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-2">
        <p className="text-muted-foreground">Conversation not found</p>
        <Button variant="outline" onClick={onClose}>
          Back
        </Button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* Header */}
      <header className="flex items-center gap-2 sm:gap-3 px-2 sm:px-4 py-2.5 border-b bg-card">
        <button className="md:hidden p-2 -ml-1" onClick={onClose} aria-label="Back to chats">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Avatar name={conv.title} url={conv.avatarUrl} size={40} />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold truncate leading-tight">{conv.title}</h2>
          <p className={`text-xs truncate ${typingUsers.length ? "text-sky-500" : "text-muted-foreground"}`}>
            {statusLine}
          </p>
        </div>
        {!expired && countdown && (
          <span
            className="hidden sm:flex items-center gap-1 text-[11px] font-medium text-sky-700 dark:text-sky-300 bg-sky-100 dark:bg-sky-950 rounded-full px-2.5 py-1"
            title="Your access window"
          >
            <TimerOff className="h-3.5 w-3.5" />
            {countdown}
          </span>
        )}
        {conv.type === "direct" && conv.otherUser && !expired && (
          <>
            <button
              aria-label="Voice call"
              className="p-2 rounded-full hover:bg-accent text-sky-600 dark:text-sky-400"
              onClick={() =>
                call.startCall(
                  { id: conv.otherUser!.id, name: conv.title, avatarUrl: conv.avatarUrl ?? null },
                  "voice",
                  conversationId,
                )
              }
            >
              <Phone className="h-5 w-5" />
            </button>
            <button
              aria-label="Video call"
              className="p-2 rounded-full hover:bg-accent text-sky-600 dark:text-sky-400"
              onClick={() =>
                call.startCall(
                  { id: conv.otherUser!.id, name: conv.title, avatarUrl: conv.avatarUrl ?? null },
                  "video",
                  conversationId,
                )
              }
            >
              <Video className="h-5 w-5" />
            </button>
          </>
        )}
        <div className="relative">
          <button
            aria-label="Conversation menu"
            className="p-2 rounded-full hover:bg-accent"
            onClick={() => setMenuOpen((o) => !o)}
          >
            <MoreVertical className="h-5 w-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-11 z-30 w-52 bg-popover border rounded-xl shadow-lg p-1">
              <button
                className="menu-item"
                onClick={() => {
                  setFlags.mutate({ id: conversationId, pinned: !conv.pinned });
                  setMenuOpen(false);
                }}
              >
                <Pin className="h-4 w-4" /> {conv.pinned ? "Unpin chat" : "Pin chat"}
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  setFlags.mutate({ id: conversationId, archived: !conv.archived });
                  setMenuOpen(false);
                }}
              >
                <Archive className="h-4 w-4" /> {conv.archived ? "Unarchive" : "Archive"}
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  setFlags.mutate({ id: conversationId, muted: !conv.muted });
                  setMenuOpen(false);
                }}
              >
                <BellOff className="h-4 w-4" /> {conv.muted ? "Unmute" : "Mute notifications"}
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  if (confirm("Clear all messages in this chat for you?")) clear.mutate({ id: conversationId });
                  setMenuOpen(false);
                }}
              >
                <Eraser className="h-4 w-4" /> Clear chat
              </button>
              {conv.type === "direct" && conv.otherUser && (
                <button
                  className="menu-item text-destructive"
                  onClick={() => {
                    if (confirm(`Block ${conv.title}? They won't be able to message you.`))
                      block.mutate({ userId: conv.otherUser!.id });
                    setMenuOpen(false);
                  }}
                >
                  <ShieldBan className="h-4 w-4" /> Block {conv.title}
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Countdown strip (mobile) */}
      {!expired && countdown && (
        <div className="sm:hidden text-center text-[11px] py-1 bg-sky-100 dark:bg-sky-950 text-sky-700 dark:text-sky-300 flex items-center justify-center gap-1">
          <TimerOff className="h-3 w-3" /> {countdown}
        </div>
      )}

      {/* Messages */}
      {expired ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 chat-bg p-8 text-center">
          <TimerOff className="h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">This chat has expired.</h3>
          <p className="text-sm text-muted-foreground max-w-xs">
            Quick Chat conversations are available for 12 hours after being read. Messages and media in this
            conversation are no longer accessible.
          </p>
          <Button variant="outline" onClick={onClose}>
            Back to chats
          </Button>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto py-3 chat-bg min-h-0" aria-live="polite">
          {msgsQuery.isLoading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-sky-500" />
            </div>
          )}
          {!msgsQuery.isLoading && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center px-8">
              <p className="text-sm text-muted-foreground max-w-xs">
                No messages yet. Say hello! 👋
                <br />
                <span className="text-xs">The 12-hour timer starts when this chat is first read.</span>
              </p>
            </div>
          )}
          {messages.map((m) => (
            <MessageBubble
              key={m.id}
              msg={m}
              isGroup={conv.type === "group"}
              onReply={(msg) => setReplyTo(msg)}
              onReact={(msg, emoji) => react.mutate({ messageId: msg.id, emoji })}
              onStar={(msg) => star.mutate({ messageId: msg.id, starred: !msg.starred })}
              onDelete={(msg) => {
                if (confirm("Delete this message for everyone?")) del.mutate({ messageId: msg.id });
              }}
              onForward={(msg) => setForwardMsg(msg)}
            />
          ))}
          <div ref={bottomRef} />
        </div>
      )}

      {/* Reply preview */}
      {replyTo && !expired && (
        <div className="flex items-center gap-2 px-4 py-2 border-t bg-card">
          <div className="flex-1 border-l-2 border-sky-500 pl-2 min-w-0">
            <p className="text-xs font-medium text-sky-600 dark:text-sky-400">{replyTo.sender.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {replyTo.type === "text" ? replyTo.content : `📎 ${replyTo.type}`}
            </p>
          </div>
          <button aria-label="Cancel reply" onClick={() => setReplyTo(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Composer */}
      {!expired && (
        <ComposerWithReply
          me={me}
          conversationId={conversationId}
          replyTo={replyTo}
          onReplyDone={() => setReplyTo(null)}
          onTyping={() => typing.mutate({ id: conversationId })}
          contacts={(contactsQuery.data ?? []).map((c) => ({
            userId: c.user.id,
            name: c.alias || c.user.name,
            phone: c.user.phone,
          }))}
        />
      )}

      {/* Forward dialog */}
      <Dialog open={forwardMsg !== null} onOpenChange={(o) => !o && setForwardMsg(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Forward className="h-4 w-4" /> Forward to
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-72 overflow-y-auto space-y-1">
            {(convListQuery.data ?? [])
              .filter((c) => !c.expired && c.id !== conversationId)
              .map((c) => (
                <button
                  key={c.id}
                  className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-left"
                  onClick={() => {
                    if (!forwardMsg) return;
                    forward.mutate({
                      conversationId: c.id,
                      type: forwardMsg.type as any,
                      content: forwardMsg.content ?? undefined,
                      mediaUrl: forwardMsg.mediaUrl ?? undefined,
                      mediaMeta: forwardMsg.mediaMeta ?? undefined,
                    });
                    setForwardMsg(null);
                  }}
                >
                  <Avatar name={c.title} url={c.avatarUrl} size={36} />
                  <span className="truncate font-medium">{c.title}</span>
                </button>
              ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Composer wrapper that attaches the current replyTo to sent messages. */
function ComposerWithReply({
  conversationId,
  replyTo,
  onReplyDone,
  onTyping,
  contacts,
}: {
  me: Me;
  conversationId: number;
  replyTo: ChatMessage | null;
  onReplyDone: () => void;
  onTyping: () => void;
  contacts: { userId: number; name: string; phone: string }[];
}) {
  return (
    <Composer
      conversationId={conversationId}
      onTyping={onTyping}
      contacts={contacts}
      replyToId={replyTo?.id ?? null}
      onSent={onReplyDone}
    />
  );
}
