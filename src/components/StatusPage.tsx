import { useRef, useState } from "react";
import { trpc } from "@/providers/trpc";
import type { Me } from "@/lib/auth";
import { Avatar } from "@/components/Logo";
import { fileToBase64, formatTime } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, ImagePlus, Loader2, Plus, Trash2, X } from "lucide-react";

export function StatusPage({ me }: { me: Me }) {
  const [postOpen, setPostOpen] = useState(false);
  const [text, setText] = useState("");
  const [viewing, setViewing] = useState<number | null>(null);
  const [viewersFor, setViewersFor] = useState<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const listQuery = trpc.status.list.useQuery(undefined, { refetchInterval: 10000 });
  const viewersQuery = trpc.status.viewers.useQuery(
    { id: viewersFor ?? 0 },
    { enabled: viewersFor !== null },
  );
  const post = trpc.status.post.useMutation({
    onSuccess: () => {
      listQuery.refetch();
      setPostOpen(false);
      setText("");
    },
  });
  const remove = trpc.status.remove.useMutation({ onSuccess: () => listQuery.refetch() });
  const view = trpc.status.view.useMutation();
  const upload = trpc.media.upload.useMutation();

  const items = listQuery.data ?? [];
  const mine = items.filter((s) => s.mine);
  const others = items.filter((s) => !s.mine);

  async function postImage(file: File) {
    setUploading(true);
    try {
      const base64 = await fileToBase64(file);
      const res = await upload.mutateAsync({
        name: file.name,
        contentBase64: base64,
        contentType: file.type,
        folder: "status",
      });
      await post.mutateAsync({ type: file.type.startsWith("video") ? "video" : "image", mediaUrl: res.key });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <header className="px-4 pt-4 pb-2 flex items-center justify-between">
        <h1 className="text-lg font-bold text-sky-600 dark:text-sky-400">Status</h1>
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
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-12 w-12 rounded-full" />
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        )}

        <p className="text-xs font-medium text-muted-foreground pt-2 pb-1">My status</p>
        {mine.length === 0 && (
          <p className="text-sm text-muted-foreground pb-2">No status. Share something — it expires in 24 hours.</p>
        )}
        {mine.map((s) => (
          <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-accent">
            <button className="flex items-center gap-3 flex-1 text-left" onClick={() => setViewing(s.id)}>
              <StatusThumb item={s} me={me} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {s.type === "text" ? s.content : `📷 ${s.type} status`}
                </p>
                <p className="text-xs text-muted-foreground">{formatTime(s.createdAt)}</p>
              </div>
            </button>
            <button className="p-1.5 text-muted-foreground hover:text-foreground" aria-label="Views" onClick={() => setViewersFor(s.id)}>
              <Eye className="h-4 w-4" />
              <span className="sr-only">{s.viewCount} views</span>
            </button>
            <button className="p-1.5 text-muted-foreground hover:text-destructive" aria-label="Delete status" onClick={() => remove.mutate({ id: s.id })}>
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}

        <p className="text-xs font-medium text-muted-foreground pt-4 pb-1">Recent updates</p>
        {others.length === 0 && <p className="text-sm text-muted-foreground">No status updates from contacts.</p>}
        {others.map((s) => (
          <button
            key={s.id}
            className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-accent text-left"
            onClick={() => {
              setViewing(s.id);
              if (!s.viewedByMe) view.mutate({ id: s.id });
            }}
          >
            <StatusThumb item={s} me={me} />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{s.userName}</p>
              <p className="text-xs text-muted-foreground">{formatTime(s.createdAt)}</p>
            </div>
            {!s.viewedByMe && <span className="h-2.5 w-2.5 rounded-full bg-sky-500" />}
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
            onChange={(e) => setText(e.target.value)}
            placeholder="Type a status…"
            rows={4}
            className="w-full rounded-lg border bg-background p-3 text-sm focus:outline-none focus:ring-2 focus:ring-sky-500"
            aria-label="Status text"
          />
          <div className="flex gap-2">
            <Button
              className="flex-1 bg-sky-500 hover:bg-sky-600 text-white"
              disabled={!text.trim() || post.isPending}
              onClick={() => post.mutate({ type: "text", content: text.trim() })}
            >
              {post.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Post text
            </Button>
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4 mr-1" />}
              Photo/Video
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) postImage(f);
                e.target.value = "";
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      {/* Viewer dialog */}
      <Dialog open={viewing !== null} onOpenChange={(o) => !o && setViewing(null)}>
        <DialogContent className="max-w-sm">
          {(() => {
            const s = items.find((x) => x.id === viewing);
            if (!s) return null;
            return (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Avatar name={s.userName} url={s.userAvatar} size={32} />
                  <div>
                    <p className="text-sm font-medium">{s.mine ? "My status" : s.userName}</p>
                    <p className="text-xs text-muted-foreground">{formatTime(s.createdAt)}</p>
                  </div>
                  <button className="ml-auto p-1" onClick={() => setViewing(null)} aria-label="Close">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {s.type === "text" ? (
                  <div
                    className="rounded-xl p-6 text-center text-lg font-medium text-white min-h-40 flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${s.bgColor || "#38BDF8"}, #0284C7)` }}
                  >
                    {s.content}
                  </div>
                ) : (
                  <StatusMedia url={s.mediaUrl} type={s.type} />
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* Viewers dialog */}
      <Dialog open={viewersFor !== null} onOpenChange={(o) => !o && setViewersFor(null)}>
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
                <span className="text-muted-foreground">{formatTime(v.viewedAt)}</span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatusThumb({ item, me }: { item: any; me: Me }) {
  void me;
  if (item.type === "text") {
    return (
      <div
        className="h-12 w-12 rounded-full flex items-center justify-center text-white text-lg font-bold"
        style={{ background: `linear-gradient(135deg, ${item.bgColor || "#38BDF8"}, #0284C7)` }}
      >
        Aa
      </div>
    );
  }
  return <Avatar name={item.userName} url={item.userAvatar} size={48} />;
}

function StatusMedia({ url, type }: { url: string | null; type: string }) {
  const {url:src} = usePrivateMedia(url);
  if (!src) return <div className="h-48 flex items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  if (type === "video") return <video src={src} controls className="w-full rounded-xl" />;
  return <img src={src} alt="status" className="w-full rounded-xl" />;
}
import { usePrivateMedia } from '@/lib/media';
