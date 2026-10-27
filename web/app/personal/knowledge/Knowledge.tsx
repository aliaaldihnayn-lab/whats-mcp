"use client";

import { useCallback, useEffect, useState } from "react";
import { Nav, SecretGate, call, errMsg } from "../shared";

type Doc = { id: string; title: string; kind: "url" | "file" | "text"; source: string; group?: string; chars: number; enabled: boolean; updatedAt: number };
type Conn = { name: string; url: string; hasToken: boolean };
type Data = { docs: Doc[]; limits: { doc: number; total: number; docs: number }; chars: number };

export function Knowledge() {
  return (
    <div className="dash-page">
      <Nav current="knowledge" />
      <SecretGate>{(secret) => <App secret={secret} />}</SecretGate>
    </div>
  );
}

function App({ secret }: { secret: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [url, setUrl] = useState("");
  const [crawl, setCrawl] = useState(false);
  const [title, setTitle] = useState("");
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [msg, setMsg] = useState("");
  const [conns, setConns] = useState<Conn[]>([]);
  const [cn, setCn] = useState({ name: "", url: "", token: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await call<Data>(secret, "/api/personal/knowledge"));
      setConns((await call<{ connectors: Conn[] }>(secret, "/api/personal/connectors")).connectors);
    } catch (e) {
      setMsg(errMsg(e));
    }
  }, [secret]);
  useEffect(() => void load(), [load]);

  async function run(fn: () => Promise<unknown>, ok = "تم") {
    setBusy(true);
    setMsg("");
    try {
      await fn();
      setMsg(ok);
      await load();
    } catch (e) {
      setMsg(errMsg(e));
    } finally {
      setBusy(false);
    }
  }

  const post = (body: unknown) => call(secret, "/api/personal/knowledge", { body });

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    const form = new FormData();
    for (const f of Array.from(files)) form.append("file", f);
    await run(async () => {
      const r = await fetch("/api/personal/knowledge", { method: "POST", headers: { Authorization: `Bearer ${secret}` }, body: form });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
    }, "انضاف الملف");
  }

  const del = (d: Doc) => run(() => call(secret, `/api/personal/knowledge?id=${d.id}`, { method: "DELETE" }), "انحذف");

  return (
    <main className="card">
      <h1>قاعدة المعرفة</h1>
      <p>أي شي تضيفه هنا يقرأه كلود قبل ما يرد، ويجاوب منه فقط. أضف رابط الهلب سنتر أو مقالات، أو ارفع PDF / Word / Markdown.</p>
      {msg && <p role="status">{msg}</p>}

      <section>
        <h2>إضافة رابط</h2>
        <input dir="ltr" placeholder="https://help.example.com/articles" value={url} onChange={(e) => setUrl(e.target.value)} />
        <label>
          <input type="checkbox" checked={crawl} onChange={(e) => setCrawl(e.target.checked)} /> اسحب الصفحات المرتبطة في نفس القسم (حتى 20 صفحة)
        </label>
        <button disabled={busy || !url} onClick={() => run(async () => { await post({ op: "url", url, crawl, pages: 20 }); setUrl(""); }, "انضاف الرابط")}>إضافة</button>
      </section>

      <section>
        <h2>رفع ملف</h2>
        <input type="file" multiple accept=".pdf,.docx,.md,.markdown,.txt,.csv,.json,.html,.htm" onChange={(e) => { upload(e.target.files); e.target.value = ""; }} />
        <small>الحد 4MB للملف الواحد. للملفات الأكبر استخدم رابط.</small>
      </section>

      <section>
        <h2>كتابة نص</h2>
        <input placeholder="العنوان" value={title} onChange={(e) => setTitle(e.target.value)} />
        <textarea rows={5} placeholder="سياسة الاسترجاع، الأسعار، ساعات العمل..." value={text} onChange={(e) => setText(e.target.value)} />
        <button disabled={busy || !text.trim()} onClick={() => run(async () => { await post({ op: "text", title, text }); setText(""); setTitle(""); }, "انضاف النص")}>حفظ</button>
      </section>

      <section>
        <h2>المصادر {data ? `(${data.docs.length} · ${Math.round(data.chars / 1000)}ك حرف)` : ""}</h2>
        {data?.docs.length === 0 && <p>ما فيه مصادر بعد.</p>}
        <ul>
          {data?.docs.map((d) => (
            <li key={d.id}>
              <label>
                <input type="checkbox" checked={d.enabled} onChange={(e) => run(() => post({ op: "toggle", id: d.id, enabled: e.target.checked }), "تم")} /> {d.title}
              </label>{" "}
              <small dir="ltr">{d.kind === "text" ? "text" : d.source}</small>
              {d.kind === "url" && <button disabled={busy} onClick={() => run(() => post({ op: "refresh", id: d.id }), "تحدّث")}>تحديث</button>}
              <button disabled={busy} onClick={() => del(d)}>حذف</button>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h2>جرّب سؤال</h2>
        <input placeholder="كم مدة الاسترجاع؟" value={q} onChange={(e) => setQ(e.target.value)} />
        <button disabled={busy || !q.trim()} onClick={() => run(async () => { const r = await post({ op: "ask", q }) as { answer: string }; setAnswer(r.answer); }, "")}>اسأل كلود</button>
        {answer && <p>{answer}</p>}
      </section>

      <section>
        <h2>موصلات المساعد (MCP)</h2>
        <p>روابط خوادم MCP (متجرك، التصميم، جدولة النشر…) اللي يستخدمها Claude لما ترسل له مهمة في واتساب. لازم https عام.</p>
        <ul>
          {conns.map((c) => (
            <li key={c.name}>
              {c.name} <small dir="ltr">{c.url}</small>
              <button disabled={busy} onClick={() => run(() => call(secret, `/api/personal/connectors?name=${encodeURIComponent(c.name)}`, { method: "DELETE" }), "انحذف")}>حذف</button>
            </li>
          ))}
        </ul>
        <input dir="ltr" placeholder="name (shop)" value={cn.name} onChange={(e) => setCn({ ...cn, name: e.target.value })} />
        <input dir="ltr" placeholder="https://mcp.example.com/mcp" value={cn.url} onChange={(e) => setCn({ ...cn, url: e.target.value })} />
        <input dir="ltr" type="password" placeholder="token (اختياري)" value={cn.token} onChange={(e) => setCn({ ...cn, token: e.target.value })} />
        <button disabled={busy || !cn.name || !cn.url} onClick={() => run(async () => { await call(secret, "/api/personal/connectors", { body: cn }); setCn({ name: "", url: "", token: "" }); }, "انضاف الموصل")}>إضافة موصل</button>
      </section>
    </main>
  );
}
