import { useState } from "react";
import { NewChatDialog } from "./chat/NewChatDialog";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Logo";
import { formatDuration, formatDay } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Video,
} from "lucide-react";

export function CallsPage({
  onOpenChat,
}: {
  onOpenChat: (id: number) => void;
}) {
  const [picker, setPicker] = useState(false);
  const historyQuery = trpc.calls.history.useQuery(undefined, {
    refetchInterval: 8000,
  });
  const createDirect = trpc.conversations.createDirect.useMutation({
    onSuccess: r => onOpenChat(r.id),
  });
  const items = historyQuery.data ?? [];

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-sky-600 dark:text-sky-400">
            Calls
          </h1>
          <button
            aria-label="New call"
            className="p-3 rounded-full text-sky-600 hover:bg-accent"
            onClick={() => setPicker(true)}
          >
            <Phone />
          </button>
        </div>
        <p className="text-xs text-muted-foreground">
          Call history is kept separately from expiring chats.
        </p>
      </header>
      <NewChatDialog
        open={picker}
        onClose={() => setPicker(false)}
        onOpen={onOpenChat}
        mode="call"
      />
      <div
        className="flex-1 overflow-y-auto min-h-0"
        role="list"
        aria-label="Call history"
      >
        {historyQuery.isLoading &&
          [1, 2, 3].map(i => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        {!historyQuery.isLoading && items.length === 0 && (
          <p className="text-sm text-muted-foreground text-center pt-16 px-8">
            No calls yet. Tap New call to choose a contact.
          </p>
        )}
        {items.map(c => {
          const missed = c.status === "missed" || c.status === "rejected";
          const Icon =
            c.direction === "outgoing"
              ? PhoneOutgoing
              : missed
                ? PhoneMissed
                : PhoneIncoming;
          return (
            <div
              key={c.id}
              role="listitem"
              className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60"
            >
              <Avatar
                name={c.otherUser?.name || "?"}
                url={c.otherUser?.avatarUrl}
                size={44}
              />
              <div className="flex-1 min-w-0">
                <p
                  className={`font-medium truncate ${missed ? "text-red-500" : ""}`}
                >
                  {c.otherUser?.name || "Unknown"}
                </p>
                <p className="text-xs text-muted-foreground flex items-center gap-1">
                  <Icon
                    className={`h-3.5 w-3.5 ${missed ? "text-red-500" : "text-sky-500"}`}
                  />
                  {c.type === "video" ? (
                    <Video className="h-3.5 w-3.5" />
                  ) : (
                    <Phone className="h-3.5 w-3.5" />
                  )}
                  {formatDay(c.createdAt)}
                  {c.durationSec > 0 && ` · ${formatDuration(c.durationSec)}`}
                  {missed && " · Missed"}
                </p>
              </div>
              {c.otherUser && (
                <button
                  className="p-2 rounded-full hover:bg-accent text-sky-600 dark:text-sky-400"
                  aria-label="Open chat"
                  onClick={() =>
                    createDirect.mutate({ userId: c.otherUser!.id })
                  }
                >
                  {c.type === "video" ? (
                    <Video className="h-5 w-5" />
                  ) : (
                    <Phone className="h-5 w-5" />
                  )}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
