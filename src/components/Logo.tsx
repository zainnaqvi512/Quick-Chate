export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-label="Quick Chat logo" role="img">
      <defs>
        <linearGradient id="qc-g" x1="0" y1="0" x2="48" y2="48">
          <stop stopColor="#38BDF8" />
          <stop offset="1" stopColor="#0284C7" />
        </linearGradient>
      </defs>
      <path
        d="M24 4C12.95 4 4 12.06 4 22.1c0 5.5 2.7 10.44 7.03 13.86L9.6 44l9.2-3.4c1.66.36 3.4.55 5.2.55 11.05 0 20-8.06 20-18.05S35.05 4 24 4Z"
        fill="url(#qc-g)"
      />
      <path
        d="M27.6 12.5 16.8 24.4h6.1l-3.3 11.1 11.6-13.1h-6.3l2.7-9.9Z"
        fill="#fff"
        stroke="#fff"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
    </svg>
  );
}

import { trpc } from "@/providers/trpc";

export function Avatar({
  name,
  url,
  size = 40,
  online,
}: {
  name: string;
  url?: string | null;
  size?: number;
  online?: boolean;
}) {
  const isKey = !!url && !/^https?:|^data:/.test(url);
  const urlQuery = trpc.media.url.useQuery({ key: url ?? "" }, { enabled: isKey, staleTime: 8 * 60_000 });
  const src = isKey ? (urlQuery.data?.url ?? null) : (url ?? null);
  const text = name
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {src ? (
        <img src={src} alt={name} className="rounded-full object-cover w-full h-full" />
      ) : (
        <div
          className="rounded-full flex items-center justify-center text-white font-semibold w-full h-full"
          style={{
            background: "linear-gradient(135deg, #38BDF8, #0284C7)",
            fontSize: size * 0.36,
          }}
        >
          {text || "?"}
        </div>
      )}
      {online !== undefined && (
        <span
          className={`absolute bottom-0 right-0 block rounded-full ring-2 ring-card ${
            online ? "bg-emerald-500" : "bg-muted-foreground/40"
          }`}
          style={{ width: size * 0.28, height: size * 0.28 }}
        />
      )}
    </div>
  );
}
