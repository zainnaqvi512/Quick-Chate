import { useState } from "react";
import { formatTime } from "@/lib/format";
import { MediaContent } from "./MediaContent";
import { QUICK_REACTIONS } from "./reactions";
import { Check, CheckCheck, Copy, CornerUpLeft, Forward, SmilePlus, Star, Trash2 } from "lucide-react";

export type ChatMessage = {
  id: number;
  conversationId: number;
  senderId: number;
  sender: { id: number; name: string; avatarUrl: string | null };
  type: string;
  content: string | null;
  mediaUrl: string | null;
  mediaMeta: string | null;
  replyTo: { id: number; content: string | null; type: string; senderId: number } | null;
  deletedForEveryone: boolean;
  createdAt: Date | string;
  mine: boolean;
  status?: "sent" | "delivered" | "read";
  starred: boolean;
  reactions: { emoji: string; userId: number }[];
};

/** Original Quick Chat read-receipt icon (single/double wing ticks). */
export function Ticks({ status }: { status?: "sent" | "delivered" | "read" }) {
  if (status === "read") return <CheckCheck className="h-3.5 w-3.5 text-sky-500" aria-label="Read" />;
  if (status === "delivered") return <CheckCheck className="h-3.5 w-3.5 opacity-60" aria-label="Delivered" />;
  return <Check className="h-3.5 w-3.5 opacity-60" aria-label="Sent" />;
}

export function MessageBubble({
  msg,
  isGroup,
  onReply,
  onReact,
  onStar,
  onDelete,
  onForward,
}: {
  msg: ChatMessage;
  isGroup: boolean;
  onReply: (m: ChatMessage) => void;
  onReact: (m: ChatMessage, emoji: string) => void;
  onStar: (m: ChatMessage) => void;
  onDelete: (m: ChatMessage) => void;
  onForward: (m: ChatMessage) => void;
}) {
  const [actionsOpen, setActionsOpen] = useState(false);
  const [reactionsOpen, setReactionsOpen] = useState(false);

  const reactionGroups = msg.reactions.reduce<Record<string, number>>((acc, r) => {
    acc[r.emoji] = (acc[r.emoji] || 0) + 1;
    return acc;
  }, {});

  return (
    <div
      className={`group flex ${msg.mine ? "justify-end" : "justify-start"} px-3 sm:px-6 py-0.5 relative`}
      onMouseLeave={() => {
        setActionsOpen(false);
        setReactionsOpen(false);
      }}
    >
      <div className={`relative max-w-[78%] sm:max-w-[65%] ${msg.mine ? "items-end" : "items-start"}`}>
        {/* action bar on hover */}
        <div
          className={`absolute top-0 ${msg.mine ? "-left-8" : "-right-8"} opacity-0 group-hover:opacity-100 transition-opacity z-10`}
        >
          <button
            aria-label="Message actions"
            className="p-1.5 rounded-full bg-card border shadow-sm text-muted-foreground hover:text-foreground"
            onClick={() => setActionsOpen((o) => !o)}
          >
            <SmilePlus className="h-4 w-4" />
          </button>
          {actionsOpen && (
            <div className="absolute top-9 left-0 bg-popover border rounded-xl shadow-lg p-1 w-40 z-20">
              <button className="menu-item" onClick={() => setReactionsOpen(true)}>
                <SmilePlus className="h-4 w-4" /> React
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  onReply(msg);
                  setActionsOpen(false);
                }}
              >
                <CornerUpLeft className="h-4 w-4" /> Reply
              </button>
              {msg.type === "text" && (
                <button
                  className="menu-item"
                  onClick={() => {
                    navigator.clipboard.writeText(msg.content || "");
                    setActionsOpen(false);
                  }}
                >
                  <Copy className="h-4 w-4" /> Copy
                </button>
              )}
              <button
                className="menu-item"
                onClick={() => {
                  onForward(msg);
                  setActionsOpen(false);
                }}
              >
                <Forward className="h-4 w-4" /> Forward
              </button>
              <button
                className="menu-item"
                onClick={() => {
                  onStar(msg);
                  setActionsOpen(false);
                }}
              >
                <Star className={`h-4 w-4 ${msg.starred ? "fill-amber-400 text-amber-400" : ""}`} />{" "}
                {msg.starred ? "Unstar" : "Star"}
              </button>
              {msg.mine && (
                <button
                  className="menu-item text-destructive"
                  onClick={() => {
                    onDelete(msg);
                    setActionsOpen(false);
                  }}
                >
                  <Trash2 className="h-4 w-4" /> Delete
                </button>
              )}
            </div>
          )}
          {reactionsOpen && (
            <div className="absolute top-9 left-0 bg-popover border rounded-full shadow-lg px-2 py-1 flex gap-1 z-20">
              {QUICK_REACTIONS.map((e) => (
                <button
                  key={e}
                  className="text-lg hover:scale-125 transition-transform"
                  onClick={() => {
                    onReact(msg, e);
                    setReactionsOpen(false);
                    setActionsOpen(false);
                  }}
                >
                  {e}
                </button>
              ))}
            </div>
          )}
        </div>

        <div
          className={`rounded-2xl px-3 py-2 shadow-sm ${
            msg.mine
              ? "bg-sky-500 text-white rounded-br-md"
              : "bg-card border rounded-bl-md"
          } ${msg.type === "sticker" ? "!bg-transparent !shadow-none !border-0 !px-1" : ""}`}
        >
          {isGroup && !msg.mine && (
            <p className="text-xs font-semibold text-sky-600 dark:text-sky-400 mb-0.5">{msg.sender.name}</p>
          )}
          {msg.replyTo && (
            <div
              className={`text-xs rounded-lg px-2 py-1 mb-1 border-l-2 ${
                msg.mine ? "bg-white/15 border-white/50" : "bg-muted border-sky-400"
              }`}
            >
              <span className="opacity-70">
                {msg.replyTo.type === "text" ? msg.replyTo.content : `📎 ${msg.replyTo.type}`}
              </span>
            </div>
          )}
          {msg.deletedForEveryone ? (
            <p className="text-sm italic opacity-70">🚫 This message was deleted</p>
          ) : (
            <MediaContent type={msg.type} mediaUrl={msg.mediaUrl} mediaMeta={msg.mediaMeta} content={msg.type === "text" ? msg.content : msg.content} />
          )}
          <div className={`flex items-center justify-end gap-1 mt-0.5 ${msg.type === "sticker" ? "bg-card/70 rounded-full px-1.5" : ""}`}>
            {msg.starred && <Star className="h-3 w-3 fill-amber-400 text-amber-400" />}
            <span className={`text-[10px] ${msg.mine ? "text-white/80" : "text-muted-foreground"}`}>
              {formatTime(msg.createdAt)}
            </span>
            {msg.mine && <Ticks status={msg.status} />}
          </div>
        </div>

        {Object.keys(reactionGroups).length > 0 && (
          <div className={`flex gap-1 mt-1 ${msg.mine ? "justify-end" : "justify-start"}`}>
            {Object.entries(reactionGroups).map(([emoji, count]) => (
              <span key={emoji} className="bg-card border rounded-full px-1.5 py-0.5 text-xs shadow-sm">
                {emoji}
                {count > 1 ? ` ${count}` : ""}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
