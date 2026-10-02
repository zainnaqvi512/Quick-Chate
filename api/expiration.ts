import { and, eq, inArray, lt, isNull, isNotNull } from "drizzle-orm";
import { getDb } from "./queries/connection";
import {
  conversationParticipants,
  conversations,
  messageReactions,
  messages,
  starredMessages,
  statuses,
  typingStates,
  type ConversationParticipant,
} from "../db/schema";

/** The defining Quick Chat window: 12 hours from server-recorded first read. */
export const CHAT_WINDOW_MS = 12 * 3600 * 1000;
export const STATUS_WINDOW_MS = 24 * 3600 * 1000;

export async function getParticipant(
  conversationId: number,
  userId: number,
): Promise<ConversationParticipant | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(conversationParticipants)
    .where(
      and(
        eq(conversationParticipants.conversationId, conversationId),
        eq(conversationParticipants.userId, userId),
      ),
    )
    .limit(1);
  return rows[0] ?? null;
}

/** Server-authoritative expiration check for a participant's access window. */
export function participantExpired(p: ConversationParticipant | null): boolean {
  if (!p?.expiresAt) return false;
  return new Date(p.expiresAt).getTime() <= Date.now();
}

/**
 * Record a server-side read/open event. The FIRST read starts the 12h window;
 * later reads inside the window only update lastReadAt. Uses a conditional
 * UPDATE (WHERE expiresAt IS NULL) so simultaneous opens from multiple
 * devices cannot race the window start.
 */
export async function markRead(conversationId: number, userId: number) {
  const db = getDb();
  const now = new Date();
  const pair = and(
    eq(conversationParticipants.conversationId, conversationId),
    eq(conversationParticipants.userId, userId),
  );
  // Every read/open refreshes lastReadAt (read receipts are derived from it)
  await db.update(conversationParticipants).set({ lastReadAt: now }).where(pair);
  // First read only: atomically start the 12h window (race-safe across devices)
  await db
    .update(conversationParticipants)
    .set({ expiresAt: new Date(now.getTime() + CHAT_WINDOW_MS) })
    .where(and(pair, isNull(conversationParticipants.expiresAt)));
}

export async function computeExpiresAt(conversationId: number, userId: number): Promise<Date | null> {
  const p = await getParticipant(conversationId, userId);
  return p?.expiresAt ?? null;
}

/**
 * Idempotent cleanup worker. Marks nothing client-side; instead:
 *  - deletes fully-expired conversations' messages/reactions/stars (all participants expired)
 *  - deletes expired statuses (24h)
 *  - clears stale typing states
 * Access revocation itself is enforced lazily on every read path via participantExpired().
 */
export async function runCleanupOnce(): Promise<void> {
  const db = getDb();
  const now = new Date();

  // 1) Expired statuses
  await db.delete(statuses).where(lt(statuses.expiresAt, now));

  // 2) Stale typing states (> 30s)
  await db.delete(typingStates).where(lt(typingStates.updatedAt, new Date(now.getTime() - 30_000)));

  // 3) Conversations where every participant window has expired -> purge content
  const expiredParts = await db
    .select()
    .from(conversationParticipants)
    .where(and(isNotNull(conversationParticipants.expiresAt), lt(conversationParticipants.expiresAt, now)));
  if (expiredParts.length === 0) return;

  const convIds = [...new Set(expiredParts.map((p) => p.conversationId))];
  for (const convId of convIds.slice(0, 200)) {
    const parts = await db
      .select()
      .from(conversationParticipants)
      .where(eq(conversationParticipants.conversationId, convId));
    const allExpired =
      parts.length > 0 &&
      parts.every((p) => p.expiresAt && new Date(p.expiresAt).getTime() <= now.getTime());
    if (!allExpired) continue;
    // Purge messages & dependent rows; keep the (empty) conversation shell
    const msgs = await db.select({ id: messages.id }).from(messages).where(eq(messages.conversationId, convId));
    const ids = msgs.map((m) => m.id);
    if (ids.length > 0) {
      await db.delete(messageReactions).where(inArray(messageReactions.messageId, ids));
      await db.delete(starredMessages).where(inArray(starredMessages.messageId, ids));
      await db.delete(messages).where(inArray(messages.id, ids));
    }
    await db.delete(typingStates).where(eq(typingStates.conversationId, convId));
    await db.delete(conversations).where(eq(conversations.id, convId)).catch(() => {});
    await db.delete(conversationParticipants).where(eq(conversationParticipants.conversationId, convId));
  }
}

let started = false;
export function startCleanupWorker() {
  if (started) return;
  started = true;
  const tick = () => runCleanupOnce().catch((e) => console.error("[cleanup]", e));
  setInterval(tick, 60_000).unref?.();
  setTimeout(tick, 5_000).unref?.();
}
