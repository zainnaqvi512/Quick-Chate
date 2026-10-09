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
import { Tabs, TabsContent } from "@/components/ui/tabs";
import {
  Loader2,
  Search,
  Users,
  UserPlus,
  ArrowLeft,
  Phone,
  Video,
} from "lucide-react";

import { useCall } from "@/components/call/context";

export function NewChatDialog({
  open,
  onClose,
  onOpen,
  mode = "chat",
}: {
  mode?: "chat" | "call";
  open: boolean;
  onClose: () => void;
  onOpen: (id: number) => void;
}) {
  const call = useCall();
  const [tab, setTab] = useState("direct");
  const [adding, setAdding] = useState(false);
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
    setTab("direct");
    setAdding(false);
    setQuery("");
    setSelected([]);
    setGroupName("");
    onClose();
  }

  const results = query.trim().length >= 2 ? (searchQuery.data ?? []) : [];
  const contacts = contactsQuery.data ?? [];

  return (
    <Dialog open={open} onOpenChange={o => !o && handleClose()}>
      <DialogContent className="max-w-full sm:max-w-md h-[92dvh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <button
              aria-label="Back"
              onClick={() => {
                if (adding || tab === "group") {
                  setAdding(false);
                  setTab("direct");
                  setQuery("");
                } else handleClose();
              }}
            >
              <ArrowLeft />
            </button>
            {adding
              ? "New contact"
              : tab === "group"
                ? "New group"
                : mode === "call"
                  ? "Select contact to call"
                  : "Select contact"}
          </DialogTitle>
        </DialogHeader>
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="flex-1 min-h-0 overflow-y-auto"
        >
          {!adding && tab === "direct" && (
            <div className="space-y-2 py-3">
              <button
                className="w-full flex gap-4 items-center p-3 rounded-xl hover:bg-accent"
                onClick={() => setTab("group")}
              >
                <Users className="text-sky-500" />
                New group
              </button>
              <button
                className="w-full flex gap-4 items-center p-3 rounded-xl hover:bg-accent"
                onClick={() => setAdding(true)}
              >
                <UserPlus className="text-sky-500" />
                New contact
              </button>
            </div>
          )}
          <TabsContent value="direct" className="space-y-3 pt-3">
            {adding && (
              <>
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
              </>
            )}
            {(searchQuery.error ||
              createDirect.error ||
              createGroup.error ||
              addContact.error) && (
              <p role="alert" className="text-sm text-destructive">
                {addContact.error?.message ||
                  searchQuery.error?.message ||
                  createDirect.error?.message ||
                  createGroup.error?.message}
              </p>
            )}
            <div className="space-y-1">
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
                    disabled={addContact.isPending}
                    onClick={() => {
                      addContact.mutate(
                        { userId: u.id },
                        {
                          onSuccess: () => {
                            setAdding(false);
                            setQuery("");
                          },
                        }
                      );
                    }}
                  >
                    Add contact
                  </Button>
                </div>
              ))}
              {!adding && contacts.length === 0 && (
                <p className="p-4 text-muted-foreground text-sm">
                  No saved contacts yet. Tap New contact to add someone by their
                  exact username or phone number.
                </p>
              )}
              {query.trim().length === 0 && contacts.length > 0 && (
                <>
                  <p className="text-xs text-muted-foreground px-1 pt-1">
                    Your contacts
                  </p>
                  {contacts.map(c => (
                    <div key={c.user.id} className="flex items-center">
                      <button
                        key={c.user.id}
                        className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-left"
                        disabled={createDirect.isPending}
                        onClick={() => {
                          if (mode === "call") {
                            call.startCall(
                              {
                                id: c.user.id,
                                name:
                                  c.alias ||
                                  c.user.name ||
                                  c.user.phone ||
                                  "Contact",
                                avatarUrl: c.user.avatarUrl,
                              },
                              "voice"
                            );
                            handleClose();
                          } else createDirect.mutate({ userId: c.user.id });
                        }}
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
                      {mode === "call" && (
                        <>
                          <Phone className="h-5 w-5 shrink-0 text-sky-500" />
                          <button
                            aria-label={`Video call ${c.user.name}`}
                            className="p-3"
                            onClick={() => {
                              call.startCall(
                                {
                                  id: c.user.id,
                                  name: c.user.name || "Contact",
                                  avatarUrl: c.user.avatarUrl,
                                },
                                "video"
                              );
                              handleClose();
                            }}
                          >
                            <Video className="h-5 w-5 text-sky-500" />
                          </button>
                        </>
                      )}
                    </div>
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
            <div className="space-y-1">
              {contacts.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Add contacts first using New contact.
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
