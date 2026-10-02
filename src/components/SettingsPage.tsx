import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import { useAuth, type Me } from "@/lib/auth";
import { Avatar } from "@/components/Logo";
import { fileToBase64 } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  AlertTriangle,
  Bell,
  ChevronRight,
  Eye,
  Loader2,
  LogOut,
  Moon,
  Palette,
  ShieldCheck,
  Star,
  Sun,
  User,
  Monitor,
} from "lucide-react";

type Sub = null | "profile" | "privacy" | "notifications" | "appearance" | "security" | "starred" | "about";

export function SettingsPage({ me, onUpdated }: { me: Me; onUpdated: () => void }) {
  const { logout, theme, setTheme } = useAuth();
  const [sub, setSub] = useState<Sub>(null);
  const logoutMut = trpc.auth.logout.useMutation({ onSettled: () => logout() });

  if (sub === "profile") return <ProfileSettings me={me} onBack={() => { setSub(null); onUpdated(); }} />;
  if (sub === "privacy") return <PrivacySettings me={me} onBack={() => setSub(null)} />;
  if (sub === "notifications") return <NotifySettings me={me} onBack={() => setSub(null)} />;
  if (sub === "appearance")
    return (
      <SubPage title="Appearance" onBack={() => setSub(null)}>
        {(["light", "dark", "system"] as const).map((t) => (
          <button
            key={t}
            className={`w-full flex items-center gap-3 p-3 rounded-xl border ${theme === t ? "border-sky-500 bg-sky-50 dark:bg-sky-950" : "hover:bg-accent"}`}
            onClick={() => setTheme(t)}
          >
            {t === "light" ? <Sun className="h-5 w-5 text-amber-500" /> : t === "dark" ? <Moon className="h-5 w-5 text-sky-400" /> : <Monitor className="h-5 w-5" />}
            <span className="capitalize font-medium">{t} mode</span>
            {theme === t && <span className="ml-auto text-sky-500 text-sm">✓</span>}
          </button>
        ))}
      </SubPage>
    );
  if (sub === "security") return <SecuritySettings onBack={() => setSub(null)} />;
  if (sub === "starred") return <StarredMessages onBack={() => setSub(null)} />;
  if (sub === "about")
    return (
      <SubPage title="About" onBack={() => setSub(null)}>
        <div className="text-sm space-y-2">
          <p><b>Quick Chat</b> v1.0.0</p>
          <p className="text-muted-foreground">
            Private messaging with a twist: conversations remain available for 12 hours after you read them, then
            expire permanently — enforced by the server, not your device.
          </p>
          <p className="text-muted-foreground">Terms · Privacy Policy · Open-source licenses</p>
        </div>
      </SubPage>
    );

  const item = (
    icon: React.ReactNode,
    label: string,
    desc: string,
    onClick: () => void,
  ) => (
    <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/60 text-left" onClick={onClick}>
      <span className="text-sky-500">{icon}</span>
      <span className="flex-1">
        <span className="block text-sm font-medium">{label}</span>
        <span className="block text-xs text-muted-foreground">{desc}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 pt-4 pb-2">
        <h1 className="text-lg font-bold text-sky-600 dark:text-sky-400">Settings</h1>
      </header>
      <div className="flex-1 overflow-y-auto min-h-0 pb-4">
        <button className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/60 text-left" onClick={() => setSub("profile")}>
          <Avatar name={me.name} url={me.avatarUrl} size={52} />
          <span className="flex-1 min-w-0">
            <span className="block font-medium truncate">{me.name}</span>
            <span className="block text-xs text-muted-foreground truncate">{me.about}</span>
            <span className="block text-xs text-muted-foreground">{me.phone}</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </button>
        <div className="my-2 border-t" />
        {item(<Eye className="h-5 w-5" />, "Privacy", "Last seen, photo, about, read receipts, blocked", () => setSub("privacy"))}
        {item(<Bell className="h-5 w-5" />, "Notifications", "Messages, groups, calls, sounds", () => setSub("notifications"))}
        {item(<Palette className="h-5 w-5" />, "Appearance", "Light, dark or system theme", () => setSub("appearance"))}
        {item(<Star className="h-5 w-5" />, "Starred messages", "Messages you bookmarked", () => setSub("starred"))}
        {item(<ShieldCheck className="h-5 w-5" />, "Security", "Active sessions, account", () => setSub("security"))}
        {item(<User className="h-5 w-5" />, "About", "Version, terms, privacy policy", () => setSub("about"))}
        <div className="my-2 border-t" />
        <button
          className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent/60 text-left text-destructive"
          onClick={() => {
            if (confirm("Log out of Quick Chat on this device?")) logoutMut.mutate();
          }}
        >
          <LogOut className="h-5 w-5" />
          <span className="text-sm font-medium">Log out</span>
        </button>
      </div>
    </div>
  );
}

function SubPage({ title, onBack, children }: { title: string; onBack: () => void; children: React.ReactNode }) {
  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 pt-4 pb-2 flex items-center gap-2">
        <button onClick={onBack} className="text-sky-600 dark:text-sky-400 text-sm hover:underline">
          ← Settings
        </button>
      </header>
      <h2 className="px-4 text-lg font-bold">{title}</h2>
      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-3">{children}</div>
    </div>
  );
}

function ProfileSettings({ me, onBack }: { me: Me; onBack: () => void }) {
  const [name, setName] = useState(me.name);
  const [about, setAbout] = useState(me.about);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const upload = trpc.media.upload.useMutation();
  const update = trpc.users.updateMe.useMutation({ onSuccess: onBack });

  async function pickAvatar(file: File) {
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await upload.mutateAsync({ name: file.name, contentBase64: base64, contentType: file.type, folder: "avatar" });
      await update.mutateAsync({ avatarUrl: res.key });
    } finally {
      setUploading(false);
    }
  }

  return (
    <SubPage title="Profile" onBack={onBack}>
      <div className="flex flex-col items-center gap-2">
        <div className="relative">
          <Avatar name={me.name} url={me.avatarUrl} size={96} />
          {uploading && (
            <div className="absolute inset-0 rounded-full bg-black/40 flex items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-white" />
            </div>
          )}
        </div>
        <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
          Change photo
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) pickAvatar(f);
            e.target.value = "";
          }}
        />
      </div>
      <label className="block text-sm">
        <span className="text-muted-foreground">Name</span>
        <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </label>
      <label className="block text-sm">
        <span className="text-muted-foreground">About</span>
        <Input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={200} />
      </label>
      <p className="text-sm text-muted-foreground">Phone: {me.phone}</p>
      <Button
        className="bg-sky-500 hover:bg-sky-600 text-white"
        disabled={!name.trim() || update.isPending}
        onClick={() => update.mutate({ name: name.trim(), about })}
      >
        Save
      </Button>
    </SubPage>
  );
}

function PrivacySettings({ me, onBack }: { me: Me; onBack: () => void }) {
  const [p, setP] = useState(me.privacy);
  const update = trpc.users.updatePrivacy.useMutation();
  const blockedQuery = trpc.users.blocked.useQuery();
  const unblockMut = trpc.users.unblock.useMutation({ onSuccess: () => blockedQuery.refetch() });

  function save(next: typeof p) {
    setP(next);
    update.mutate(next as any);
  }

  const Row = ({ label, k }: { label: string; k: "lastSeen" | "avatar" | "about" }) => (
    <div className="flex items-center justify-between gap-3 p-3 border rounded-xl">
      <span className="text-sm font-medium">{label}</span>
      <select
        value={p[k]}
        onChange={(e) => save({ ...p, [k]: e.target.value })}
        className="rounded-md border bg-background px-2 py-1 text-sm"
        aria-label={label}
      >
        <option value="everyone">Everyone</option>
        <option value="contacts">My contacts</option>
        <option value="nobody">Nobody</option>
      </select>
    </div>
  );

  return (
    <SubPage title="Privacy" onBack={onBack}>
      <Row label="Last seen & online" k="lastSeen" />
      <Row label="Profile photo" k="avatar" />
      <Row label="About" k="about" />
      <div className="flex items-center justify-between gap-3 p-3 border rounded-xl">
        <span className="text-sm font-medium">Read receipts</span>
        <Switch checked={p.readReceipts} onCheckedChange={(v) => save({ ...p, readReceipts: v })} />
      </div>
      <h3 className="text-sm font-semibold pt-2">Blocked contacts</h3>
      {(blockedQuery.data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No blocked users.</p>
      )}
      {(blockedQuery.data ?? []).map((u) => (
        <div key={u.id} className="flex items-center gap-3 p-2 border rounded-xl">
          <Avatar name={u.name || u.phone} url={u.avatarUrl} size={36} />
          <span className="flex-1 text-sm font-medium truncate">{u.name || u.phone}</span>
          <Button variant="outline" size="sm" onClick={() => unblockMut.mutate({ userId: u.id })}>
            Unblock
          </Button>
        </div>
      ))}
    </SubPage>
  );
}

function NotifySettings({ me, onBack }: { me: Me; onBack: () => void }) {
  const [n, setN] = useState(me.notifySettings);
  const update = trpc.users.updateNotify.useMutation();
  function save(next: typeof n) {
    setN(next);
    update.mutate(next);
  }
  const Row = ({ label, k }: { label: string; k: keyof typeof n }) => (
    <div className="flex items-center justify-between gap-3 p-3 border rounded-xl">
      <span className="text-sm font-medium">{label}</span>
      <Switch checked={n[k]} onCheckedChange={(v) => save({ ...n, [k]: v })} />
    </div>
  );
  return (
    <SubPage title="Notifications" onBack={onBack}>
      <Row label="Message notifications" k="messages" />
      <Row label="Group notifications" k="groups" />
      <Row label="Call notifications" k="calls" />
      <Row label="Notification sounds" k="sounds" />
    </SubPage>
  );
}

function SecuritySettings({ onBack }: { onBack: () => void }) {
  const sessionsQuery = trpc.auth.sessions.useQuery();
  const { logout } = useAuth();
  const deleteAccount = trpc.users.deleteAccount.useMutation({ onSettled: () => logout() });
  return (
    <SubPage title="Security" onBack={onBack}>
      <h3 className="text-sm font-semibold">Active sessions</h3>
      {(sessionsQuery.data ?? []).map((s) => (
        <div key={s.id} className="p-3 border rounded-xl text-sm">
          <p className="font-medium truncate">{s.userAgent || "Unknown device"}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(s.createdAt).toLocaleString()} {s.current && "· This device"}
          </p>
        </div>
      ))}
      <div className="p-3 border border-destructive/40 rounded-xl">
        <p className="text-sm font-medium text-destructive flex items-center gap-1">
          <AlertTriangle className="h-4 w-4" /> Delete account
        </p>
        <p className="text-xs text-muted-foreground mt-1 mb-2">
          Permanently deletes your account, sessions and contact entries.
        </p>
        <Button
          variant="destructive"
          size="sm"
          onClick={() => {
            if (confirm("Delete your Quick Chat account permanently? This cannot be undone."))
              deleteAccount.mutate();
          }}
        >
          Delete my account
        </Button>
      </div>
    </SubPage>
  );
}

function StarredMessages({ onBack }: { onBack: () => void }) {
  const starredQuery = trpc.messages.starred.useQuery();
  return (
    <SubPage title="Starred messages" onBack={onBack}>
      {(starredQuery.data ?? []).length === 0 && (
        <p className="text-sm text-muted-foreground">No starred messages. Star messages in any chat to find them here.</p>
      )}
      {(starredQuery.data ?? []).map((m) => (
        <div key={m.messageId} className="p-3 border rounded-xl">
          <p className="text-sm">{m.type === "text" ? m.content : `📎 ${m.type}`}</p>
          <p className="text-xs text-muted-foreground mt-1">{new Date(m.createdAt).toLocaleString()}</p>
        </div>
      ))}
    </SubPage>
  );
}
