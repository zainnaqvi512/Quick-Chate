import { useState } from "react";
import { trpc } from "@/providers/trpc";
import { Avatar } from "@/components/Logo";
import { COUNTRIES } from "@/lib/countries";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Search, Users } from "lucide-react";

export function NewChatDialog({
  open,
  onClose,
  onOpen,
}: {
  open: boolean;
  onClose: () => void;
  onOpen: (id: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [countryDial, setCountryDial] = useState("+92");
  const [selected, setSelected] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("");

  const searchQuery = trpc.users.search.useQuery(
    { query, countryCode: countryDial },
    { enabled: query.trim().length >= 2 }
  );
  const contactsQuery = trpc.contacts.list.useQuery();

  const utils = trpc.useUtils();
  const createDirect = trpc.conversations.createDirect.useMutation({
    onSuccess: r => {
      utils.conversations.list.invalidate();
      onOpen(r.id);
      handleClose();
    },
  });
  const createGroup = trpc.conversations.createGroup.useMutation({
    onSuccess: r => {
      utils.conversations.list.invalidate();
      onOpen(r.id);
      handleClose();
    },
  });
  const addContact = trpc.contacts.add.useMutation({
    onSuccess: () => contactsQuery.refetch(),
  });

  function handleClose() {
    setQuery("");
    setSelected([]);
    setGroupName("");
    onClose();
  }

  const results = query.trim().length >= 2 ? (searchQuery.data ?? []) : [];
  const contacts = contactsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>New conversation</DialogTitle>
        </DialogHeader>
        <Tabs defaultValue="direct">
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="direct">Direct chat</TabsTrigger>
            <TabsTrigger value="group">New group</TabsTrigger>
          </TabsList>

          <TabsContent value="direct" className="space-y-3 pt-3">
            <div className="flex gap-2">
              <select
                aria-label="Country code"
                value={countryDial}
                onChange={e => setCountryDial(e.target.value)}
                className="rounded-md border bg-background px-2 text-sm"
              >
                {COUNTRIES.map(c => (
                  <option key={c.name} value={c.dial}>
                    {c.flag} {c.dial}
                  </option>
                ))}
              </select>
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  placeholder="Exact @username or phone"
                  className="pl-9"
                  aria-label="Search users"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Enter the complete username or phone number of a Quick Chat
              account. Partial names do not return contacts.
            </p>
            {(searchQuery.error || createDirect.error || createGroup.error) && (
              <p role="alert" className="text-sm text-destructive">
                {searchQuery.error?.message ||
                  createDirect.error?.message ||
                  createGroup.error?.message}
              </p>
            )}
            <div className="max-h-64 overflow-y-auto space-y-1">
              {searchQuery.isFetching && (
                <div className="flex justify-center py-4">
                  <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
                </div>
              )}
              {query.trim().length >= 2 &&
                !searchQuery.isFetching &&
                !searchQuery.error &&
                results.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No Quick Chat user found. Invite them to join!
                  </p>
                )}
              {results.map(u => (
                <div
                  key={u.id}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
                >
                  <Avatar
                    name={u.name || u.phone}
                    url={u.avatarUrl}
                    size={38}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">
                      {u.name || u.phone}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">
                      {u.username
                        ? `@${u.username}`
                        : u.phone || "Quick Chat user"}
                    </div>
                  </div>
                  <Button
                    size="sm"
                    className="bg-sky-500 hover:bg-sky-600 text-white"
                    disabled={createDirect.isPending}
                    onClick={() => {
                      addContact.mutate({ userId: u.id });
                      createDirect.mutate({ userId: u.id });
                    }}
                  >
                    Chat
                  </Button>
                </div>
              ))}
              {query.trim().length === 0 && contacts.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground px-1 pt-1">
                    Your contacts
                  </p>
                  {contacts.map(c => (
                    <button
                      key={c.user.id}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-left"
                      disabled={createDirect.isPending}
                      onClick={() => createDirect.mutate({ userId: c.user.id })}
                    >
                      <Avatar
                        name={c.alias || c.user.name}
                        url={c.user.avatarUrl}
                        size={38}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">
                          {c.alias || c.user.name}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {c.user.phone}
                        </div>
                      </div>
                    </button>
                  ))}
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="group" className="space-y-3 pt-3">
            <Input
              value={groupName}
              onChange={e => setGroupName(e.target.value)}
              placeholder="Group name"
              maxLength={60}
              aria-label="Group name"
            />
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Users className="h-3.5 w-3.5" /> Select members (
              {selected.length} selected)
            </p>
            <div className="max-h-64 overflow-y-auto space-y-1">
              {contacts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add contacts first (search by phone number in the Direct tab).
                </p>
              )}
              {contacts.map(c => {
                const on = selected.includes(c.user.id);
                return (
                  <button
                    key={c.user.id}
                    className={`w-full flex items-center gap-3 p-2 rounded-lg text-left ${on ? "bg-sky-100 dark:bg-sky-950" : "hover:bg-accent"}`}
                    onClick={() =>
                      setSelected(s =>
                        on ? s.filter(x => x !== c.user.id) : [...s, c.user.id]
                      )
                    }
                  >
                    <Avatar
                      name={c.alias || c.user.name}
                      url={c.user.avatarUrl}
                      size={38}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium truncate">
                        {c.alias || c.user.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.user.phone}
                      </div>
                    </div>
                    <span
                      className={`h-5 w-5 rounded-full border flex items-center justify-center ${on ? "bg-sky-500 border-sky-500 text-white" : ""}`}
                    >
                      {on && "✓"}
                    </span>
                  </button>
                );
              })}
            </div>
            <Button
              className="w-full bg-sky-500 hover:bg-sky-600 text-white"
              disabled={
                !groupName.trim() ||
                selected.length === 0 ||
                createGroup.isPending
              }
              onClick={() =>
                createGroup.mutate({
                  name: groupName.trim(),
                  memberIds: selected,
                })
              }
            >
              {createGroup.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Create group
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
