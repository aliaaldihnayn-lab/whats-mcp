"use client";

import { useEffect, useState } from "react";

type Status = { paired: boolean; me?: string; name?: string; lastSync?: number | null; cachedChats?: number; storage?: boolean };
type Step = "idle" | "requesting" | "code" | "linked" | "done" | "error";

export function LinkPanel({ origin }: { origin: string }) {
  const [secret, setSecret] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [statusErr, setStatusErr] = useState("");
  const [phone, setPhone] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [code, setCode] = useState("");
  const [history, setHistory] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    try {
      const s = sessionStorage.getItem("whats-mcp-secret");
      if (s) setSecret(s);
    } catch {}
  }, []);

  async function loadStatus(s = secret) {
    setStatusErr("");
    const r = await fetch("/api/personal/status", { headers: { Authorization: `Bearer ${s}` } });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) {
      setStatus(null);
      setStatusErr(d.error ?? "تعذر قراءة الحالة");
      return;
    }
    setStatus(d);
    try {
      sessionStorage.setItem("whats-mcp-secret", s);
    } catch {}
  }

  async function link(e: React.FormEvent) {
    e.preventDefault();
    setStep("requesting");
    setError("");
    setCode("");
    setHistory(0);
    try {
      const r = await fetch("/api/personal/pair", {
        method: "POST",
        headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      if (!r.ok || !r.body) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error ?? `HTTP ${r.status}`);
      }
      const reader = r.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf("\n")) >= 0) {
          const ev = JSON.parse(buf.slice(0, i));
          buf = buf.slice(i + 1);
          if (ev.type === "code") {
            setCode(ev.code);
            setStep("code");
          } else if (ev.type === "linked") setStep("linked");
          else if (ev.type === "history") setHistory(ev.messages);
          else if (ev.type === "done") {
            setHistory(ev.messages);
            setStep("done");
          } else if (ev.type === "error") throw new Error(ev.message);
        }
      }
      await loadStatus();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("error");
    }
  }

  async function unlink() {
    if (!confirm("فصل هذا الجهاز من واتساب وحذف الجلسة؟")) return;
    await fetch("/api/personal/unlink", { method: "POST", headers: { Authorization: `Bearer ${secret}` } });
    await loadStatus();
  }

  const lastSync = status?.lastSync ? new Date(status.lastSync * 1000).toLocaleString("ar") : "لم تتم بعد";

  return (
    <div className="panel">
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          void loadStatus();
        }}
      >
        <label htmlFor="secret">كلمة السر (MCP_SECRET)</label>
        <div className="row">
          <input id="secret" type="password" dir="ltr" autoComplete="current-password" value={secret} onChange={(e) => setSecret(e.target.value)} required minLength={24} />
          <button className="btn ghost" type="submit">
            افتح
          </button>
        </div>
        {statusErr && <p className="err">{statusErr}</p>}
      </form>

      {status && (
        <>
          {!status.storage && <div className="note"><p>اربط Upstash Redis من تبويب Storage في مشروعك على فيرسل، ثم أعد النشر. بدونها ما يمكن حفظ الجلسة.</p></div>}

          {status.paired ? (
            <div className="linked">
              <p>
                <strong>مربوط</strong> {status.me ? <code>+{status.me.split(":")[0].split("@")[0]}</code> : null}
              </p>
              <p className="muted">
                آخر مزامنة: {lastSync}، والمحادثات المحفوظة: {status.cachedChats ?? 0}
              </p>
              <button className="btn ghost" type="button" onClick={unlink}>
                افصل الجهاز
              </button>
            </div>
          ) : (
            <form className="field" onSubmit={link}>
              <label htmlFor="phone">رقم واتساب مع رمز الدولة</label>
              <div className="row">
                <input id="phone" dir="ltr" inputMode="tel" placeholder="966501234567" value={phone} onChange={(e) => setPhone(e.target.value)} required />
                <button className="btn solid" type="submit" disabled={step === "requesting" || step === "code" || step === "linked"}>
                  اطلب رمز الربط
                </button>
              </div>
            </form>
          )}

          {step === "requesting" && <p className="muted">نطلب الرمز من واتساب…</p>}
          {step === "code" && (
            <div className="pair-code">
              <p>في جوالك: واتساب ← الإعدادات ← الأجهزة المرتبطة ← ربط جهاز ← الربط برقم الهاتف بدلاً من ذلك، واكتب:</p>
              <output dir="ltr">{code}</output>
              <p className="muted">الرمز صالح لدقائق قليلة. خل الصفحة مفتوحة.</p>
            </div>
          )}
          {step === "linked" && <p>تم الربط. نحفظ محادثاتك الأخيرة… {history ? `(${history} رسالة)` : ""}</p>}
          {step === "done" && <p>تم. حفظنا {history} رسالة من السجل، والرسائل الجديدة توصل مع كل طلب.</p>}
          {step === "error" && <p className="err">{error}</p>}

          <h3>أضفه لمساعدك</h3>
          <pre className="snippet" dir="ltr">{`{ "mcpServers": { "whatsapp": {
    "type": "http",
    "url": "${origin}/api/personal/mcp",
    "headers": { "Authorization": "Bearer YOUR_MCP_SECRET" }
} } }`}</pre>
        </>
      )}
    </div>
  );
}
