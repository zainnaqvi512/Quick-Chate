import { useEffect, useState } from "react";
import { trpc } from "@/providers/trpc";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MediaContent } from "./MediaContent";
import { usePrivateMedia } from "@/lib/media";
import { ArrowLeft, Play, Music } from "lucide-react";

type Category = "media" | "documents" | "links";
function Thumbnail({
  mediaUrl,
  type,
}: {
  mediaUrl: string | null;
  type: string;
}) {
  const { url } = usePrivateMedia(mediaUrl);
  return (
    <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
      {url && (type === "image" || type === "gif") ? (
        <img
          src={url}
          alt="Shared media"
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : url && type === "video" ? (
        <video
          src={url}
          preload="metadata"
          className="w-full h-full object-cover"
        />
      ) : type === "audio" ? (
        <Music />
      ) : (
        <Play />
      )}
    </div>
  );
}
export function ChatMediaBrowser({
  conversationId,
  onClose,
}: {
  conversationId: number;
  onClose: () => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);
  const [category, setCategory] = useState<Category>("media");
  const [selected, setSelected] = useState<number | null>(null);
  const query = trpc.messages.library.useInfiniteQuery(
    { conversationId, category },
    { getNextPageParam: page => page.nextCursor, refetchInterval: 3000 }
  );
  const items =
    query.data?.pages
      .flatMap(p => p.items)
      .filter(m => !m.expiresAt || new Date(m.expiresAt).getTime() > now) ?? [];
  const active = items.find(m => m.id === selected);
  return (
    <Dialog open onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-full sm:max-w-2xl h-[92dvh] flex flex-col p-0 overflow-hidden">
        <DialogHeader className="p-4 pr-12 shrink-0">
          <DialogTitle className="flex items-center gap-3">
            <button aria-label="Back to profile" onClick={onClose}>
              <ArrowLeft />
            </button>
            All media
          </DialogTitle>
        </DialogHeader>
        <div
          role="tablist"
          aria-label="Shared content"
          className="flex border-b shrink-0"
        >
          {(["media", "documents", "links"] as const).map(c => (
            <button
              key={c}
              role="tab"
              aria-selected={category === c}
              onClick={() => {
                setCategory(c);
                setSelected(null);
              }}
              className={`flex-1 p-3 capitalize border-b-2 ${category === c ? "border-sky-500 text-sky-600" : "border-transparent"}`}
            >
              {c}
            </button>
          ))}
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-2">
          {query.isLoading && <p className="p-4">Loading…</p>}
          {query.error && <p role="alert">{query.error.message}</p>}
          {!query.isLoading && !query.error && items.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">
              No shared {category} available.
            </p>
          )}
          {active ? (
            <div className="space-y-4 p-3">
              <Button variant="outline" onClick={() => setSelected(null)}>
                Back to media
              </Button>
              <MediaContent {...active} />
            </div>
          ) : (
            <div
              className={
                category === "media" ? "grid grid-cols-4 gap-1" : "space-y-3"
              }
            >
              {items.map((m, i) => {
                const month = new Date(m.createdAt).toLocaleDateString(
                  undefined,
                  { month: "long", year: "numeric" }
                );
                const previous = i
                  ? new Date(items[i - 1].createdAt).toLocaleDateString(
                      undefined,
                      { month: "long", year: "numeric" }
                    )
                  : "";
                return (
                  <div
                    key={m.id}
                    className={category === "media" ? "contents" : ""}
                  >
                    {month !== previous && (
                      <h3 className="col-span-4 font-medium py-3 px-1">
                        {month}
                      </h3>
                    )}
                    {category === "media" ? (
                      <button
                        aria-label={`Open ${m.type}`}
                        onClick={() => setSelected(m.id)}
                      >
                        <Thumbnail mediaUrl={m.mediaUrl} type={m.type} />
                      </button>
                    ) : category === "documents" ? (
                      <div className="border rounded-lg p-3">
                        <MediaContent {...m} />
                      </div>
                    ) : (
                      <div className="border rounded-lg p-3 break-words">
                        {Array.from(
                          new Set(
                            m.content?.match(/https?:\/\/[^\s<>"']+/gi) ?? []
                          )
                        ).map(url => (
                          <a
                            key={url}
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block text-sky-600 underline py-2"
                          >
                            {url}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {query.hasNextPage && !active && (
            <Button
              className="w-full mt-4"
              variant="outline"
              disabled={query.isFetchingNextPage}
              onClick={() => void query.fetchNextPage()}
            >
              Load older items
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
