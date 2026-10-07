import { it, expect, vi } from "vitest";
import { IceQueue } from "../src/lib/iceQueue";
it("retains early candidates until SDP is ready and applies each once in order", async () => {
  const addIceCandidate = vi.fn(async () => {});
  const pc = {
    remoteDescription: null,
    signalingState: "stable",
    connectionState: "new",
    addIceCandidate,
  } as Parameters<IceQueue["flush"]>[0];
  const queue = new IceQueue();
  queue.add({ candidate: "one" });
  queue.add({ candidate: "two" });
  await queue.flush(pc);
  expect(addIceCandidate).not.toHaveBeenCalled();
  Object.defineProperty(pc, "remoteDescription", {
    value: { type: "answer" },
    configurable: true,
  });
  await Promise.all([queue.flush(pc), queue.flush(pc)]);
  expect(addIceCandidate.mock.calls).toEqual([
    [{ candidate: "one" }],
    [{ candidate: "two" }],
  ]);
});
