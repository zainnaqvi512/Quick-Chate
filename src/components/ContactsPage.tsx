import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Logo";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, ShieldBan, Trash2, UserPlus } from "lucide-react";

export function ContactsPage({ onOpenChat }: { onOpenChat: (id: number) => void }) {
  const [query, setQuery] = useState("");
  const contactsQuery = trpc.contacts.list.useQuery(undefined, { refetchInterval: 10000 });
  const createDirect = trpc.conversations.createDirect.useMutation({
    onSuccess: (r) => onOpenChat(r.id),
  });
  const removeContact = trpc.contacts.remove.useMutation({
    onSuccess: () => contactsQuery.refetch(),
  });
  const block = trpc.users.block.useMutation();

  const contacts = (contactsQuery.data ?? []).filter((c) =>
    (c.alias || c.user.name || c.user.phone).toLowerCase().includes(query.toLowerCase()),
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-sky-600 dark:text-sky-400">Contacts</h1>
      </header>
      <div className="px-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts"
            className="pl-9 bg-muted/60 border-0"
            aria-label="Search contacts"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto min-h-0" role="list" aria-label="Contact list">
        {contactsQuery.isLoading &&
          [1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-3">
              <Skeleton className="h-11 w-11 rounded-full" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          ))}
        {!contactsQuery.isLoading && contacts.length === 0 && (
          <div className="text-center pt-16 px-8">
            <UserPlus className="h-8 w-8 mx-auto text-muted-foreground" />
            <p className="text-sm text-muted-foreground mt-2">
              No contacts yet. Use “New chat” and search by phone number to add people.
            </p>
          </div>
        )}
        {contacts.map((c) => (
          <div key={c.contactId} role="listitem" className="flex items-center gap-3 px-4 py-3 hover:bg-accent/60">
            <button className="flex items-center gap-3 flex-1 text-left min-w-0" onClick={() => createDirect.mutate({ userId: c.user.id })}>
              <Avatar name={c.alias || c.user.name} url={c.user.avatarUrl} size={44} />
              <div className="flex-1 min-w-0">
                <p className="font-medium truncate">{c.alias || c.user.name}</p>
                <p className="text-xs text-muted-foreground truncate">{c.user.about || c.user.phone}</p>
              </div>
            </button>
            <button
              className="p-2 text-muted-foreground hover:text-foreground"
              aria-label={`Block ${c.alias || c.user.name}`}
              onClick={() => {
                if (confirm(`Block ${c.alias || c.user.name}?`)) block.mutate({ userId: c.user.id });
              }}
            >
              <ShieldBan className="h-4 w-4" />
            </button>
            <button
              className="p-2 text-muted-foreground hover:text-destructive"
              aria-label={`Remove ${c.alias || c.user.name}`}
              onClick={() => {
                if (confirm(`Remove ${c.alias || c.user.name} from contacts?`))
                  removeContact.mutate({ userId: c.user.id });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
