import { isAuthorized } from "@/lib/auth";
import { personal } from "@/lib/runtime";
import { isPaired } from "@/lib/wa/auth";
import { lastSync } from "@/lib/wa/session";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { cfg, raw, store } = personal();
  if (!isAuthorized(req, cfg.mcpSecret)) return Response.json({ error: "Wrong or missing MCP_SECRET." }, { status: 401 });
  const p = await isPaired(raw);
  const last = await lastSync(raw);
  const chats = await store.conversations(200);
  return Response.json({ ...p, lastSync: last, cachedChats: chats.length, storage: !!cfg.redisUrl });
}
