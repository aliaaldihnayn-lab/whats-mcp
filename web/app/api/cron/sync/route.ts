import { timingSafeEqual } from "node:crypto";
import { personal } from "@/lib/runtime";
import { listAccounts } from "@/lib/wa/accounts";
import { isPaired } from "@/lib/wa/auth";
import { syncAccount } from "@/lib/flows/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: Request, secret: string) {
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || new URL(req.url).searchParams.get("key") || "";
  const a = Buffer.from(given);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

// Vercel calls this once a day. It connects each linked number so WhatsApp keeps
// the device active (devices offline for about two weeks are unlinked), collects
// new messages and runs flows. An external pinger (cron-job.org, UptimeRobot) can
// call it every few minutes with ?key=CRON_SECRET for near-live automation.
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || !authorized(req, secret)) return new Response("unauthorized", { status: 401 });
  const { base, account } = personal();
  const only = new URL(req.url).searchParams.get("account");
  const accounts = (await listAccounts(base)).filter((a) => !only || a.id === only);
  const results = await Promise.all(
    accounts.map(async (acc) => {
      const d = account(acc.id);
      if (!(await isPaired(d.raw)).paired) return { account: acc.id, skipped: "not linked" };
      try {
        const { ingested } = await syncAccount(base, d, { maxMs: 100_000 });
        return { account: acc.id, synced: true, newMessages: ingested };
      } catch (e) {
        return { account: acc.id, synced: false, error: e instanceof Error ? e.message : String(e) };
      }
    }),
  );
  return Response.json({ results }, { status: results.some((r) => "error" in r) ? 500 : 200 });
}
