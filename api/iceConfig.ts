import { createHmac } from "node:crypto";
import { z } from "zod";
const serverSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
});
type IceServer = z.infer<typeof serverSchema>;
const cache = new Map<number, { expires: number; servers: IceServer[] }>();
export async function getIceConfig(userId: number) {
  const iceServers: IceServer[] = [
    { urls: process.env.STUN_URL || "stun:stun.cloudflare.com:3478" },
  ];
  const key = process.env.CLOUDFLARE_TURN_KEY_ID,
    token = process.env.CLOUDFLARE_TURN_API_TOKEN;
  if (key && token) {
    try {
      let cached = cache.get(userId);
      if (!cached || cached.expires < Date.now()) {
        const response = await fetch(
          `https://rtc.live.cloudflare.com/v1/turn/keys/${encodeURIComponent(key)}/credentials/generate-ice-servers`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ ttl: 3600 }),
            signal: AbortSignal.timeout(8000),
          }
        );
        if (!response.ok) throw new Error("Relay provider unavailable");
        const data = z
          .object({ iceServers: z.array(serverSchema) })
          .parse(await response.json());
        const servers = data.iceServers
          .map(server => ({
            ...server,
            urls: (Array.isArray(server.urls)
              ? server.urls
              : [server.urls]
            ).filter(
              url => /^(stun|turn|turns):/.test(url) && !/:53(?:\?|$)/.test(url)
            ),
          }))
          .filter(s => s.urls.length);
        if (
          !servers.some(
            s =>
              s.urls.some(u => /^turns?:/.test(u)) && s.username && s.credential
          )
        )
          throw new Error("No relay credentials");
        cached = { servers, expires: Date.now() + 300000 };
        if (cache.size >= 500) cache.delete(cache.keys().next().value!);
        cache.set(userId, cached);
      }
      return { iceServers: cached.servers, relayConfigured: true };
    } catch {
      return { iceServers, relayConfigured: false };
    }
  }
  if (process.env.TURN_URL && process.env.TURN_SHARED_SECRET) {
    const username = `${Math.floor(Date.now() / 1000) + 3600}:${userId}`;
    iceServers.push({
      urls: process.env.TURN_URL.split(",")
        .map(s => s.trim())
        .filter(Boolean),
      username,
      credential: createHmac("sha1", process.env.TURN_SHARED_SECRET)
        .update(username)
        .digest("base64"),
    });
    return { iceServers, relayConfigured: true };
  }
  return { iceServers, relayConfigured: false };
}
