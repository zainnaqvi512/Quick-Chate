import { StatusViewer } from "./StatusViewer";
import { AttachmentPreview } from "./chat/AttachmentPreview";
import { toast } from "sonner";
import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import type { Me } from "@/lib/auth";
import { Avatar } from "@/components/Logo";
import { fileToBase64, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, ImagePlus, Loader2, Plus, Trash2 } from "lucide-react";

export function StatusPage({ me }: { me: Me }) {
  const [selected, setSelected] = useState<File | null>(null);
  const [postError, setPostError] = useState("");
  const [color, setColor] = useState("#0284c7");
  const [postOpen, setPostOpen] = useState(false);
  const [text, setText] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);
  const [viewersFor, setViewersFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const listQuery = trpc.status.list.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const viewersQuery = trpc.status.viewers.useQuery(
    { id: viewersFor ?? 0 },
    { enabled: viewersFor !== null }
  );
  const post = trpc.status.post.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      setPostOpen(false);
      setText("");
    },
  });
  const remove = trpc.status.remove.useMutation({
    onSuccess: () => listQuery.refetch(),
  });
  const upload = trpc.media.upload.useMutation();

  const items = listQuery.data ?? [];
  const mine = items.filter(s => s.mine);
  const others = items.filter(s => !s.mine);
  const groups = Array.from(new Set(others.map(s => s.userId)))
    .map(id => {
      const stories = others
        .filter(s => s.userId === id)
        .sort(
          (a, b) =>
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      return {
        stories,
        first: stories.find(s => !s.viewedByMe) || stories[0],
        seen: stories.every(s => s.viewedByMe),
      };
    })
    .sort((a, b) => Number(a.seen) - Number(b.seen));

  async function postImage(file: File, caption: string) {
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await upload.mutateAsync({
        name: file.name,
        contentBase64: base64,
        contentType: file.type,
        folder: "status",
      });
      await post.mutateAsync({
        type: file.type.startsWith("video") ? "video" : "image",
        mediaUrl: res.key,
        content: caption,
      });
      setSelected(null);
    } catch (e) {
      setPostError(e instanceof Error ? e.message : "Status failed");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      {selected && (
        <AttachmentPreview
          files={[selected]}
          allowOnce={false}
          busy={uploading}
          error={postError}
          onCancel={() => setSelected(null)}
          onSend={(_once, caption) => void postImage(selected, caption)}
        />
      )}
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold text-sky-600 dark:text-sky-400">
          Updates
        </h1>
        <button
          aria-label="Add status"
          onClick={() => setPostOpen(true)}
          className="p-2 rounded-full bg-sky-500 text-white hover:bg-sky-600"
        >
          <Plus className="h-5 w-5" />
        </button>
      </header>
      <div className="flex-1 overflow-y-auto min-h-0 px-4 pb-4 space-y-1">
        {listQuery.isLoading && (
          <div className="space-y-3 pt-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        )}

        <button
          className="flex items-center gap-3 py-4 w-full text-left"
          onClick={() => setPostOpen(true)}
        >
          <Avatar name={me.name} url={me.avatarUrl} size={54} />
          <div>
            <p className="font-semibold">Add status +</p>
            <p className="text-xs text-muted-foreground">
              Disappears after 24 hours · shared with your contacts
            </p>
          </div>
        </button>
        <p className="text-xs font-medium text-muted-foreground pt-2 pb-1">
          My status
        </p>
        {mine.length === 0 && (
          <p className="text-sm text-muted-foreground pb-2">
            No status. Share something — it expires in 24 hours.
          </p>
        )}
        {mine.map(s => (
          <div
            key={s.id}
            className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent"
          >
            <button
              className="flex items-center gap-3 flex-1 text-left"
              onClick={() => setViewing(s.id)}
            >
              <StatusThumb item={s} me={me} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {s.type === "text" ? s.content : `📷 ${s.type} status`}
                </p>
                <p className="text-xs text-muted-foreground">
                  {formatTime(s.createdAt)}
                </p>
              </div>
            </button>
            <button
              className="p-1.5 text-muted-foreground hover:text-foreground"
              aria-label="Views"
              onClick={() => setViewersFor(s.id)}
            >
              <Eye className="h-4 w-4" />
              <span className="sr-only">{s.viewCount} views</span>
            </button>
            <button
              className="p-1.5 text-muted-foreground hover:text-destructive"
              aria-label="Delete status"
              onClick={() => {
                if (confirm("Delete this status?")) remove.mutate({ id: s.id });
              }}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <p className="text-xs font-medium text-muted-foreground pt-4 pb-1">
          Recent updates
        </p>
        {others.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No status updates from contacts.
          </p>
        )}
        {groups.map(g => (
          <button
            key={g.first.userId}
            className="w-full flex items-center gap-3 py-3 text-left"
            onClick={() => setViewing(g.first.id)}
          >
            <div
              className={`rounded-full p-1 border-2 ${g.seen ? "border-slate-400" : "border-sky-500"}`}
            >
              <StatusThumb item={g.first} me={me} />
            </div>
            <div>
              <p className="font-medium">{g.first.userName}</p>
              <p className="text-xs text-muted-foreground">
                {g.stories.length} updates · {g.seen ? "Viewed" : "New"} ·{" "}
                {formatTime(g.first.createdAt)}
              </p>
            </div>
          </button>
        ))}
      </div>

      {/* Post dialog */}
      <Dialog open={postOpen} onOpenChange={setPostOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>New status (24h)</DialogTitle>
          </DialogHeader>
          <textarea
            value={text}
            onChange={e => setText(e.target.value)}
            placeholder="Type a status…"
            rows={4}
            className="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Status text"
          />
          <label className="text-sm">
            Background color{" "}
            <input
              aria-label="Status background color"
              type="color"
              value={color}
              onChange={e => setColor(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
              disabled={!text.trim() || post.isPending}
              onClick={() =>
                post.mutate(
                  { type: "text", content: text.trim(), bgColor: color },
                  { onError: e => toast.error(e.message) }
                )
              }
            >
              {post.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Post text
            </Button>
            <Button
              variant="outline"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ImagePlus className="h-4 w-4 mr-1" />
              )}
              Photo/Video
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={e => {
                const f = e.target.files?.[0];
                if (f) {
                  if (!f.size || f.size > 15 * 1024 * 1024) {
                    toast.error("Choose media up to 15 MB.");
                  } else {
                    setPostOpen(false);
                    setPostError("");
                    setSelected(f);
                  }
                }
                e.target.value = "";
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {viewing !== null && (
        <StatusViewer
          key={viewing}
          initialId={viewing}
          items={items
            .filter(s => s.userId === items.find(x => x.id === viewing)?.userId)
            .sort(
              (a, b) =>
                new Date(a.createdAt).getTime() -
                new Date(b.createdAt).getTime()
            )}
          onClose={() => {
            setViewing(null);
            void listQuery.refetch();
          }}
        />
      )}

      {/* Viewers dialog */}
      <Dialog
        open={viewersFor !== null}
        onOpenChange={o => !o && setViewersFor(null)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Viewed by</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            {(viewersQuery.data ?? []).length === 0 && (
              <p className="text-sm text-muted-foreground">No views yet.</p>
            )}
            {(viewersQuery.data ?? []).map((v, i) => (
              <div key={i} className="flex justify-between text-sm">
                <span>{v.name}</span>
                <span className="text-muted-foreground">
                  {formatTime(v.viewedAt)}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusThumb({
  item,
  me,
}: {
  item: {
    type: string;
    bgColor: string | null;
    content: string | null;
    mediaUrl: string | null;
    userName: string;
    userAvatar: string | null;
  };
  me: Me;
}) {
  void me;
  if (item.type === "text") {
    return (
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
        style={{
          background: `linear-gradient(135deg, ${item.bgColor || "#38BDF8"}, #0284C7)`,
        }}
      >
        Aa
      </div>
    );
  }
  return <Avatar name={item.userName} url={item.userAvatar} size={48} />;
}
