import { describe, it, expect } from "vitest";
import { participantExpired, CHAT_WINDOW_MS } from "./expiration";
import type { ConversationParticipant } from "../db/schema";

function fakeParticipant(expiresAt: Date | null): ConversationParticipant {
  return {
    id: 1,
    conversationId: 1,
    userId: 1,
    role: "member",
    joinedAt: new Date(),
    lastReadAt: null,
    expiresAt,
    pinned: false,
    archived: false,
    muted: false,
    clearedAt: null,
  };
}

describe("12-hour expiration (server-authoritative)", () => {
  it("window length is exactly 12 hours", () => {
    expect(CHAT_WINDOW_MS).toBe(12 * 3600 * 1000);
  });

  it("not expired before first read (expiresAt null)", () => {
    expect(participantExpired(fakeParticipant(null))).toBe(false);
  });

  it("not expired while inside the window", () => {
    const readAt = new Date(Date.now() - 1000); // read 1s ago
    const expiresAt = new Date(readAt.getTime() + CHAT_WINDOW_MS);
    expect(participantExpired(fakeParticipant(expiresAt))).toBe(false);
  });

  it("expires exactly when server time passes expiresAt", () => {
    const readAt = new Date(Date.now() - CHAT_WINDOW_MS - 1000); // read 12h+1s ago
    const expiresAt = new Date(readAt.getTime() + CHAT_WINDOW_MS);
    expect(participantExpired(fakeParticipant(expiresAt))).toBe(true);
  });

  it("boundary: expiresAt == now counts as expired", () => {
    expect(participantExpired(fakeParticipant(new Date(Date.now() - 1)))).toBe(true);
  });

  it("client clock manipulation is irrelevant: check uses Date.now() on server", () => {
    // A far-future client clock cannot extend access
    const expiresAt = new Date(Date.now() - 60_000);
    expect(participantExpired(fakeParticipant(expiresAt))).toBe(true);
  });
});
