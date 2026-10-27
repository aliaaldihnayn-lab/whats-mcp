// What a flow is: a trigger, optional conditions, and a list of actions.
// Everything here is validated with zod, because flows come from the dashboard.

import { z } from "zod";

export const OPS = [
  "contains", "not_contains", "contains_any", "contains_all", "equals", "not_equals", "starts_with", "ends_with",
  "regex", "not_regex", "in", "not_in", "gt", "gte", "lt", "lte", "is_true", "is_false", "is_empty", "not_empty", "yes",
] as const;

export const FIELDS = [
  "text", "sender", "sender_name", "chat", "chat_name", "chat_type", "type", "has_media", "direction",
  "from_owner", "self_chat", "hour", "weekday", "is_first", "is_reply", "length", "tag", "ai",
] as const;

export const Cond = z.object({
  field: z.enum(FIELDS),
  op: z.enum(OPS),
  value: z.union([z.string().max(2000), z.number(), z.boolean()]).optional(),
});
export type Cond = z.infer<typeof Cond>;

const text = z.string().min(1).max(4096);
const aiFields = {
  prompt: z.string().max(4000).default(""),
  model: z.string().max(80).optional(),
  /** claude (default) or the cheap OpenAI-compatible provider set in the environment */
  provider: z.enum(["claude", "cheap"]).optional(),
  context: z.number().int().min(1).max(60).default(12),
  maxTokens: z.number().int().min(64).max(2000).default(500),
  /** chat = the conversation that triggered the flow; recent = every chat with news in the last `hours`. */
  scope: z.enum(["chat", "recent"]).default("chat"),
  hours: z.number().int().min(1).max(168).default(24),
  /** answer from the knowledge base (default: yes for ai_reply, no for ai) */
  knowledge: z.boolean().optional(),
};

export const Action = z.discriminatedUnion("type", [
  z.object({ type: z.literal("reply"), text, quote: z.boolean().default(false) }),
  z.object({ type: z.literal("send"), to: z.string().min(1).max(200), text }),
  z.object({ type: z.literal("react"), emoji: z.string().min(1).max(8) }),
  z.object({ type: z.literal("mark_read") }),
  z.object({ type: z.literal("tag"), tag: z.string().min(1).max(40) }),
  z.object({ type: z.literal("ai_reply"), quote: z.boolean().default(false), ...aiFields }),
  z.object({ type: z.literal("ai"), ...aiFields }),
  z.object({
    type: z.literal("agent"),
    /** extra instructions; for a scheduled flow this IS the task */
    prompt: z.string().max(4000).default(""),
    /** owner-message flows: show the plan and wait for "yes" before using tools */
    confirm: z.boolean().default(true),
    /** connector names to allow; empty = all */
    connectors: z.array(z.string().max(30)).max(10).default([]),
    model: z.string().max(80).optional(),
    provider: z.enum(["claude", "cheap"]).optional(),
    maxTokens: z.number().int().min(256).max(8000).default(2000),
  }),
  z.object({
    type: z.literal("webhook"),
    url: z.string().url().max(500),
    method: z.enum(["POST", "GET"]).default("POST"),
    headers: z.record(z.string().max(80), z.string().max(500)).default({}),
  }),
  z.object({ type: z.literal("stop") }),
]);
export type Action = z.infer<typeof Action>;

const validTz = (tz: string) => {
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
};

export const Trigger = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    direction: z.enum(["in", "out", "any"]).default("in"),
    chats: z.enum(["direct", "group", "both"]).default("direct"),
  }),
  z.object({
    type: z.literal("schedule"),
    everyMinutes: z.number().int().min(5).max(10080).default(1440),
    atHour: z.number().int().min(0).max(23).optional(),
  }),
]);
export type Trigger = z.infer<typeof Trigger>;

export const FlowInput = z.object({
  id: z.string().regex(/^[a-z0-9-]{4,40}$/).optional(),
  name: z.string().trim().min(1).max(80),
  enabled: z.boolean().default(true),
  /** "*" = every number, otherwise one account id (or "official"). */
  account: z.string().min(1).max(30).default("*"),
  trigger: Trigger.default({ type: "message", direction: "in", chats: "direct" }),
  match: z.enum(["all", "any"]).default("all"),
  conditions: z.array(Cond).max(20).default([]),
  actions: z.array(Action).min(1).max(10),
  /** approve = text sends wait in the drafts list; auto = sent at once; dry = only logged. */
  mode: z.enum(["auto", "approve", "dry"]).default("approve"),
  maxAgeMinutes: z.number().int().min(1).max(10080).default(180),
  cooldownSeconds: z.number().int().min(0).max(604800).default(0),
  maxPerHour: z.number().int().min(1).max(1000).default(30),
  stopOnMatch: z.boolean().default(false),
  tz: z.string().max(60).refine(validTz, "unknown time zone").default("Asia/Riyadh"),
});
export type FlowInput = z.infer<typeof FlowInput>;
/** What the dashboard sends: defaults not filled in yet. */
export type FlowDraft = z.input<typeof FlowInput>;

export type Flow = FlowInput & { id: string; createdAt: number; updatedAt: number; /** ignore messages older than this (ms) */ activeFrom: number };

export type Draft = {
  id: string;
  account: string;
  flowId: string;
  flowName: string;
  chat: string;
  chatName?: string;
  text: string;
  replyTo?: string;
  /** what the draft answers, for context in the dashboard */
  about?: { id: string; text?: string; who?: string };
  createdAt: number;
  status: "pending" | "sent" | "rejected" | "failed";
  error?: string;
};

export type LogEntry = {
  t: number;
  account: string;
  flow: string;
  name: string;
  chat: string;
  chatName?: string;
  msg?: string;
  text?: string;
  status: "ok" | "draft" | "dry" | "error" | "skipped";
  note?: string;
  actions: { type: string; ok: boolean; detail?: string }[];
};
