import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { createPool, type Pool, type RowDataPacket } from "mysql2/promise";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { and, eq } from "drizzle-orm";
import * as schema from "../db/schema";
import * as relations from "../db/relations";
import {
  acknowledgeMessages,
  consumeAfterView,
  createRecipientSnapshot,
  getVisibleMessage,
  getVisibleMessages,
  retentionDeadlineForSend,
} from "./retention";
import { runCleanupOnce } from "./expiration";
import { storage } from "./lib/storage";
import { createSession } from "./auth";
import { appRouter } from "./router";

// Only the connection factory and file deletion adapter are replaced.
// Queries, transactions, authentication, routers and MySQL are real.
vi.mock("./queries/connection", () => ({ getDb: () => db }));
vi.mock("./lib/storage", async importOriginal => {
  const original = await importOriginal<typeof import("./lib/storage")>();
  return {
    ...original,
    storage: {
      ...original.storage,
      uploadFile: original.storage.uploadFile.bind(original.storage),
      headFile: original.storage.headFile.bind(original.storage),
      readFile: original.storage.readFile.bind(original.storage),
      deleteFile: vi.fn(async () => true),
      listFiles: vi.fn(async () => ({ objects: [] })),
    },
  };
});

let pool: Pool | undefined;
const fullSchema = { ...schema, ...relations };
let db: MySql2Database<typeof fullSchema>;
let sender: number;
let recipient: number;
let other: number;

beforeAll(async () => {
  // Fail closed; never fall back to DATABASE_URL or migrate an existing database.
  const raw = process.env.TEST_DATABASE_URL;
  if (!raw)
    throw new Error(
      "TEST_DATABASE_URL must point to a new disposable local MySQL database"
    );
  const url = new URL(raw);
  if (
    url.protocol !== "mysql:" ||
    !["localhost", "127.0.0.1"].includes(url.hostname) ||
    url.pathname !== "/quick_chat_test" ||
    url.username !== "quick_chat_ci"
  ) {
    throw new Error(
      "Integration tests require localhost/quick_chat_test and the quick_chat_ci user"
    );
  }
  pool = createPool({ uri: raw, connectionLimit: 10, timezone: "Z" });
  const [tables] = await pool.query<RowDataPacket[]>("SHOW TABLES");
  if (tables.length)
    throw new Error(
      "Refusing to modify a non-empty database; create a fresh test container"
    );
  db = drizzle(pool, { schema: fullSchema, mode: "planetscale" });
  await migrate(db, { migrationsFolder: "./db/migrations" });
  const ids = await db
    .insert(schema.users)
    .values([
      { name: "Sender", phone: "+12025550101", username: "sender_test" },
      { name: "Recipient", phone: "+12025550102", username: "recipient_test" },
      { name: "Other", phone: "+12025550103" },
    ])
    .$returningId();
  [sender, recipient, other] = ids.map(row => row.id);
});

afterAll(async () => {
  await pool?.end();
});
beforeEach(() => {
  vi.mocked(storage.deleteFile).mockReset().mockResolvedValue(true);
});

async function fixture(mode = "24h", recipients = [recipient]) {
  const [{ id: conversationId }] = await db
    .insert(schema.conversations)
    .values({ type: "group", createdBy: sender })
    .$returningId();
  await db.insert(schema.conversationParticipants).values([
    { conversationId, userId: sender, role: "owner" as const },
    ...recipients.map(userId => ({
      conversationId,
      userId,
      role: "member" as const,
    })),
  ]);
  const [{ id }] = await db
    .insert(schema.messages)
    .values({
      conversationId,
      senderId: sender,
      content: "private fixture",
      expirationMode: mode,
      retentionDeadline: retentionDeadlineForSend(),
    })
    .$returningId();
  await createRecipientSnapshot(id, recipients);
  return { id, conversationId };
}

async function receipt(id: number, userId = recipient) {
  const [row] = await db
    .select()
    .from(schema.messageReceipts)
    .where(
      and(
        eq(schema.messageReceipts.messageId, id),
        eq(schema.messageReceipts.userId, userId)
      )
    );
  return row;
}

async function caller(userId: number) {
  const { token } = await createSession(userId);
  return appRouter.createCaller({
    req: new Request("http://localhost/api/trpc", {
      headers: { authorization: `Bearer ${token}` },
    }),
    resHeaders: new Headers(),
  });
}

describe("Phone-required access and exact contact search", () => {
  it("enforces username discovery while preserving exact phone lookup", async () => {
    const client = await caller(sender);
    try {
      await db
        .update(schema.users)
        .set({ privacy: JSON.stringify({ usernameSearch: "nobody" }) })
        .where(eq(schema.users.id, recipient));
      expect(
        await client.users.search({ query: "recipient_test" })
      ).toHaveLength(0);
      expect(
        (await client.messages.search({ query: "recipient_test" })).users
      ).toHaveLength(0);
      expect(await client.users.search({ query: "+12025550102" })).toHaveLength(
        1
      );
      await db
        .update(schema.users)
        .set({
          privacy: JSON.stringify({ usernameSearch: "friends_of_friends" }),
        })
        .where(eq(schema.users.id, recipient));
      await db.insert(schema.contacts).values([
        { ownerId: sender, contactUserId: other },
        { ownerId: other, contactUserId: recipient },
      ]);
      expect(
        await client.users.search({ query: "recipient_test" })
      ).toHaveLength(0);
      await db.insert(schema.contacts).values([
        { ownerId: other, contactUserId: sender },
        { ownerId: recipient, contactUserId: other },
      ]);
      expect(
        await client.users.search({ query: "recipient_test" })
      ).toHaveLength(1);
    } finally {
      await db
        .update(schema.users)
        .set({ privacy: null })
        .where(eq(schema.users.id, recipient));
      await db.delete(schema.contacts);
    }
  });
  it("sends an individual view-once photo without changing the chat timer and rejects reopening", async () => {
    const { conversationId } = await fixture("24h");
    const owner = await caller(sender),
      viewer = await caller(recipient);
    const media = await owner.media.upload({
      name: "test.gif",
      contentType: "image/gif",
      contentBase64: "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
    });
    const sent = await owner.messages.send({
      conversationId,
      type: "image",
      mediaUrl: media.key,
      viewOnce: true,
    });
    const [row] = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, sent.id));
    expect(row.expirationMode).toBe("after_view");
    const first = await viewer.messages.reveal({ messageId: sent.id });
    expect(first.attachment?.contentType).toBe("image/gif");
    await expect(
      viewer.messages.reveal({ messageId: sent.id })
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
    const normal = await owner.messages.send({
      conversationId,
      type: "text",
      content: "regular",
    });
    const [normalRow] = await db
      .select()
      .from(schema.messages)
      .where(eq(schema.messages.id, normal.id));
    expect(normalRow.expirationMode).toBe("24h");
    await expect(
      owner.messages.send({
        conversationId,
        type: "text",
        content: "invalid",
        viewOnce: true,
      })
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
  it("denies email-only sessions access to chats and calls but permits phone migration", async () => {
    const [{ id }] = await db
      .insert(schema.users)
      .values({ name: "Legacy", email: "legacy@example.test" })
      .$returningId();
    const legacy = await caller(id);
    expect((await legacy.users.me()).phone).toBeNull();
    await expect(legacy.conversations.list()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(legacy.calls.history()).rejects.toMatchObject({
      code: "FORBIDDEN",
    });
    await expect(
      legacy.users.search({ query: "recipient_test" })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("returns only exact identities and respects blocking in both search endpoints", async () => {
    const client = await caller(sender);
    expect(await client.users.search({ query: "Recip" })).toHaveLength(0);
    expect(await client.users.search({ query: "Recipient" })).toHaveLength(0);
    expect(await client.users.search({ query: "recipient%" })).toHaveLength(0);
    expect(
      (await client.users.search({ query: "@RECIPIENT_TEST" })).map(u => u.id)
    ).toEqual([recipient]);
    expect(
      (await client.users.search({ query: "+1 202 555 0102" })).map(u => u.id)
    ).toEqual([recipient]);
    await db
      .insert(schema.blockedUsers)
      .values({ blockerId: recipient, blockedId: sender });
    try {
      expect(
        await client.users.search({ query: "recipient_test" })
      ).toHaveLength(0);
      expect(
        (await client.messages.search({ query: "recipient_test" })).users
      ).toHaveLength(0);
    } finally {
      await db
        .delete(schema.blockedUsers)
        .where(
          and(
            eq(schema.blockedUsers.blockerId, recipient),
            eq(schema.blockedUsers.blockedId, sender)
          )
        );
    }
  });
});

describe("MySQL retention and authorization", () => {
  it("serializes concurrent call starts and does not starve peer signals behind own candidates", async () => {
    const a = await caller(sender),
      b = await caller(recipient);
    const conversation = await a.conversations.createDirect({
      userId: recipient,
    });
    const input = {
      calleeId: recipient,
      conversationId: conversation.id,
      type: "voice" as const,
      offerSdp: "test-offer",
    };
    const attempts = await Promise.allSettled([
      a.calls.start(input),
      a.calls.start(input),
    ]);
    const successful = attempts.filter(
      (r): r is PromiseFulfilledResult<{ id: number }> =>
        r.status === "fulfilled"
    );
    expect(successful).toHaveLength(1);
    expect(attempts.filter(r => r.status === "rejected")).toHaveLength(1);
    const id = successful[0].value.id;
    try {
      await db.insert(schema.callSignals).values(
        Array.from({ length: 105 }, () => ({
          callId: id,
          fromUserId: sender,
          kind: "candidate",
          payload: "{}",
        }))
      );
      await b.calls.signal({
        callId: id,
        kind: "control",
        payload: JSON.stringify({ held: true }),
      });
      const signals = await a.calls.signals({ callId: id, afterId: 0 });
      expect(signals).toHaveLength(1);
      expect(signals[0].kind).toBe("control");
      const accepts = await Promise.allSettled([
        b.calls.accept({ id, answerSdp: "first" }),
        b.calls.accept({ id, answerSdp: "second" }),
      ]);
      expect(accepts.filter(r => r.status === "fulfilled")).toHaveLength(1);
    } finally {
      await a.calls.end({ id });
    }
  });
  it("denies outsiders across list, search, star and reply operations", async () => {
    const { id, conversationId } = await fixture();
    expect(await getVisibleMessage(id, other)).toBeNull();
    expect(await getVisibleMessages(conversationId, other)).toEqual([]);
    const outsider = await caller(other);
    await expect(
      outsider.messages.list({ conversationId })
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      outsider.messages.star({ messageId: id, starred: true })
    ).rejects.toBeDefined();
    expect(
      await outsider.messages.search({ query: "private fixture" })
    ).toEqual({ messages: [], users: [] });
    await expect(
      outsider.messages.send({
        conversationId,
        type: "text",
        content: "reply",
        replyToId: id,
      })
    ).rejects.toBeDefined();
  });

  it("does not grant historical content to a newly added member", async () => {
    const { id, conversationId } = await fixture();
    await (
      await caller(sender)
    ).conversations.addMember({ id: conversationId, userId: other });
    expect(await getVisibleMessage(id, other)).toBeNull();
  });

  it("does not resurrect content after removal and rejoin", async () => {
    const { id, conversationId } = await fixture();
    const owner = await caller(sender);
    await owner.conversations.removeMember({
      id: conversationId,
      userId: recipient,
    });
    await owner.conversations.addMember({
      id: conversationId,
      userId: recipient,
    });
    expect((await receipt(id)).consumedAt).not.toBeNull();
    expect(await getVisibleMessage(id, recipient)).toBeNull();
  });

  it("clear cutoff denies older messages", async () => {
    const { id, conversationId } = await fixture();
    await db
      .update(schema.conversationParticipants)
      .set({ clearedAt: new Date(Date.now() + 1000) })
      .where(
        and(
          eq(schema.conversationParticipants.conversationId, conversationId),
          eq(schema.conversationParticipants.userId, recipient)
        )
      );
    expect(await getVisibleMessage(id, recipient)).toBeNull();
  });

  it("recipient expiry is independent and sender access ends when all recipients expire", async () => {
    const { id } = await fixture("1h", [recipient, other]);
    await db
      .update(schema.messageReceipts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(
        and(
          eq(schema.messageReceipts.messageId, id),
          eq(schema.messageReceipts.userId, recipient)
        )
      );
    expect(await getVisibleMessage(id, recipient)).toBeNull();
    expect(await getVisibleMessage(id, other)).not.toBeNull();
    expect(await getVisibleMessage(id, sender)).not.toBeNull();
    await db
      .update(schema.messageReceipts)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(schema.messageReceipts.messageId, id));
    expect(await getVisibleMessage(id, sender)).toBeNull();
  });

  it("repeated view acknowledgements preserve the first deadline", async () => {
    const { id } = await fixture("1h");
    await acknowledgeMessages([id], recipient, "viewed");
    const first = await receipt(id);
    expect(first.expiresAt!.getTime() - first.viewedAt!.getTime()).toBe(
      3600000
    );
    await acknowledgeMessages([id, id], recipient, "viewed");
    expect(await receipt(id)).toEqual(first);
  });

  it("ordinary viewed ACK cannot consume view-once content", async () => {
    const { id } = await fixture("after_view");
    await acknowledgeMessages([id], recipient, "viewed");
    const row = await receipt(id);
    expect(row.deliveredAt).not.toBeNull();
    expect(row.viewedAt).toBeNull();
    expect(row.consumedAt).toBeNull();
  });

  it("concurrent view-once reveals have exactly one winner", async () => {
    const { id } = await fixture("after_view");
    const results = await Promise.all(
      Array.from({ length: 20 }, () => consumeAfterView(id, recipient))
    );
    expect(results.filter(Boolean)).toHaveLength(1);
    expect(await consumeAfterView(id, recipient)).toBeNull();
    expect(await getVisibleMessage(id, recipient)).toBeNull();
  });

  it("hard expiry denies both sender and recipient without waiting for cleanup", async () => {
    const { id } = await fixture();
    await db
      .update(schema.messages)
      .set({ retentionDeadline: new Date(Date.now() - 1000) })
      .where(eq(schema.messages.id, id));
    expect(await getVisibleMessage(id, sender)).toBeNull();
    expect(await getVisibleMessage(id, recipient)).toBeNull();
  });

  it("late viewing cannot extend the hard retention deadline", async () => {
    const { id } = await fixture("24h");
    const deadline = new Date(Math.floor(Date.now() / 1000) * 1000 + 60000);
    await db
      .update(schema.messages)
      .set({ retentionDeadline: deadline })
      .where(eq(schema.messages.id, id));
    await acknowledgeMessages([id], recipient, "viewed");
    expect((await receipt(id)).expiresAt).toEqual(deadline);
  });

  it("cleanup retries failed media deletion before removing DB references", async () => {
    const { id } = await fixture();
    await db
      .update(schema.messages)
      .set({
        retentionDeadline: new Date(Date.now() - 1000),
        mediaUrl: "chat/u1/test-fixture",
      })
      .where(eq(schema.messages.id, id));
    await db
      .insert(schema.starredMessages)
      .values({ messageId: id, userId: recipient });
    await db
      .insert(schema.messageReactions)
      .values({ messageId: id, userId: recipient, emoji: "👍" });
    vi.mocked(storage.deleteFile).mockResolvedValue(false);
    await expect(runCleanupOnce()).rejects.toThrow("Media cleanup failed");
    expect(
      await db.select().from(schema.messages).where(eq(schema.messages.id, id))
    ).toHaveLength(1);
    expect(await getVisibleMessage(id, recipient)).toBeNull();
    vi.mocked(storage.deleteFile).mockResolvedValue(true);
    await runCleanupOnce();
    expect(
      await db.select().from(schema.messages).where(eq(schema.messages.id, id))
    ).toHaveLength(0);
    expect(await receipt(id)).toBeUndefined();
    expect(
      await db
        .select()
        .from(schema.starredMessages)
        .where(eq(schema.starredMessages.messageId, id))
    ).toHaveLength(0);
    expect(
      await db
        .select()
        .from(schema.messageReactions)
        .where(eq(schema.messageReactions.messageId, id))
    ).toHaveLength(0);
    await expect(runCleanupOnce()).resolves.toBeUndefined();
  });
});
