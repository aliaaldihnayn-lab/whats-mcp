// MCP tools for the personal (linked-device) mode on Vercel.
// Reads come from the Redis cache, refreshed by a short connection when stale;
// sends open a connection, deliver, and disconnect.

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/server";
import type { Store, StoredMessage } from "../store";
import type { RawKV } from "./auth";
import { isPaired } from "./auth";
import { lastSync, toJid, withWhatsApp } from "./session";

type Deps = { store: Store; raw: RawKV };

const text = (t: string) => ({ content: [{ type: "text" as const, text: t }] });
const json = (v: unknown) => text(JSON.stringify(v, null, 2));
const fail = (t: string) => ({ content: [{ type: "text" as const, text: t }], isError: true });
const errText = (e: unknown) => (e instanceof Error ? e.message : String(e));

const READ = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: true };
const SEND = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true };

const chatArg = z
  .string()
  .describe("chat: a phone number with country code (digits; `+` and spaces are ignored), a `<digits>@s.whatsapp.net` JID, or a group JID ending in `@g.us` (see list_chats)");

const STALE_SECONDS = 120;

function line(m: StoredMessage, chatName?: string) {
  const when = new Date(m.timestamp * 1000).toISOString().replace("T", " ").slice(0, 16);
  const who = m.direction === "out" ? "You" : m.senderName || (m.sender ? `+${m.sender}` : chatName || m.waId);
  const body = m.text ?? m.caption ?? "";
  const media = m.type && ["image", "video", "audio", "document", "sticker"].includes(m.type) ? ` [${m.type}${m.filename ? `: ${m.filename}` : ""}]` : "";
  const reply = m.replyTo ? ` ↩ ${m.replyTo}` : "";
  return `[${when} UTC] ${who}: ${body}${media}${reply}  {id: ${m.id}}`;
}

export function registerPersonalTools(server: McpServer, { store, raw }: Deps) {
  /** Syncs first when the cache is older than STALE_SECONDS (or when forced). */
  async function refresh(force = false): Promise<string> {
    const last = await lastSync(raw);
    const age = last ? Math.floor(Date.now() / 1000) - last : Infinity;
    if (!force && age < STALE_SECONDS) return "";
    try {
      const { ingested } = await withWhatsApp({ raw, store }, async () => null);
      return `(synced: ${ingested} new)`;
    } catch (e) {
      return `(could not sync, showing cached data: ${errText(e)})`;
    }
  }

  async function remember(sent: any, chat: string, partial: Partial<StoredMessage>) {
    if (!sent?.key?.id) return;
    await store.saveMessage({
      id: sent.key.id,
      waId: chat,
      direction: "out",
      type: "text",
      timestamp: Math.floor(Date.now() / 1000),
      status: "sent",
      ...partial,
    });
  }

  server.registerTool(
    "get_status",
    {
      title: "Link status",
      description:
        "Report whether WhatsApp is linked, which number, when messages were last synced and how many chats are cached. Read-only; does not connect. Call first when other tools fail.",
      inputSchema: z.object({}),
      annotations: { ...READ, openWorldHint: false },
    },
    async () => {
      const p = await isPaired(raw);
      const last = await lastSync(raw);
      const chats = await store.conversations(200);
      return json({ ...p, lastSync: last ? new Date(last * 1000).toISOString() : null, cachedChats: chats.length, hint: p.paired ? undefined : "Open /personal on this deployment to link your phone." });
    },
  );

  server.registerTool(
    "sync",
    {
      title: "Sync now",
      description:
        "Connect to WhatsApp briefly to collect every message that arrived since the last sync, then disconnect. Takes about 5–20 seconds. Read tools already sync automatically when the cache is older than 2 minutes. Returns how many messages were added.",
      inputSchema: z.object({}),
      annotations: { ...READ, idempotentHint: false },
    },
    async () => {
      try {
        const { ingested } = await withWhatsApp({ raw, store }, async () => null);
        return json({ synced: true, newMessages: ingested });
      } catch (e) {
        return fail(errText(e));
      }
    },
  );

  server.registerTool(
    "list_chats",
    {
      title: "List chats",
      description:
        "List cached chats (people and groups), most recent first, with name and last message. Syncs first when the cache is older than 2 minutes. Read-only. Use list_messages to read one chat. Returns JSON [{waId (the chat JID), name, lastAt, last}].",
      inputSchema: z.object({
        query: z.string().optional().describe("filter by name or number"),
        limit: z.number().int().min(1).max(100).default(20).describe("max chats (default 20)"),
        fresh: z.boolean().default(true).describe("sync first if stale (default true); false answers instantly from cache"),
      }),
      annotations: READ,
    },
    async ({ query, limit, fresh }) => {
      const note = fresh ? await refresh() : "";
      const chats = (await store.conversations(limit, query)).map(({ windowOpen, windowClosesAt, lastInboundAt, ...c }) => c);
      return text(`${note}\n${JSON.stringify(chats, null, 2)}`.trim());
    },
  );

  server.registerTool(
    "list_messages",
    {
      title: "Read a chat",
      description:
        "Read the cached messages of one chat, oldest first. Syncs first when the cache is older than 2 minutes. History older than the moment you linked is only present if WhatsApp sent it during linking. Read-only. Returns one line per message with its id for replies and reactions.",
      inputSchema: z.object({
        chat: chatArg,
        limit: z.number().int().min(1).max(200).default(40).describe("max messages (default 40)"),
        before: z.string().optional().describe("ISO-8601 timestamp; only messages before it"),
        fresh: z.boolean().default(true).describe("sync first if stale (default true)"),
      }),
      annotations: READ,
    },
    async ({ chat, limit, before, fresh }) => {
      try {
        const jid = toJid(chat);
        const note = fresh ? await refresh() : "";
        const msgs = await store.messages(jid, limit, before ? Math.floor(Date.parse(before) / 1000) : undefined);
        const [conv] = await store.conversations(1, jid.split("@")[0]);
        if (!msgs.length) return text(`${note} No cached messages in ${jid}.`.trim());
        return text([note, `Chat: ${conv?.name ?? jid}`, ...msgs.map((m) => line(m, conv?.name))].filter(Boolean).join("\n"));
      } catch (e) {
        return fail(errText(e));
      }
    },
  );

  server.registerTool(
    "search_messages",
    {
      title: "Search messages",
      description: "Case-insensitive text search across the 100 most recent cached chats. Syncs first when stale. Read-only. Returns matching messages newest first.",
      inputSchema: z.object({
        query: z.string().min(1).describe("text to look for"),
        limit: z.number().int().min(1).max(100).default(20).describe("max results (default 20)"),
      }),
      annotations: READ,
    },
    async ({ query, limit }) => {
      const note = await refresh();
      const hits = await store.search(query, limit);
      return text([note, ...(hits.length ? hits.map((m) => `${m.waId} ${line(m)}`) : [`No messages contain "${query}".`])].filter(Boolean).join("\n"));
    },
  );

  server.registerTool(
    "send_message",
    {
      title: "Send message",
      description:
        "Send a WhatsApp text from your own number to a person or group; it is delivered immediately and appears in your phone's chat. Pass reply_to to quote a message. Confirm recipient and wording with the user first. Returns the message id.",
      inputSchema: z.object({
        to: chatArg,
        text: z.string().min(1).max(4096).describe("message text"),
        reply_to: z.string().optional().describe("id of the message to quote (from list_messages)"),
      }),
      annotations: SEND,
    },
    async ({ to, text: body, reply_to }) => {
      try {
        const jid = toJid(to);
        let quoted: any;
        if (reply_to) {
          const q = await store.getMessage(reply_to);
          if (q) quoted = { key: { remoteJid: jid, id: q.id, fromMe: q.direction === "out", participant: q.sender && jid.endsWith("@g.us") ? `${q.sender}@s.whatsapp.net` : undefined }, message: { conversation: q.text ?? q.caption ?? "" } };
        }
        const { result } = await withWhatsApp({ raw, store }, (sock) => sock.sendMessage(jid, { text: body }, quoted ? { quoted } : undefined), { drain: false });
        await remember(result, jid, { text: body, replyTo: reply_to });
        return json({ sent: true, message_id: result?.key?.id });
      } catch (e) {
        return fail(errText(e));
      }
    },
  );

  server.registerTool(
    "send_media",
    {
      title: "Send media",
      description:
        "Send an image, video, audio or document from a public HTTPS URL to a person or group. Delivered immediately. Confirm with the user first. Returns the message id.",
      inputSchema: z.object({
        to: chatArg,
        type: z.enum(["image", "video", "audio", "document"]).describe("kind of media"),
        url: z.string().url().describe("public https URL of the file"),
        caption: z.string().max(1024).optional().describe("caption (not for audio)"),
        filename: z.string().optional().describe("file name (documents)"),
        mimetype: z.string().optional().describe("MIME type for documents, e.g. application/pdf (default application/octet-stream)"),
      }),
      annotations: SEND,
    },
    async ({ to, type, url, caption, filename, mimetype }) => {
      try {
        const jid = toJid(to);
        const content: any =
          type === "document"
            ? { document: { url }, mimetype: mimetype ?? "application/octet-stream", fileName: filename ?? url.split("/").pop(), caption }
            : type === "audio"
              ? { audio: { url }, mimetype: mimetype ?? "audio/mpeg" }
              : { [type]: { url }, caption };
        const { result } = await withWhatsApp({ raw, store }, (sock) => sock.sendMessage(jid, content), { drain: false });
        await remember(result, jid, { type, caption, filename, text: `[${type}] ${url}` });
        return json({ sent: true, message_id: result?.key?.id });
      } catch (e) {
        return fail(errText(e));
      }
    },
  );

  server.registerTool(
    "send_reaction",
    {
      title: "React to a message",
      description: "React to a message with an emoji, or an empty string to remove your reaction. Reversible. Returns the reaction's id.",
      inputSchema: z.object({
        chat: chatArg,
        message_id: z.string().describe("id of the message (from list_messages)"),
        emoji: z.string().max(8).describe("one emoji, or empty to remove"),
      }),
      annotations: { ...SEND, idempotentHint: true },
    },
    async ({ chat, message_id, emoji }) => {
      try {
        const jid = toJid(chat);
        const q = await store.getMessage(message_id);
        const key = { remoteJid: jid, id: message_id, fromMe: q?.direction === "out", participant: q?.sender && jid.endsWith("@g.us") ? `${q.sender}@s.whatsapp.net` : undefined };
        const { result } = await withWhatsApp({ raw, store }, (sock) => sock.sendMessage(jid, { react: { text: emoji, key } }), { drain: false });
        return json({ sent: true, message_id: result?.key?.id });
      } catch (e) {
        return fail(errText(e));
      }
    },
  );

  server.registerTool(
    "mark_read",
    {
      title: "Mark chat as read",
      description: "Mark the latest received messages in a chat as read, so senders see blue ticks (if read receipts are on). Not reversible. Returns how many were marked.",
      inputSchema: z.object({ chat: chatArg, count: z.number().int().min(1).max(50).default(10).describe("how many recent incoming messages (default 10)") }),
      annotations: { ...SEND, idempotentHint: true },
    },
    async ({ chat, count }) => {
      try {
        const jid = toJid(chat);
        const incoming = (await store.messages(jid, 100)).filter((m) => m.direction === "in").slice(-count);
        if (!incoming.length) return json({ marked: 0 });
        const keys = incoming.map((m) => ({ remoteJid: jid, id: m.id, fromMe: false, participant: m.sender && jid.endsWith("@g.us") ? `${m.sender}@s.whatsapp.net` : undefined }));
        await withWhatsApp({ raw, store }, (sock) => sock.readMessages(keys), { drain: false });
        return json({ marked: keys.length });
      } catch (e) {
        return fail(errText(e));
      }
    },
  );

  server.registerTool(
    "list_groups",
    {
      title: "List groups",
      description: "Fetch every group you are in from WhatsApp, with JID, name and member count (connects briefly). Read-only. Use the JID with list_messages or send_message.",
      inputSchema: z.object({}),
      annotations: READ,
    },
    async () => {
      try {
        const { result } = await withWhatsApp({ raw, store }, (sock) => sock.groupFetchAllParticipating(), { drain: false });
        const groups = Object.values(result).map((g: any) => ({ jid: g.id, name: g.subject, members: g.participants?.length ?? 0, announce: !!g.announce }));
        for (const gr of groups) if (gr.name) await store.setName(gr.jid, gr.name);
        return json(groups.sort((a, b) => a.name.localeCompare(b.name)));
      } catch (e) {
        return fail(errText(e));
      }
    },
  );

  server.registerTool(
    "check_numbers",
    {
      title: "Check numbers",
      description: "Check which phone numbers have WhatsApp (connects briefly; the people are not notified). Read-only. Returns [{number, exists, jid}].",
      inputSchema: z.object({ numbers: z.array(z.string()).min(1).max(50).describe("phone numbers with country code") }),
      annotations: READ,
    },
    async ({ numbers }) => {
      try {
        const digits = numbers.map((n) => n.replace(/\D/g, ""));
        const { result } = await withWhatsApp({ raw, store }, (sock) => sock.onWhatsApp(...digits), { drain: false });
        return json(digits.map((d) => {
          const hit = (result ?? []).find((r: any) => r.jid?.startsWith(d));
          return { number: d, exists: !!hit?.exists, jid: hit?.jid };
        }));
      } catch (e) {
        return fail(errText(e));
      }
    },
  );
}

export const PERSONAL_TOOL_NAMES = ["get_status", "sync", "list_chats", "list_messages", "search_messages", "send_message", "send_media", "send_reaction", "mark_read", "list_groups", "check_numbers"];
