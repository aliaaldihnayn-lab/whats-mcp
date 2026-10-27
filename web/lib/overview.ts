// Numbers for the dashboard overview page: the last 24 hours across every number.
// Pure over the Store and the per-number state, so it is tested without a server.

import { localParts } from "./flows/engine";
import { listDrafts, readLog } from "./flows/storage";
import type { Store } from "./store";
import type { RawKV } from "./wa/auth";

export type OverviewAccount = {
  id: string;
  label: string;
  kind: "personal" | "official";
  store: Store;
  /** per-number scratch space: drafts, run log, AI counter */
  state: RawKV;
  /** personal numbers only */
  paired?: boolean;
  lastSync?: number | null;
};

export type RunCounts = { ok: number; draft: number; dry: number; error: number; skipped: number };

export type Overview = {
  /** start of the 24 h window (ms) */
  since: number;
  totals: { messagesIn: number; messagesOut: number; activeChats: number; drafts: number; runs: RunCounts; aiUsed: number };
  /** 24 hourly buckets, oldest first; `t` is the start of the hour (ms) */
  hourly: { t: number; in: number; out: number }[];
  accounts: {
    id: string;
    label: string;
    kind: "personal" | "official";
    paired?: boolean;
    lastSync: number | null;
    activeChats: number;
    messagesIn: number;
    messagesOut: number;
    drafts: number;
    runs: RunCounts;
  }[];
  /** newest first, at most 5 */
  drafts: { id: string; account: string; accountLabel: string; chat: string; chatName?: string; text: string; flowName: string; createdAt: number }[];
  /** newest first, at most 5 */
  errors: { id?: string; t: number; name: string; account: string; accountLabel: string; chatName?: string; detail?: string }[];
};

const HOUR = 3600_000;
const CHATS_PER_NUMBER = 25;
const empty = (): RunCounts => ({ ok: 0, draft: 0, dry: 0, error: 0, skipped: 0 });

export async function buildOverview(accounts: OverviewAccount[], now = Date.now()): Promise<Overview> {
  const since = now - 24 * HOUR;
  const first = Math.floor(now / HOUR) * HOUR - 23 * HOUR;
  const hourly = Array.from({ length: 24 }, (_, i) => ({ t: first + i * HOUR, in: 0, out: 0 }));
  const out: Overview = {
    since,
    totals: { messagesIn: 0, messagesOut: 0, activeChats: 0, drafts: 0, runs: empty(), aiUsed: 0 },
    hourly,
    accounts: [],
    drafts: [],
    errors: [],
  };

  const parts = await Promise.all(
    accounts.map(async (a) => {
      const chats = (await a.store.conversations(40, undefined, Math.floor(now / 1000))).filter((c) => c.lastAt * 1000 >= since).slice(0, CHATS_PER_NUMBER);
      const batches = await Promise.all(chats.map((c) => a.store.messages(c.waId, 100)));
      const msgs = batches.flat().filter((m) => m.type !== "reaction" && m.timestamp * 1000 >= since && m.timestamp * 1000 <= now);
      const drafts = await listDrafts(a.state, "pending");
      const log = (await readLog(a.state)).filter((l) => l.t >= since);
      const ai = Number((await a.state.get(`flow:ai:${localParts(now, "UTC").date}`)) ?? 0) || 0;
      return { a, chats: chats.length, msgs, drafts, log, ai };
    }),
  );

  for (const { a, chats, msgs, drafts, log, ai } of parts) {
    const runs = empty();
    for (const l of log) runs[l.status] += 1;
    const messagesIn = msgs.filter((m) => m.direction === "in").length;
    const messagesOut = msgs.length - messagesIn;
    for (const m of msgs) {
      const b = hourly[Math.min(23, Math.max(0, Math.floor((m.timestamp * 1000 - first) / HOUR)))];
      if (m.direction === "in") b.in += 1;
      else b.out += 1;
    }
    out.accounts.push({ id: a.id, label: a.label, kind: a.kind, paired: a.paired, lastSync: a.lastSync ?? null, activeChats: chats, messagesIn, messagesOut, drafts: drafts.length, runs });
    const t = out.totals;
    t.messagesIn += messagesIn;
    t.messagesOut += messagesOut;
    t.activeChats += chats;
    t.drafts += drafts.length;
    t.aiUsed += ai;
    for (const k of Object.keys(runs) as (keyof RunCounts)[]) t.runs[k] += runs[k];
    for (const d of drafts) out.drafts.push({ id: d.id, account: d.account, accountLabel: a.label, chat: d.chat, chatName: d.chatName, text: d.text.slice(0, 160), flowName: d.flowName, createdAt: d.createdAt });
    for (const l of log) {
      if (l.status !== "error") continue;
      out.errors.push({ id: l.id, t: l.t, name: l.name, account: a.id, accountLabel: a.label, chatName: l.chatName, detail: l.note ?? l.actions.find((s) => !s.ok)?.detail });
    }
  }

  out.drafts = out.drafts.sort((x, y) => y.createdAt - x.createdAt).slice(0, 5);
  out.errors = out.errors.sort((x, y) => y.t - x.t).slice(0, 5);
  return out;
}
