"use client";

import { toast } from "sonner";

export type NotificationKind = "success" | "error" | "warning" | "info";

export type Notification = {
  /** Stable action key used to replace duplicate notifications. */
  id: string;
  title: string;
  description?: string;
};

const unsafeMessagePattern =
  /(?:\bat\s+\S+\s*\([^)]*:\d+:\d+\)|(?:api[_ -]?key|authorization|bearer|password|secret|token)\s*[:=]|postgres(?:ql)?:\/\/|openai|s3|aws)/i;

export function safeNotificationMessage(
  value: unknown,
  fallback: string,
): string {
  if (typeof value !== "string") return fallback;

  const message = value.replace(/\s+/g, " ").trim();
  if (!message || message.length > 240 || unsafeMessagePattern.test(message)) {
    return fallback;
  }

  return message;
}

function show(kind: NotificationKind, notification: Notification) {
  const options = {
    id: `app:${notification.id}`,
    description: notification.description,
    duration: kind === "error" || kind === "warning" ? 8_000 : 6_000,
  };

  return toast[kind](notification.title, options);
}

export const notifications = {
  success: (notification: Notification) => show("success", notification),
  error: (notification: Notification) => show("error", notification),
  warning: (notification: Notification) => show("warning", notification),
  info: (notification: Notification) => show("info", notification),
  dismiss: (id: string) => toast.dismiss(`app:${id}`),
};
