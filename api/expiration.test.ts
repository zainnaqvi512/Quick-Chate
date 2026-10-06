import { describe, it, expect } from "vitest";
import { viewingDeadline, retentionDeadlineForSend, receiptIsLive, UNREAD_CAP_MS } from "./retention";
const sent = new Date("2026-10-06T00:00:00Z");
const cap = retentionDeadlineForSend(sent);
describe("per-recipient message expiration", () => {
  it("unread messages have a finite seven-day cap", () => {
    expect(cap.getTime() - sent.getTime()).toBe(7 * 24 * 3600000);
    expect(UNREAD_CAP_MS).toBe(604800000);
    expect(receiptIsLive({ expiresAt: null, consumedAt: null }, cap, new Date(cap.getTime() - 1))).toBe(true);
    expect(receiptIsLive({ expiresAt: null, consumedAt: null }, cap, cap)).toBe(false);
  });
  it.each([["1h", 1], ["12h", 12], ["24h", 24]] as const)("%s starts at viewing, not sending", (mode, hours) => {
    const viewed = new Date(sent.getTime() + 10000);
    expect(viewingDeadline(mode, viewed, cap).getTime()).toBe(viewed.getTime() + hours * 3600000);
  });
  it("a late view never extends the hard cap", () => {
    expect(viewingDeadline("24h", new Date(cap.getTime() - 1000), cap)).toEqual(cap);
  });
  it("after-view consumes access at the exact acknowledgement time", () => {
    const expiresAt = viewingDeadline("after_view", sent, cap);
    expect(receiptIsLive({ expiresAt, consumedAt: sent }, cap, sent)).toBe(false);
  });
  it("one group recipient expiring does not prematurely expire another", () => {
    const a = viewingDeadline("1h", sent, cap);
    const b = viewingDeadline("1h", new Date(sent.getTime() + 30000), cap);
    expect(receiptIsLive({ expiresAt: a, consumedAt: null }, cap, a)).toBe(false);
    expect(receiptIsLive({ expiresAt: b, consumedAt: null }, cap, a)).toBe(true);
  });
  it("consumption overrides even a future deadline", () => {
    expect(receiptIsLive({ expiresAt: cap, consumedAt: sent }, cap, sent)).toBe(false);
  });
  it("unknown legacy policies get the 24-hour default, not indefinite retention", () => {
    expect(viewingDeadline("legacy", sent, cap).getTime() - sent.getTime()).toBe(86400000);
  });
});
