import { createRouter, publicQuery } from "./middleware";
import { authRouter } from "./authRouter";
import { usersRouter } from "./usersRouter";
import { contactsRouter } from "./contactsRouter";
import { conversationsRouter } from "./conversationsRouter";
import { messagesRouter } from "./messagesRouter";
import { statusRouter } from "./statusRouter";
import { callsRouter } from "./callsRouter";
import { mediaRouter } from "./mediaRouter";
import { phoneRouter } from "./phoneRouter";

export const appRouter = createRouter({
  ping: publicQuery.query(() => ({ ok: true, ts: Date.now() })),
  auth: authRouter,
  phone: phoneRouter,
  users: usersRouter,
  contacts: contactsRouter,
  conversations: conversationsRouter,
  messages: messagesRouter,
  status: statusRouter,
  calls: callsRouter,
  media: mediaRouter,
});

export type AppRouter = typeof appRouter;
