import { personal } from "@/lib/runtime";
import { isPaired } from "@/lib/wa/auth";
import { withWhatsApp } from "@/lib/wa/session";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

// Daily: connects once so WhatsApp keeps the linked device active (devices
// that stay offline for about two weeks are unlinked) and collects messages.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) return new Response("unauthorized", { status: 401 });
  const { raw, store } = personal();
  if (!(await isPaired(raw)).paired) return Response.json({ skipped: "not linked" });
  try {
    const { ingested } = await withWhatsApp({ raw, store }, async () => null, { maxMs: 90_000 });
    return Response.json({ synced: true, newMessages: ingested });
  } catch (e) {
    return Response.json({ synced: false, error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
