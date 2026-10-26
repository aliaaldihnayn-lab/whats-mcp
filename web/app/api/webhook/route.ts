import { runtime } from "@/lib/runtime";
import { ingest, verifySignature } from "@/lib/webhook";

export const dynamic = "force-dynamic";

// Meta calls GET once when you save the webhook URL, to confirm you own it.
export async function GET(req: Request) {
  const { cfg } = runtime();
  const p = new URL(req.url).searchParams;
  if (cfg.verifyToken && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === cfg.verifyToken) {
    return new Response(p.get("hub.challenge") ?? "", { status: 200, headers: { "Content-Type": "text/plain" } });
  }
  return new Response("forbidden", { status: 403 });
}

// Every incoming message, delivery receipt and Business-app echo arrives here.
export async function POST(req: Request) {
  const { cfg, store } = runtime();
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get("x-hub-signature-256"), cfg.appSecret)) {
    return new Response("invalid signature", { status: 401 });
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return new Response("bad json", { status: 400 });
  }
  try {
    await ingest(body, store, cfg.phoneNumberId || undefined);
  } catch (e) {
    // A non-2xx makes Meta retry the delivery later, so nothing is lost.
    console.error("webhook ingest failed", e);
    return new Response("storage error", { status: 500 });
  }
  return new Response("ok", { status: 200 });
}
