import { ContactProfile } from "./ContactProfile";
import { useState } from "react";
import { trpc } from "@/providers/trpc";
import type { Me } from "@/lib/auth";
import { Avatar, Logo } from "@/components/Logo";
import { expiryCountdown, formatDay, isOnline } from "@/lib/format";
import { NewChatDialog } from "@/components/chat/NewChatDialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Archive, Pin, Plus, Search, Timer } from "lucide-react";

export function ChatList({
  me,
  activeId,
  onOpen,
}: {
  me: Me;
  activeId: number | null;
  onOpen: (id: number) => void;
}) {
  const [profile, setProfile] = useState<number | null>(null);
  const [favorites, setFavorites] = useState(false);
  const [query, setQuery] = useState("");
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const listQuery = trpc.conversations.list.useQuery(undefined, {
    refetchInterval: 4000,
  });
  const convs = listQuery.data ?? [];

  const filtered = convs
    .filter(c => !favorites || c.favorite)
    .filter(c => (showArchived ? c.archived : !c.archived))
    .filter(c => c.title.toLowerCase().includes(query.toLowerCase()));

  return (
    <div className="flex flex-col h-full min-h-0">
      {profile && (
        <ContactProfile
          quick
          conversationId={profile}
          onClose={() => setProfile(null)}
          onMessage={() => {
            onOpen(profile);
            setProfile(null);
          }}
        />
      )}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Logo size={28} />
          <h1 className="text-lg font-bold text-sky-600 dark:text-sky-400">
            {showArchived ? "Archived" : "Chats"}
          </h1>
        </div>
        <button
          aria-label="New chat"
          onClick={() => setNewChatOpen(true)}
          className="p-2 rounded-full bg-sky-500 text-white hover:bg-sky-600 transition-colors"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search chats"
            className="pl-9 bg-muted/60 border-0"
            aria-label="Search chats"
          />
        </div>
      </div>
      <button
        className="mx-4 mb-2 text-sm text-sky-500 text-left"
        onClick={() => setFavorites(!favorites)}
      >
        {favorites ? "Show all chats" : "Favorites"}
      </button>
      {!showArchived && convs.some(c => c.archived) && (
        <button
          className="mx-4 mb-1 flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground px-2 py-1"
          onClick={() => setShowArchived(true)}
        >
          <Archive className="h-3.5 w-3.5" /> Archived chats
        </button>
      )}
      {showArchived && (
        <button
          className="mx-4 mb-1 text-xs text-sky-600 hover:underline px-2 py-1 text-left"
          onClick={() => setShowArchived(false)}
        >
          ← Back to chats
        </button>
      )}

      <div
        className="flex-1 overflow-y-auto min-h-0"
        role="list"
        aria-label="Conversations"
      >
        {listQuery.isLoading &&
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-1/2" />
                <Skeleton className="h-3 w-3/4" />
              </div>
            </div>
          ))}
        {!listQuery.isLoading && filtered.length === 0 && (
          <div className="flex flex-col items-center justify-center h-2/3 text-center px-6">
            <Logo size={48} />
            <p className="mt-3 text-sm text-muted-foreground">
              {query
                ? "No chats match your search."
                : "No conversations yet. Start a new chat!"}
            </p>
          </div>
        )}
        {filtered.map(c => {
          const countdown = expiryCountdown(c.expiresAt);
          const other = c.otherUser;
          const online = other?.lastSeenAt ? isOnline(other.lastSeenAt) : false;
          return (
            <button
              key={c.id}
              role="listitem"
              onClick={() => onOpen(c.id)}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 ${
                activeId === c.id ? "bg-accent" : ""
              }`}
            >
              <span
                role="button"
                tabIndex={0}
                aria-label={`Open ${c.title} profile`}
                onClick={e => {
                  e.stopPropagation();
                  setProfile(c.id);
                }}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    e.stopPropagation();
                    setProfile(c.id);
                  }
                }}
              >
                <Avatar
                  name={c.title}
                  url={c.avatarUrl}
                  size={46}
                  online={c.type === "direct" ? online : undefined}
                />
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium truncate flex items-center gap-1">
                    {c.pinned && (
                      <Pin className="h-3 w-3 text-sky-500 shrink-0" />
                    )}
                    {c.title}
                    {c.type === "group" && (
                      <span className="text-[10px] font-normal text-muted-foreground border rounded px-1">
                        Group
                      </span>
                    )}
                  </span>
                  {c.lastMessage && (
                    <span className="text-[11px] text-muted-foreground shrink-0">
                      {formatDay(c.lastMessage.createdAt)}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-between gap-2 mt-0.5">
                  <span className="text-sm text-muted-foreground truncate">
                    {c.expired
                      ? "This chat has expired"
                      : c.lastMessage
                        ? c.lastMessage.type === "text"
                          ? c.lastMessage.content
                          : `📎 ${c.lastMessage.type}`
                        : "No messages yet"}
                  </span>
                  <span className="flex items-center gap-1.5 shrink-0">
                    {!c.expired && countdown && (
                      <span
                        className="text-[10px] text-sky-600 dark:text-sky-400 flex items-center gap-0.5"
                        title={countdown}
                      >
                        <Timer className="h-3 w-3" />
                      </span>
                    )}
                    {c.unread > 0 && !c.expired && (
                      <span className="bg-sky-500 text-white text-[11px] rounded-full min-w-5 h-5 px-1 flex items-center justify-center">
                        {c.unread}
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-4 py-2 border-t text-[11px] text-muted-foreground">
        Signed in as {me.name} · {me.phone}
      </div>
      <NewChatDialog
        open={newChatOpen}
        onClose={() => setNewChatOpen(false)}
        onOpen={onOpen}
      />
    </div>
  );
}
