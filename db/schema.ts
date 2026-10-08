import {
  mysqlTable,
  mysqlEnum,
  serial,
  varchar,
  text,
  timestamp,
  int,
  boolean,
  bigint,
  uniqueIndex,
  index,
} from "drizzle-orm/mysql-core";

// ---------- Users ----------
export const users = mysqlTable(
  "users",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 32 }).unique(), // Optional E.164 phone
    email: varchar("email", { length: 254 }).unique(),
    passwordHash: varchar("password_hash", { length: 255 }),
    username: varchar("username", { length: 32 }).unique(),
    countryCode: varchar("country_code", { length: 8 }).notNull().default("+1"),
    name: varchar("name", { length: 128 }).notNull().default(""),
    avatarUrl: text("avatar_url"),
    about: varchar("about", { length: 512 })
      .notNull()
      .default("Hey there! I am using Quick Chat."),
    lastSeenAt: timestamp("last_seen_at"),
    // privacy settings JSON: { lastSeen, avatar, about, status, readReceipts }
    privacy: text("privacy"),
    // notification settings JSON: { messages, groups, calls, sounds }
    notifySettings: text("notify_settings"),
    profileComplete: boolean("profile_complete").notNull().default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [index("idx_users_phone").on(t.phone)]
);

export const phoneVerifications = mysqlTable(
  "phone_verifications",
  {
    id: serial("id").primaryKey(),
    phone: varchar("phone", { length: 32 }).notNull().unique(),
    otpHash: varchar("otp_hash", { length: 128 }).notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    attempts: int("attempts").notNull().default(0),
    lastSentAt: timestamp("last_sent_at").notNull().defaultNow(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [index("idx_pv_phone").on(t.phone)]
);

export const sessions = mysqlTable(
  "sessions",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    tokenHash: varchar("token_hash", { length: 128 }).notNull().unique(),
    userAgent: varchar("user_agent", { length: 255 }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  t => [
    index("idx_sessions_user").on(t.userId),
    index("idx_sessions_token").on(t.tokenHash),
  ]
);

// ---------- Contacts ----------
export const contacts = mysqlTable(
  "contacts",
  {
    id: serial("id").primaryKey(),
    ownerId: bigint("owner_id", { mode: "number", unsigned: true }).notNull(),
    contactUserId: bigint("contact_user_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    name: varchar("name", { length: 128 }).notNull().default(""),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [uniqueIndex("uq_contacts_pair").on(t.ownerId, t.contactUserId)]
);

export const blockedUsers = mysqlTable(
  "blocked_users",
  {
    id: serial("id").primaryKey(),
    blockerId: bigint("blocker_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    blockedId: bigint("blocked_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [uniqueIndex("uq_blocked_pair").on(t.blockerId, t.blockedId)]
);

// ---------- Conversations ----------
export const conversations = mysqlTable(
  "conversations",
  {
    id: serial("id").primaryKey(),
    type: mysqlEnum("type", ["direct", "group"]).notNull().default("direct"),
    directKey: varchar("direct_key", { length: 80 }).unique(), // "minId:maxId" for direct dedup
    expirationMode: varchar("expiration_mode", { length: 16 })
      .notNull()
      .default("24h"),
    name: varchar("name", { length: 128 }),
    description: varchar("description", { length: 512 }),
    avatarUrl: text("avatar_url"),
    createdBy: bigint("created_by", { mode: "number", unsigned: true }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [index("idx_conv_direct_key").on(t.directKey)]
);

export const conversationParticipants = mysqlTable(
  "conversation_participants",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversation_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    role: mysqlEnum("role", ["owner", "admin", "member"])
      .notNull()
      .default("member"),
    joinedAt: timestamp("joined_at").notNull().defaultNow(),
    // 12-hour expiration window, per participant (server-authoritative)
    lastReadAt: timestamp("last_read_at"),
    expiresAt: timestamp("expires_at"),
    pinned: boolean("pinned").notNull().default(false),
    archived: boolean("archived").notNull().default(false),
    muted: boolean("muted").notNull().default(false),
    favorite: boolean("favorite").notNull().default(false),
    clearedAt: timestamp("cleared_at"),
  },
  t => [
    uniqueIndex("uq_cp_pair").on(t.conversationId, t.userId),
    index("idx_cp_user").on(t.userId),
    index("idx_cp_expires").on(t.expiresAt),
  ]
);

// ---------- Messages ----------
export const messages = mysqlTable(
  "messages",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversation_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    senderId: bigint("sender_id", { mode: "number", unsigned: true }).notNull(),
    type: mysqlEnum("type", [
      "text",
      "image",
      "video",
      "audio",
      "document",
      "location",
      "contact",
      "gif",
      "sticker",
      "call",
    ])
      .notNull()
      .default("text"),
    content: text("content"),
    mediaUrl: text("media_url"),
    mediaMeta: text("media_meta"), // JSON: { name, size, mime, duration, width, height, lat, lng, ... }
    replyToId: bigint("reply_to_id", { mode: "number", unsigned: true }),
    expirationMode: varchar("expiration_mode", { length: 16 })
      .notNull()
      .default("24h"),
    retentionDeadline: timestamp("retention_deadline").notNull(),
    editedAt: timestamp("edited_at"),
    deletedForEveryone: boolean("deleted_for_everyone")
      .notNull()
      .default(false),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  t => [
    index("idx_msg_conv_created").on(t.conversationId, t.createdAt),
    index("idx_msg_sender").on(t.senderId),
    index("idx_msg_retention").on(t.retentionDeadline),
  ]
);

export const messageReceipts = mysqlTable(
  "message_receipts",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("message_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    deliveredAt: timestamp("delivered_at"),
    viewedAt: timestamp("viewed_at"),
    expiresAt: timestamp("expires_at"),
    consumedAt: timestamp("consumed_at"),
  },
  t => [
    uniqueIndex("uq_receipt_pair").on(t.messageId, t.userId),
    index("idx_receipt_expiry").on(t.expiresAt),
  ]
);

export const messageReactions = mysqlTable(
  "message_reactions",
  {
    id: serial("id").primaryKey(),
    messageId: bigint("message_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    emoji: varchar("emoji", { length: 16 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [
    uniqueIndex("uq_reaction").on(t.messageId, t.userId, t.emoji),
    index("idx_react_msg").on(t.messageId),
  ]
);

export const starredMessages = mysqlTable(
  "starred_messages",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    messageId: bigint("message_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [uniqueIndex("uq_star").on(t.userId, t.messageId)]
);

// ---------- Typing (ephemeral) ----------
export const typingStates = mysqlTable(
  "typing_states",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversation_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  t => [uniqueIndex("uq_typing").on(t.conversationId, t.userId)]
);

// ---------- Status / Stories ----------
export const statuses = mysqlTable(
  "statuses",
  {
    id: serial("id").primaryKey(),
    userId: bigint("user_id", { mode: "number", unsigned: true }).notNull(),
    type: mysqlEnum("type", ["text", "image", "video"])
      .notNull()
      .default("text"),
    content: text("content"),
    mediaUrl: text("media_url"),
    bgColor: varchar("bg_color", { length: 16 }).default("#38BDF8"),
    privacy: mysqlEnum("privacy", ["contacts", "except", "only"])
      .notNull()
      .default("contacts"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    expiresAt: timestamp("expires_at").notNull(), // 24h
  },
  t => [
    index("idx_status_user").on(t.userId),
    index("idx_status_expires").on(t.expiresAt),
  ]
);

export const statusViews = mysqlTable(
  "status_views",
  {
    id: serial("id").primaryKey(),
    statusId: bigint("status_id", { mode: "number", unsigned: true }).notNull(),
    viewerId: bigint("viewer_id", { mode: "number", unsigned: true }).notNull(),
    viewedAt: timestamp("viewed_at").notNull().defaultNow(),
  },
  t => [uniqueIndex("uq_status_view").on(t.statusId, t.viewerId)]
);

// ---------- Calls ----------
export const calls = mysqlTable(
  "calls",
  {
    id: serial("id").primaryKey(),
    conversationId: bigint("conversation_id", {
      mode: "number",
      unsigned: true,
    }),
    callerId: bigint("caller_id", { mode: "number", unsigned: true }).notNull(),
    calleeId: bigint("callee_id", { mode: "number", unsigned: true }).notNull(),
    type: mysqlEnum("type", ["voice", "video"]).notNull().default("voice"),
    status: mysqlEnum("status", [
      "ringing",
      "ongoing",
      "ended",
      "missed",
      "rejected",
    ])
      .notNull()
      .default("ringing"),
    offerSdp: text("offer_sdp"),
    answerSdp: text("answer_sdp"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    answeredAt: timestamp("answered_at"),
    endedAt: timestamp("ended_at"),
  },
  t => [
    index("idx_calls_caller").on(t.callerId),
    index("idx_calls_callee").on(t.calleeId),
  ]
);

export const callSignals = mysqlTable(
  "call_signals",
  {
    id: serial("id").primaryKey(),
    callId: bigint("call_id", { mode: "number", unsigned: true }).notNull(),
    fromUserId: bigint("from_user_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    kind: varchar("kind", { length: 16 }).notNull(), // 'candidate'
    payload: text("payload").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [index("idx_signals_call").on(t.callId, t.id)]
);

// ---------- Types ----------
export type User = typeof users.$inferSelect;
export type Conversation = typeof conversations.$inferSelect;
export type ConversationParticipant =
  typeof conversationParticipants.$inferSelect;
export type Message = typeof messages.$inferSelect;
export type Call = typeof calls.$inferSelect;
export type Status = typeof statuses.$inferSelect;

export const userReports = mysqlTable(
  "user_reports",
  {
    id: serial("id").primaryKey(),
    reporterId: bigint("reporter_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    reportedId: bigint("reported_id", {
      mode: "number",
      unsigned: true,
    }).notNull(),
    reason: varchar("reason", { length: 1000 }).notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  t => [uniqueIndex("uq_report_pair").on(t.reporterId, t.reportedId)]
);
