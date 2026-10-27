import { admin, err } from "@/lib/admin";
import { target, targets } from "@/lib/inbox";
import { isPaired, MemoryRawKV } from "@/lib/wa/auth";
import { aiFromEnv, DEFAULT_MODEL, DEFAULT_REPLY_PROMPT } from "@/lib/flows/ai";
import { testFlow, type Channel } from "@/lib/flows/engine";
import { deleteFlow, isPaused, listFlows, readLog, reorderFlows, saveFlow, setPaused } from "@/lib/flows/storage";
import { FIELDS, FlowInput, OPS, type Flow } from "@/lib/flows/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const a = await admin(req);
  if (a instanceof Response) return a;
  const accounts = await targets(a);
  const log = [];
  for (const row of accounts) {
    const t = await target(a, row.id);
    if (t) log.push(...(await readLog(t.state)).map((l) => ({ ...l, accountLabel: row.label })));
  }
  return Response.json({
    flows: await listFlows(a.base),
    paused: await isPaused(a.base),
    ai: { configured: !!process.env.ANTHROPIC_API_KEY, model: process.env.AI_MODEL || DEFAULT_MODEL, dailyCap: Number(process.env.AI_MAX_PER_DAY) || 300, defaultPrompt: DEFAULT_REPLY_PROMPT },
    accounts,
    fields: FIELDS,
    ops: OPS,
    log: log.sort((x, y) => y.t - x.t).slice(0, 120),
  });
}

export async function PUT(req: Request) {
  const a = await admin(req);
  if (a instanceof Response) return a;
  const { flow } = (await req.json().catch(() => ({}))) as { flow?: unknown };
  try {
    return Response.json({ flow: await saveFlow(a.base, flow) });
  } catch (e) {
    return err(e, 400);
  }
}

export async function DELETE(req: Request) {
  const a = await admin(req);
  if (a instanceof Response) return a;
  await deleteFlow(a.base, new URL(req.url).searchParams.get("id") ?? "");
  return Response.json({ deleted: true });
}

// { op: "pause", paused } | { op: "reorder", ids } | { op: "test", flow, sample, useAi }
export async function POST(req: Request) {
  const a = await admin(req);
  if (a instanceof Response) return a;
  const b = (await req.json().catch(() => ({}))) as Record<string, any>;
  if (b.op === "pause") {
    await setPaused(a.base, !!b.paused);
    return Response.json({ paused: !!b.paused });
  }
  if (b.op === "reorder" && Array.isArray(b.ids)) {
    await reorderFlows(a.base, b.ids.map(String));
    return Response.json({ ok: true });
  }
  if (b.op === "test") {
    const parsed = FlowInput.safeParse(b.flow);
    if (!parsed.success) return err(`Invalid flow: ${parsed.error.issues[0].path.join(".")} ${parsed.error.issues[0].message}`, 400);
    const now = Date.now();
    const flow: Flow = { ...parsed.data, id: "test", createdAt: now, updatedAt: now, activeFrom: 0 };
    const t = await target(a, flow.account === "*" ? "main" : flow.account);
    if (!t) return err("Unknown number.", 404);
    const me = t.kind === "personal" ? (await isPaired(t.state)).me?.split("@")[0].split(":")[0] : undefined;
    const channel: Channel = {
      account: t.id, kind: t.kind, me,
      sendText: async () => { throw new Error("test only"); },
      react: async () => {},
      markRead: async () => {},
      resolveTarget: t.resolve,
    };
    try {
      const result = await testFlow(flow, b.sample ?? {}, { flows: [], state: new MemoryRawKV(), store: t.store, channel, ai: b.useAi ? aiFromEnv() : undefined });
      return Response.json(result);
    } catch (e) {
      return err(e);
    }
  }
  return err("unknown op", 400);
}
