import { and, eq, lte } from "drizzle-orm";
import { getDb } from "./queries/connection";
import { conversationParticipants, users, conversations, messageReactions, messageReceipts, messages, starredMessages, statuses, statusViews, typingStates, type ConversationParticipant } from "../db/schema";
import { globallyExpiredPredicate } from "./retention";
import { storage } from "./lib/storage";
export const CHAT_WINDOW_MS = 24 * 3600 * 1000;
export const STATUS_WINDOW_MS = 24 * 3600 * 1000;
export async function getParticipant(conversationId: number, userId: number): Promise<ConversationParticipant | null> {
  const rows = await getDb().select().from(conversationParticipants).where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId))).limit(1);
  return rows[0] ?? null;
}
/** Conversation shells never expire; message-level retention replaces old windows. */
export function participantExpired(_p: ConversationParticipant | null): boolean { void _p; return false; }
/** Mark chat unread-state only. Reading a list must NOT acknowledge message visibility. */
export async function markRead(conversationId: number, userId: number) {
  await getDb().update(conversationParticipants).set({ lastReadAt: new Date(), expiresAt: null }).where(and(eq(conversationParticipants.conversationId, conversationId), eq(conversationParticipants.userId, userId)));
}
export async function computeExpiresAt(_conversationId: number, _userId: number): Promise<Date | null> { void _conversationId; void _userId; return null; }

export async function runCleanupOnce(): Promise<void> {
  const db = getDb();
  const now = new Date();
  const expiredStatuses = await db.select().from(statuses).where(lte(statuses.expiresAt, now)).limit(200);
  for (const status of expiredStatuses) {
    if (status.mediaUrl && !await storage.deleteFile({ fileKey: status.mediaUrl })) throw new Error(`Media cleanup failed for status ${status.id}`);
    await db.delete(statusViews).where(eq(statusViews.statusId, status.id));
    await db.delete(statuses).where(eq(statuses.id, status.id));
  }
  await db.delete(typingStates).where(lte(typingStates.updatedAt, new Date(now.getTime() - 30000)));
  const expired = await db.select().from(messages).where(globallyExpiredPredicate(now)).limit(200);
  for (const message of expired) {
    // Keep the DB reference on storage failure so the next tick retries deletion.
    if (message.mediaUrl) {
      const deleted = await storage.deleteFile({ fileKey: message.mediaUrl });
      if (!deleted) throw new Error(`Media cleanup failed for message ${message.id}`);
    }
    await db.transaction(async tx => {
      await tx.delete(messageReactions).where(eq(messageReactions.messageId, message.id));
      await tx.delete(starredMessages).where(eq(starredMessages.messageId, message.id));
      await tx.delete(messageReceipts).where(eq(messageReceipts.messageId, message.id));
      await tx.update(messages).set({ replyToId: null }).where(eq(messages.replyToId, message.id));
      await tx.delete(messages).where(eq(messages.id, message.id));
    });
  }
  // Uploads are temporary until attached. A one-hour grace prevents racing normal sends.
  const { objects } = await storage.listFiles();
  for (const object of objects.filter(o => new Date(o.lastModified).getTime() < now.getTime() - 3600000).slice(0, 200)) {
    const key = object.key;
    const [messageRefs, statusRefs, avatarRefs, groupRefs] = await Promise.all([
      db.select({ id: messages.id }).from(messages).where(eq(messages.mediaUrl, key)).limit(1),
      db.select({ id: statuses.id }).from(statuses).where(eq(statuses.mediaUrl, key)).limit(1),
      db.select({ id: users.id }).from(users).where(eq(users.avatarUrl, key)).limit(1),
      db.select({ id: conversations.id }).from(conversations).where(eq(conversations.avatarUrl, key)).limit(1),
    ]);
    if (!messageRefs.length && !statusRefs.length && !avatarRefs.length && !groupRefs.length) await storage.deleteFile({ fileKey: key });
  }
}
let started = false;
let running = false;
export function startCleanupWorker() {
  if (started) return;
  started = true;
  const tick = async () => {
    if (running) return;
    running = true;
    try { await runCleanupOnce(); } catch (error) { console.error("[cleanup]", error); } finally { running = false; }
  };
  setInterval(tick, 60000).unref?.();
  setTimeout(tick, 5000).unref?.();
}
