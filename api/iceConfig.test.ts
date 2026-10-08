import { afterEach, expect, it, vi } from "vitest";
import { getIceConfig } from "./iceConfig";
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
it("does not claim relay availability without credentials", async () => {
  vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "");
  vi.stubEnv("TURN_URL", "");
  expect((await getIceConfig(9001)).relayConfigured).toBe(false);
});
it("generates short-lived credentials server-side and filters blocked ports", async () => {
  vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "key");
  vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "private-key");
  const fetch = vi
    .fn()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          iceServers: [
            {
              urls: [
                "turn:turn.cloudflare.com:3478?transport=udp",
                "turn:turn.cloudflare.com:53",
              ],
              username: "short-user",
              credential: "short-password",
            },
          ],
        })
      )
    );
  vi.stubGlobal("fetch", fetch);
  const result = await getIceConfig(9002);
  expect(result.relayConfigured).toBe(true);
  expect(JSON.stringify(result)).not.toContain("private-key");
  expect(JSON.stringify(result)).not.toContain(":53");
  await getIceConfig(9002);
  expect(fetch).toHaveBeenCalledTimes(1);
});
it("reports unavailable if the configured relay rejects credential generation", async () => {
  vi.stubEnv("CLOUDFLARE_TURN_KEY_ID", "key");
  vi.stubEnv("CLOUDFLARE_TURN_API_TOKEN", "private-key");
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue(new Response("denied", { status: 401 }))
  );
  expect((await getIceConfig(9003)).relayConfigured).toBe(false);
});
