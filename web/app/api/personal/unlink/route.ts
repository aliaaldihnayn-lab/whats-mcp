import { isAuthorized } from "@/lib/auth";
import { personal } from "@/lib/runtime";
import { clearAuth } from "@/lib/wa/auth";
import { withWhatsApp } from "@/lib/wa/session";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Logs this device out of WhatsApp and deletes the stored session keys.
export async function POST(req: Request) {
  const { cfg, raw, store } = personal();
  if (!isAuthorized(req, cfg.mcpSecret)) return Response.json({ error: "Wrong or missing MCP_SECRET." }, { status: 401 });
  try {
    await withWhatsApp({ raw, store }, (sock) => sock.logout(), { drain: false, maxMs: 30_000 });
  } catch {
    /* already logged out or unreachable: still forget it locally */
  }
  await clearAuth(raw);
  return Response.json({ unlinked: true });
}
