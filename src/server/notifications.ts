import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Executor } from "./db/client";
import { notifications } from "./db/schema";

export async function notify(db: Executor, userId: string, message: { title: string; body: string; link?: string | null; channel?: "inbox" | "whatsapp" | "sms" }) {
  await db.insert(notifications).values({ userId, channel: message.channel ?? "inbox", title: message.title, body: message.body, link: message.link ?? null });
}

export async function listNotifications(db: Executor, userId: string, limit = 30) {
  return db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt)).limit(limit);
}

export async function markAllRead(db: Executor, userId: string) {
  await db.update(notifications).set({ readAt: new Date() }).where(and(eq(notifications.userId, userId), isNull(notifications.readAt)));
}
