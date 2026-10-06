import { usePrivateMedia } from "@/lib/media";
import { formatBytes, formatDuration } from "@/lib/format";
import { Download, FileText, Loader2, MapPin } from "lucide-react";

function useMediaUrl(mediaUrl: string | null) {
  return usePrivateMedia(mediaUrl);
}

export function MediaContent({
  type,
  mediaUrl,
  mediaMeta,
  content,
}: {
  type: string;
  mediaUrl: string | null;
  mediaMeta: string | null;
  content: string | null;
}) {
  const { url, loading } = useMediaUrl(mediaUrl);
  const meta = mediaMeta ? safeParse(mediaMeta) : {};

  switch (type) {
    case "sticker": {
      if (content && !mediaUrl)
        return (
          <span className="text-6xl leading-none select-none" role="img" aria-label="sticker">
            {content}
          </span>
        );
      return (
        <div className="max-w-[280px]">
          {url ? (
            <img src={url} alt="sticker" className="w-32 h-32 object-contain" loading="lazy" />
          ) : (
            <span className="text-6xl">{content || "🙂"}</span>
          )}
        </div>
      );
    }
    case "image":
    case "gif":
      return (
        <div className="max-w-[280px]">
          {loading ? (
            <div className="w-64 h-40 flex items-center justify-center bg-muted rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          ) : url ? (
            <a href={url} target="_blank" rel="noreferrer">
              <img
                src={url}
                alt={meta.name || "image"}
                className="rounded-lg object-cover w-full max-h-72"
                loading="lazy"
              />
            </a>
          ) : (
            <p className="text-xs italic">Media unavailable</p>
          )}
          {content && <p className="mt-1 whitespace-pre-wrap">{content}</p>}
        </div>
      );
    case "video":
      return (
        <div className="max-w-[280px]">
          {url ? (
            <video src={url} controls className="rounded-lg w-full max-h-72" preload="metadata" />
          ) : (
            <div className="w-64 h-40 flex items-center justify-center bg-muted rounded-lg">
              <Loader2 className="h-5 w-5 animate-spin" />
            </div>
          )}
          {meta.duration ? <p className="text-xs mt-1 opacity-70">{formatDuration(meta.duration)}</p> : null}
        </div>
      );
    case "audio":
      return <AudioPlayer url={url} duration={meta.duration} />;
    case "document":
      return (
        <a
          href={url ?? "#"}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 bg-black/5 dark:bg-white/10 rounded-lg p-3 min-w-[220px] hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
        >
          <FileText className="h-8 w-8 text-sky-500 shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{meta.name || "Document"}</p>
            <p className="text-xs opacity-70">
              {meta.size ? formatBytes(meta.size) : ""} {meta.mime ? `· ${meta.mime.split("/")[1]?.toUpperCase()}` : ""}
            </p>
          </div>
          <Download className="h-4 w-4 opacity-60 shrink-0" />
        </a>
      );
    case "location": {
      const lat = meta.lat;
      const lng = meta.lng;
      return (
        <a
          href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-3 bg-black/5 dark:bg-white/10 rounded-lg p-3 min-w-[220px] hover:bg-black/10 dark:hover:bg-white/15 transition-colors"
        >
          <MapPin className="h-8 w-8 text-sky-500 shrink-0" />
          <div>
            <p className="text-sm font-medium">Location</p>
            <p className="text-xs opacity-70">
              {Number(lat).toFixed(5)}, {Number(lng).toFixed(5)}
            </p>
          </div>
        </a>
      );
    }
    case "contact":
      return (
        <div className="bg-black/5 dark:bg-white/10 rounded-lg p-3 min-w-[200px]">
          <p className="text-sm font-medium">👤 {meta.name || "Contact"}</p>
          <p className="text-xs opacity-70">{meta.phone}</p>
        </div>
      );
    case "call":
      return <p className="text-sm italic opacity-80">📞 {content || "Call"}</p>;
    default:
      return <p className="whitespace-pre-wrap break-words">{content}</p>;
  }
}

function AudioPlayer({ url, duration }: { url: string | null; duration?: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      {url ? <audio key={url} src={url} controls preload="metadata" aria-label="Voice message" className="max-w-full" /> : <span>Audio unavailable</span>}
      {duration ? <span className="text-xs opacity-70">{formatDuration(duration)}</span> : null}
    </div>
  );
}

function safeParse(s: string): {name?:string;size?:number;mime?:string;duration?:number;lat?:number;lng?:number;phone?:string} {
  try {
    return JSON.parse(s);
  } catch {
    return {};
  }
}
