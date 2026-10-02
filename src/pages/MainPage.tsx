import { useCallback, useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth, type Me } from "@/lib/auth";
import { Logo, Avatar } from "@/components/Logo";
import { ChatList } from "@/components/chat/ChatList";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { StatusPage } from "@/components/StatusPage";
import { CallsPage } from "@/components/CallsPage";
import { ContactsPage } from "@/components/ContactsPage";
import { SettingsPage } from "@/components/SettingsPage";
import { CallManager } from "@/components/call/CallManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  MessageCircle,
  Phone,
  Sparkles,
  Users,
  Settings as SettingsIcon,
  Loader2,
} from "lucide-react";

export type Section = "chats" | "status" | "calls" | "contacts" | "settings";

const NAV: { id: Section; label: string; icon: typeof MessageCircle }[] = [
  { id: "chats", label: "Chats", icon: MessageCircle },
  { id: "status", label: "Status", icon: Sparkles },
  { id: "calls", label: "Calls", icon: Phone },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "settings", label: "Settings", icon: SettingsIcon },
];

function ProfileSetup({ me, onDone }: { me: Me; onDone: () => void }) {
  const [name, setName] = useState(me.name || "");
  const [about, setAbout] = useState("");
  const update = trpc.users.updateMe.useMutation({ onSuccess: onDone });
  return (
    <div className="min-h-dvh flex items-center justify-center bg-gradient-to-b from-sky-50 to-background dark:from-slate-900 p-6">
      <div className="w-full max-w-md bg-card border rounded-2xl shadow-lg p-6 space-y-4">
        <div className="flex flex-col items-center">
          <Logo size={48} />
          <h2 className="mt-3 text-xl font-semibold">Welcome to Quick Chat</h2>
          <p className="text-sm text-muted-foreground">Set up your profile so friends can find you.</p>
        </div>
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" maxLength={60} />
        <Input value={about} onChange={(e) => setAbout(e.target.value)} placeholder="About (optional)" maxLength={200} />
        <Button
          className="w-full bg-sky-500 hover:bg-sky-600 text-white"
          disabled={!name.trim() || update.isPending}
          onClick={() => update.mutate({ name: name.trim(), about: about.trim() || undefined })}
        >
          {update.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
}

export default function MainPage() {
  const { logout } = useAuth();
  const [section, setSection] = useState<Section>("chats");
  const [activeConv, setActiveConv] = useState<number | null>(null);

  const meQuery = trpc.users.me.useQuery(undefined, {
    refetchInterval: 30_000,
    retry: (count, err) => {
      if (err?.data?.code === "UNAUTHORIZED") return false;
      return count < 2;
    },
  });

  useEffect(() => {
    if (meQuery.error?.data?.code === "UNAUTHORIZED") logout();
  }, [meQuery.error, logout]);

  const openConversation = useCallback((id: number) => {
    setActiveConv(id);
    setSection("chats");
  }, []);

  if (meQuery.isLoading) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center gap-3">
        <Logo size={56} />
        <Loader2 className="h-5 w-5 animate-spin text-sky-500" />
      </div>
    );
  }
  const me = meQuery.data as Me | undefined;
  if (!me) return null;
  if (!me.profileComplete) return <ProfileSetup me={me} onDone={() => meQuery.refetch()} />;

  const wide = (
    <div className="hidden md:flex h-dvh">
      {/* Rail nav */}
      <nav className="w-16 border-r bg-card flex flex-col items-center py-4 gap-1" aria-label="Main navigation">
        <div className="mb-4">
          <Logo size={34} />
        </div>
        {NAV.map((n) => (
          <button
            key={n.id}
            aria-label={n.label}
            title={n.label}
            onClick={() => setSection(n.id)}
            className={`p-3 rounded-xl transition-colors ${
              section === n.id ? "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400" : "text-muted-foreground hover:bg-accent"
            }`}
          >
            <n.icon className="h-5 w-5" />
          </button>
        ))}
        <div className="mt-auto">
          <Avatar name={me.name} url={me.avatarUrl} size={34} />
        </div>
      </nav>
      {/* List panel */}
      <aside className="w-80 border-r bg-card flex flex-col min-h-0">
        {section === "chats" && <ChatList me={me} activeId={activeConv} onOpen={openConversation} />}
        {section === "status" && <StatusPage me={me} />}
        {section === "calls" && <CallsPage onOpenChat={openConversation} />}
        {section === "contacts" && <ContactsPage onOpenChat={openConversation} />}
        {section === "settings" && <SettingsPage me={me} onUpdated={() => meQuery.refetch()} />}
      </aside>
      {/* Main panel */}
      <main className="flex-1 min-w-0 min-h-0">
        {section === "chats" && activeConv ? (
          <ChatWindow key={activeConv} me={me} conversationId={activeConv} onClose={() => setActiveConv(null)} />
        ) : (
          <div className="h-full flex flex-col items-center justify-center gap-3 text-center p-8 chat-bg">
            <Logo size={72} />
            <h2 className="text-2xl font-semibold text-sky-600 dark:text-sky-400">Quick Chat for Web</h2>
            <p className="text-sm text-muted-foreground max-w-sm">
              Send and receive messages in real time. Conversations remain available for 12 hours after you read
              them — then they're gone for good.
            </p>
          </div>
        )}
      </main>
    </div>
  );

  const mobile = (
    <div className="md:hidden h-dvh flex flex-col">
      <div className="flex-1 min-h-0">
        {activeConv && section === "chats" ? (
          <ChatWindow key={activeConv} me={me} conversationId={activeConv} onClose={() => setActiveConv(null)} />
        ) : (
          <>
            {section === "chats" && <ChatList me={me} activeId={activeConv} onOpen={openConversation} />}
            {section === "status" && <StatusPage me={me} />}
            {section === "calls" && <CallsPage onOpenChat={openConversation} />}
            {section === "contacts" && <ContactsPage onOpenChat={openConversation} />}
            {section === "settings" && <SettingsPage me={me} onUpdated={() => meQuery.refetch()} />}
          </>
        )}
      </div>
      {!(activeConv && section === "chats") && (
        <nav className="border-t bg-card flex justify-around py-1.5" aria-label="Main navigation">
          {NAV.map((n) => (
            <button
              key={n.id}
              aria-label={n.label}
              onClick={() => setSection(n.id)}
              className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-[11px] ${
                section === n.id ? "text-sky-600 dark:text-sky-400" : "text-muted-foreground"
              }`}
            >
              <n.icon className="h-5 w-5" />
              {n.label}
            </button>
          ))}
        </nav>
      )}
    </div>
  );

  return (
    <CallManager me={me}>
      {wide}
      {mobile}
    </CallManager>
  );
}
