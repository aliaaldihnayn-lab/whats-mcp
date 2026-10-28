"use client";

import { useState } from "react";
import { call, errMsg, invalidate, useApi, useSession } from "../shared";
import { State } from "../State";

type Doc = { id: string; title: string; kind: "url" | "file" | "text"; source: string; group?: string; chars: number; enabled: boolean; updatedAt: number };
type Conn = { name: string; url: string; hasToken: boolean };
type Data = { docs: Doc[]; limits: { doc: number; total: number; docs: number }; chars: number };

const KIND_LABEL: Record<Doc["kind"], string> = { url: "رابط", file: "ملف", text: "نص" };

/** "5 آلاف حرف" reads at a glance; "5ك" did not. */
const chars = (n: number) => (n < 1000 ? "أقل من ألف حرف" : `${Math.round(n / 1000).toLocaleString("ar-u-nu-latn")} ألف حرف`);

export function Knowledge() {
  const { secret } = useSession();
  return <App secret={secret} />;
}

function App({ secret }: { secret: string }) {
  const docsApi = useApi<Data>("/api/personal/knowledge", { fresh: 20_000 });
  const connApi = useApi<{ connectors: Conn[] }>("/api/personal/connectors", { fresh: 30_000 });
  const data = docsApi.data;
  const conns = connApi.data?.connectors ?? [];

  const [url, setUrl] = useState("");
  const [crawl, setCrawl] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [cn, setCn] = useState({ name: "", url: "", token: "" });
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState("");
  const [drag, setDrag] = useState(false);

  async function run(key: string, fn: () => Promise<unknown>, ok: string) {
    setBusy(key);
    setMsg(null);
    try {
      await fn();
      if (ok) setMsg({ ok: true, text: ok });
      invalidate("/api/personal/knowledge");
      invalidate("/api/personal/connectors");
      await Promise.all([docsApi.reload(), connApi.reload()]);
    } catch (e) {
      setMsg({ ok: false, text: errMsg(e) });
    } finally {
      setBusy("");
    }
  }

  const post = (body: unknown) => call(secret, "/api/personal/knowledge", { body });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    for (const f of Array.from(files)) form.append("file", f);
    await run(
      "file",
      async () => {
        const r = await fetch("/api/personal/knowledge", { method: "POST", headers: { Authorization: `Bearer ${secret}` }, body: form });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
      },
      "انضاف الملف",
    );
  }

  function toggle(d: Doc, enabled: boolean) {
    docsApi.set((x) => ({ ...x!, docs: x!.docs.map((y) => (y.id === d.id ? { ...y, enabled } : y)) }));
    void run("toggle", () => post({ op: "toggle", id: d.id, enabled }), "");
  }

  const used = data ? Math.min(100, Math.round((data.chars / data.limits.total) * 100)) : 0;

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2>قاعدة المعرفة</h2>
          <p className="intro">أي شي تضيفه هنا يقرأه الذكاء الاصطناعي قبل ما يرد، ويجاوب منه فقط. أضف رابط الهلب سنتر أو مقالات، أو ارفع PDF أو Word أو Markdown.</p>
        </div>
        {data && (
          <div className="stat" aria-label="المساحة المستخدمة">
            <strong>{data.docs.length}</strong> مصدر · {Math.round(data.chars / 1000)} من {Math.round(data.limits.total / 1000)} ألف حرف
            <div className="meter"><span style={{ width: `${used}%` }} /></div>
          </div>
        )}
      </div>

      {msg && <div className={`banner ${msg.ok ? "ok" : "bad"}`} role="status">{msg.text}</div>}
      {docsApi.error && !data && (
        <State tone="bad" title="ما قدرنا نحمّل قاعدة المعرفة" actions={<button type="button" className="btn brand" onClick={() => void docsApi.reload()}>جرّب مرة ثانية</button>}>
          ما وصلنا للسيرفر. جرّب مرة ثانية. ما ضاع شي من مصادرك. ({docsApi.error})
        </State>
      )}

      <div className="kb-grid">
        <div className="stack">
          <section className="card">
            <h3>إضافة رابط</h3>
            <input dir="ltr" aria-label="الرابط" placeholder="https://help.example.com/articles" value={url} onChange={(e) => setUrl(e.target.value)} />
            <label className="check"><input type="checkbox" checked={crawl} onChange={(e) => setCrawl(e.target.checked)} /> اسحب الصفحات المرتبطة في نفس القسم (حتى 20 صفحة)</label>
            <button className="btn solid" disabled={!!busy || !url} onClick={() => run("url", async () => { await post({ op: "url", url, crawl, pages: 20 }); setUrl(""); }, "انضاف الرابط")}>{busy === "url" ? "نسحب الصفحات…" : "إضافة"}</button>
          </section>

          <section className="card">
            <h3>رفع ملف</h3>
            {/* our own drop zone: the browser's file button is English-only and can't be styled */}
            <label
              className={`dropzone${drag ? " over" : ""}${busy ? " busy" : ""}`}
              onDragOver={(e) => (e.preventDefault(), setDrag(true))}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDrag(false);
                if (!busy) void upload(e.dataTransfer.files);
              }}
            >
              <input type="file" className="sr" multiple accept=".pdf,.docx,.md,.markdown,.txt,.csv,.json,.html,.htm" disabled={!!busy} onChange={(e) => { void upload(e.target.files); e.target.value = ""; }} />
              <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M12 16V4m0 0L8 8m4-4l4 4M5 20h14" /></svg>
              <strong>{busy === "file" ? "نرفع الملف…" : "اختر ملفات أو اسحبها هنا"}</strong>
              <span>PDF أو Word أو Markdown أو نص · حتى 4MB للملف</span>
            </label>
            <p className="hint">للملفات الأكبر استخدم رابط.</p>
          </section>

          <section className="card">
            <h3>كتابة نص</h3>
            <input aria-label="العنوان" placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
            <textarea aria-label="النص" rows={5} placeholder="سياسة الاسترجاع، الأسعار، ساعات العمل..." value={text} onChange={(e) => setText(e.target.value)} />
            <button className="btn solid" disabled={!!busy || !text.trim()} onClick={() => run("text", async () => { await post({ op: "text", title, text }); setText(""); setTitle(""); }, "انضاف النص")}>{busy === "text" ? "نحفظ…" : "حفظ"}</button>
          </section>
        </div>

        <div className="stack">
          <section className="card">
            <h3>المصادر</h3>
            {!data && <div className="skel" style={{ height: 120 }} />}
            {data?.docs.length === 0 && <State title="ما فيه مصادر بعد">أضف رابط أو ملف أو نص من النماذج المجاورة، والذكاء الاصطناعي يجاوب منها بس.</State>}
            <ul className="list">
              {data?.docs.map((d) => (
                <li key={d.id} className={d.enabled ? "" : "off"}>
                  <label className="sw" title={d.enabled ? "مفعّل" : "متوقف"}>
                    <input type="checkbox" checked={d.enabled} onChange={(e) => toggle(d, e.target.checked)} aria-label={`تفعيل ${d.title}`} />
                  </label>
                  <div className="grow">
                    <strong>{d.title}</strong>
                    {d.kind === "text" ? <span className="sub">نص مكتوب</span> : <span className="sub" dir="ltr">{d.source}</span>}
                  </div>
                  <span className="tag">{KIND_LABEL[d.kind]}</span>
                  <span className="tag">{chars(d.chars)}</span>
                  {d.kind === "url" && <button className="btn ghost small" disabled={!!busy} onClick={() => run("refresh", () => post({ op: "refresh", id: d.id }), "تحدّث")}>تحديث</button>}
                  <button className="btn ghost small danger" disabled={!!busy} onClick={() => confirm(`حذف "${d.title}"؟`) && run("del", () => call(secret, `/api/personal/knowledge?id=${d.id}`, { method: "DELETE" }), "انحذف")}>حذف</button>
                </li>
              ))}
            </ul>
          </section>

          <section className="card">
            <h3>جرّب سؤال</h3>
            <div className="row">
              <input aria-label="السؤال" placeholder="كم مدة الاسترجاع؟" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && !e.nativeEvent.isComposing && q.trim() && !busy && void run("ask", async () => setAnswer(((await post({ op: "ask", q })) as { answer: string }).answer), "")} />
              <button className="btn solid" disabled={!!busy || !q.trim()} onClick={() => run("ask", async () => setAnswer(((await post({ op: "ask", q })) as { answer: string }).answer), "")}>{busy === "ask" ? "…" : "اسأل"}</button>
            </div>
            {answer && <div className="answer">{answer}</div>}
          </section>

          <section className="card">
            <h3>موصلات المساعد (MCP)</h3>
            <p className="hint">روابط خوادم MCP (متجرك، التصميم، جدولة النشر…) اللي يستخدمها المساعد لما ترسل له مهمة في واتساب. لازم https عام.</p>
            <ul className="list">
              {conns.map((c) => (
                <li key={c.name}>
                  <div className="grow"><strong>{c.name}</strong><span className="sub" dir="ltr">{c.url}</span></div>
                  {c.hasToken && <span className="tag">token</span>}
                  <button className="btn ghost small danger" disabled={!!busy} onClick={() => run("cdel", () => call(secret, `/api/personal/connectors?name=${encodeURIComponent(c.name)}`, { method: "DELETE" }), "انحذف")}>حذف</button>
                </li>
              ))}
            </ul>
            <div className="grid2">
              <label className="lf"><span>الاسم <small>(حروف إنجليزية وأرقام)</small></span><input dir="ltr" placeholder="shop" value={cn.name} onChange={(e) => setCn({ ...cn, name: e.target.value })} /></label>
              <label className="lf"><span>رابط الخادم</span><input dir="ltr" placeholder="https://mcp.example.com/mcp" value={cn.url} onChange={(e) => setCn({ ...cn, url: e.target.value })} /></label>
              <label className="lf"><span>التوكن <small>(اختياري)</small></span><input dir="ltr" type="password" value={cn.token} onChange={(e) => setCn({ ...cn, token: e.target.value })} /></label>
            </div>
            <button className="btn solid" disabled={!!busy || !cn.name || !cn.url} onClick={() => run("cadd", async () => { await call(secret, "/api/personal/connectors", { body: cn }); setCn({ name: "", url: "", token: "" }); }, "انضاف الموصل")}>إضافة موصل</button>
          </section>
        </div>
      </div>
    </div>
  );
}
