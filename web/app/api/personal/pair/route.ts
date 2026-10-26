import { isAuthorized } from "@/lib/auth";
import { personal } from "@/lib/runtime";
import { pair, type PairEvent } from "@/lib/wa/pair";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

// Streams newline-delimited JSON: the pairing code first, then progress.
export async function POST(req: Request) {
  const { cfg, raw, store } = personal();
  if (!isAuthorized(req, cfg.mcpSecret)) return Response.json({ error: "Wrong or missing MCP_SECRET." }, { status: 401 });
  if (!cfg.redisUrl) return Response.json({ error: "Connect Upstash Redis first (Storage tab), then redeploy." }, { status: 503 });
  const { phone } = (await req.json().catch(() => ({}))) as { phone?: string };
  if (!phone) return Response.json({ error: "phone is required" }, { status: 400 });

  const enc = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      const emit = (e: PairEvent) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await pair(raw, store, phone, emit);
      } catch (e) {
        emit({ type: "error", message: e instanceof Error ? e.message : String(e) });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(body, { headers: { "Content-Type": "application/x-ndjson", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
