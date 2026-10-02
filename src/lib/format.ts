export function formatTime(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDay(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return formatTime(date);
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  if (now.getTime() - date.getTime() < 7 * 86400_000)
    return date.toLocaleDateString([], { weekday: "short" });
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

/** Server-authoritative countdown text for the 12h window. */
export function expiryCountdown(expiresAt: Date | string | null | undefined): string | null {
  if (!expiresAt) return null;
  const ms = new Date(expiresAt).getTime() - Date.now();
  if (ms <= 0) return "Expired";
  const totalMin = Math.floor(ms / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `Chat expires in ${h}h ${m}m`;
  return `Chat expires in ${Math.max(1, m)}m`;
}

export function formatLastSeen(d: Date | string | null | undefined): string {
  if (!d) return "";
  const date = new Date(d);
  const diff = Date.now() - date.getTime();
  if (diff < 60_000) return "last seen just now";
  if (diff < 3600_000) return `last seen ${Math.floor(diff / 60000)}m ago`;
  const sameDay = date.toDateString() === new Date().toDateString();
  if (sameDay) return `last seen today at ${formatTime(date)}`;
  return `last seen ${date.toLocaleDateString([], { month: "short", day: "numeric" })}`;
}

export function isOnline(d: Date | string | null | undefined): boolean {
  if (!d) return false;
  return Date.now() - new Date(d).getTime() < 60_000;
}

export function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] || "?") + (parts[1]?.[0] || "")).toUpperCase();
}

export async function fileToBase64(file: Blob): Promise<string> {
  const buf = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}
