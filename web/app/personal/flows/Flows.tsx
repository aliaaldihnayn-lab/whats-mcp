"use client";

import { useCallback, useEffect, useState } from "react";
import type { Action, Cond, Flow } from "@/lib/flows/types";
import { Nav, SecretGate, call, errMsg, useCopy } from "../shared";
import { ACTION_LABEL, FIELD_LABEL, NO_VALUE, OP_LABEL, PRESETS, blankFlow, newAction, type ActionType, type EF } from "./presets";

type Account = { id: string; label: string; kind: "personal" | "official" };
type Log = { t: number; account: string; accountLabel?: string; flow: string; name: string; chat: string; chatName?: string; text?: string; status: string; note?: string; actions: { type: string; ok: boolean; detail?: string }[] };
type Data = { flows: Flow[]; paused: boolean; ai: { configured: boolean; claude?: boolean; cheap?: boolean; cheapModel?: string; model: string; dailyCap: number; defaultPrompt: string }; accounts: Account[]; fields: string[]; ops: string[]; log: Log[] };
type TestResult = { triggered: boolean; matched: boolean; conditions: { field: string; op: string; value?: string; ok: boolean; note?: string }[]; actions: { type: string; ok: boolean; detail?: string }[] };

const MODE_NOTE: Record<EF["mode"], string> = {
  approve: "الأكثر أماناً: الفلو يجهز الرد ويحطه في المسودات، وما يوصل أحد شي إلا لما توافق عليه من صندوق الوارد.",
  auto: "يرسل فوراً من رقمك بدون ما يسألك. شغّله بعد ما تجرب الفلو وتتأكد من الشروط. فيه حد أقصى لكل ساعة ولكل محادثة كحماية.",
  dry: "تجربة: يقيّم الشروط ويكتب في السجل إيش كان بيسوي، بدون ما يرسل أو يعلّم أي شي.",
};

export function Flows() {
  return (
    <div className="dash-page">
      <Nav current="flows" />
      <SecretGate>{(secret) => <App secret={secret} />}</SecretGate>
    </div>
  );
}

function App({ secret }: { secret: string }) {
  const [data, setData] = useState<Data | null>(null);
  const [edit, setEdit] = useState<EF | null>(null);
  const [tab, setTab] = useState<"flows" | "log">("flows");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await call<Data>(secret, "/api/personal/flows"));
    } catch (e) {
      setError(errMsg(e));
    }
  }, [secret]);

  useEffect(() => {
    void load();
  }, [load]);

  const toEF = (f: Flow): EF => ({ ...f }) as EF;

  async function save(f: EF) {
    setSaving(true);
    setError("");
    try {
      const { flow } = await call<{ flow: Flow }>(secret, "/api/personal/flows", { method: "PUT", body: { flow: f } });
      await load();
      setEdit(toEF(flow));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  }

  async function toggle(f: Flow) {
    await call(secret, "/api/personal/flows", { method: "PUT", body: { flow: { ...f, enabled: !f.enabled } } }).catch((e) => setError(errMsg(e)));
    await load();
  }

  async function remove(f: EF) {
    if (!f.id || !confirm(`حذف الفلو "${f.name}"؟`)) return;
    await call(secret, `/api/personal/flows?id=${f.id}`, { method: "DELETE" }).catch((e) => setError(errMsg(e)));
    setEdit(null);
    await load();
  }

  async function pause(paused: boolean) {
    await call(secret, "/api/personal/flows", { body: { op: "pause", paused } }).catch((e) => setError(errMsg(e)));
    await load();
  }

  if (!data) return <p className="muted">{error || "نحمّل…"}</p>;

  return (
    <>
      <div className="chips">
        <span className={`chip ${data.ai.configured ? "on" : "opt"}`}>{data.ai.configured ? `✓ Claude جاهز (${data.ai.model}، حد يومي ${data.ai.dailyCap})` : "○ Claude غير مفعّل: أضف ANTHROPIC_API_KEY في فيرسل"}</span>
        <span className={`chip ${data.paused ? "off" : "on"}`}>{data.paused ? "✗ كل الفلوات موقوفة" : "✓ الفلوات تشتغل"}</span>
        <button type="button" className="btn ghost small" onClick={() => pause(!data.paused)}>{data.paused ? "شغّل الكل" : "أوقف الكل فوراً"}</button>
      </div>
      <Timing />
      <div className="tabs" role="tablist">
        <a role="tab" href="#flows" aria-current={tab === "flows" ? "page" : undefined} onClick={(e) => (e.preventDefault(), setTab("flows"))}>الفلوات ({data.flows.length})</a>
        <a role="tab" href="#log" aria-current={tab === "log" ? "page" : undefined} onClick={(e) => (e.preventDefault(), setTab("log"), load())}>السجل</a>
      </div>

      {tab === "log" ? (
        <LogTable log={data.log} />
      ) : (
        <div className="flows">
          <div>
            <div className="flowlist">
              {data.flows.map((f) => (
                <div key={f.id} style={{ display: "grid", gap: 6 }}>
                  <button type="button" className="flowitem" aria-current={edit?.id === f.id} onClick={() => setEdit(toEF(f))}>
                    <strong>{f.name}</strong>
                    <span className="sub">
                      {f.trigger.type === "schedule" ? "جدول زمني" : f.trigger.chats === "group" ? "رسائل المجموعات" : f.trigger.chats === "both" ? "كل الرسائل" : "الرسائل الخاصة"} · {f.mode === "auto" ? "تلقائي" : f.mode === "approve" ? "مسودة" : "تجربة"} · {data.accounts.find((a) => a.id === f.account)?.label ?? (f.account === "*" ? "كل الأرقام" : f.account)}
                    </span>
                  </button>
                  <label className="sw small"><input type="checkbox" checked={f.enabled} onChange={() => toggle(f)} /> {f.enabled ? "مفعّل" : "متوقف"}</label>
                </div>
              ))}
              {data.flows.length === 0 && <p className="muted">ما عندك فلوات بعد. ابدأ من قالب:</p>}
            </div>
            <h4 style={{ margin: "22px 0 8px" }}>ابدأ من قالب</h4>
            <div className="flowlist">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="flowitem" onClick={() => setEdit(p.make())}>
                  <strong>{p.title}</strong>
                  <span className="sub">{p.hint}</span>
                </button>
              ))}
              <button type="button" className="btn ghost" onClick={() => setEdit(blankFlow())}>+ فلو فاضي</button>
            </div>
          </div>
          <div>
            {edit ? (
              <Editor key={edit.id ?? edit.name + data.flows.length} secret={secret} data={data} value={edit} saving={saving} error={error} onSave={save} onDelete={remove} onCancel={() => setEdit(null)} />
            ) : (
              <div className="editor"><p className="muted">اختر فلو للتعديل، أو ابدأ من قالب على اليمين.</p></div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function Timing() {
  const { copied, copy } = useCopy();
  const url = typeof location !== "undefined" ? `${location.origin}/api/cron/sync?key=CRON_SECRET` : "";
  return (
    <details className="note" style={{ margin: "0 0 20px" }}>
      <summary><strong>متى تشتغل الفلوات؟</strong> (اقرأها مرة وحدة)</summary>
      <p style={{ marginTop: 10 }}>
        <strong>الرقم الشخصي:</strong> فيرسل ما يقدر يبقي اتصال واتساب مفتوح، فالفلوات تشتغل لحظة ما يتصل السيرفر: مرة باليوم تلقائياً، وكل ما مساعدك أو صندوق الوارد يعمل مزامنة (زر "زامن"). يعني الرد ما يكون لحظي افتراضياً.
        لو تبي شبه فوري، خل خدمة مجانية (مثل cron-job.org أو UptimeRobot) تفتح هذا الرابط كل دقيقتين إلى 5 دقائق:
      </p>
      <div className="code"><pre dir="ltr">{url}</pre><button className="copy" type="button" onClick={() => copy(url, "u")}>{copied === "u" ? "تم" : "انسخ"}</button></div>
      <p>(استبدل CRON_SECRET بقيمته الحقيقية.) انتبه: الاتصال المتكرر من سيرفرات فيرسل يرفع احتمال تقييد الرقم، فالأفضل ترك فاصل 5 دقائق أو أكثر، ووضع المسودة لفترة.</p>
      <p><strong>الرقم الرسمي (Cloud API):</strong> الفلوات تشتغل لحظياً مع كل رسالة تصل من Meta.</p>
    </details>
  );
}

function LogTable({ log }: { log: Log[] }) {
  if (!log.length) return <p className="muted">السجل فاضي. أول ما فلو يشتغل على رسالة تشوفه هنا.</p>;
  return (
    <div className="table-scroll">
      <table className="logtable">
        <thead><tr><th>الوقت</th><th>الفلو</th><th>المحادثة</th><th>الرسالة</th><th>النتيجة</th></tr></thead>
        <tbody>
          {log.map((l, i) => (
            <tr key={i}>
              <td>{new Date(l.t).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" })}</td>
              <td>{l.name}<br /><span className="muted small">{l.accountLabel}</span></td>
              <td>{l.chatName || (l.chat ? "+" + l.chat.split("@")[0] : "—")}</td>
              <td>{l.text}</td>
              <td>
                <strong className={l.status === "error" ? "err" : l.status === "ok" ? "ok" : ""}>{({ ok: "تم", draft: "مسودة", dry: "تجربة", error: "خطأ", skipped: "تخطّى" } as Record<string, string>)[l.status] ?? l.status}</strong>
                {l.note && <div className="muted small">{l.note}</div>}
                {l.actions.map((a, j) => <div key={j} className={`small ${a.ok ? "muted" : "err"}`}>{ACTION_LABEL[a.type as ActionType] ?? a.type}: {a.detail}</div>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------- editor ----------

function Editor({ secret, data, value, saving, error, onSave, onDelete, onCancel }: { secret: string; data: Data; value: EF; saving: boolean; error: string; onSave: (f: EF) => void; onDelete: (f: EF) => void; onCancel: () => void }) {
  const [f, setF] = useState<EF>(value);
  const [sample, setSample] = useState({ text: "السلام عليكم، كم سعر الباقة؟", senderName: "سارة" });
  const [useAi, setUseAi] = useState(false);
  const [result, setResult] = useState<TestResult | null>(null);
  const [testError, setTestError] = useState("");
  const [testing, setTesting] = useState(false);
  const set = <K extends keyof EF>(k: K, v: EF[K]) => setF((x) => ({ ...x, [k]: v }));
  const setAction = (i: number, a: Action) => set("actions", f.actions.map((x, j) => (j === i ? a : x)));
  const setCond = (i: number, c: Cond) => set("conditions", f.conditions.map((x, j) => (j === i ? c : x)));
  const isMsg = f.trigger.type === "message";

  async function test() {
    setTesting(true);
    setTestError("");
    setResult(null);
    try {
      setResult(await call<TestResult>(secret, "/api/personal/flows", { body: { op: "test", flow: f, sample, useAi } }));
    } catch (e) {
      setTestError(errMsg(e));
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="editor">
      <div className="grid2">
        <label>اسم الفلو<input value={f.name} maxLength={80} onChange={(e) => set("name", e.target.value)} /></label>
        <label>الرقم
          <select value={f.account} onChange={(e) => set("account", e.target.value)}>
            <option value="*">كل الأرقام</option>
            {data.accounts.map((a) => <option key={a.id} value={a.id}>{a.label}</option>)}
          </select>
        </label>
        <label>الوضع
          <select value={f.mode} onChange={(e) => set("mode", e.target.value as EF["mode"])}>
            <option value="approve">مسودة (تنتظر موافقتي)</option>
            <option value="auto">تلقائي (يرسل فوراً)</option>
            <option value="dry">تجربة (سجل فقط)</option>
          </select>
        </label>
        <label className="sw" style={{ alignSelf: "end" }}><input type="checkbox" checked={f.enabled} onChange={(e) => set("enabled", e.target.checked)} /> مفعّل</label>
      </div>
      <p className="mode-note">{MODE_NOTE[f.mode]}</p>

      <section>
        <h4>1. متى يشتغل</h4>
        <div className="grid2">
          <label>النوع
            <select value={f.trigger.type} onChange={(e) => set("trigger", e.target.value === "message" ? { type: "message", direction: "in", chats: "direct" } : { type: "schedule", everyMinutes: 1440, atHour: 8 })}>
              <option value="message">لما توصل رسالة</option>
              <option value="schedule">على جدول زمني</option>
            </select>
          </label>
          {f.trigger.type === "message" ? (
            <>
              <label>الاتجاه
                <select value={f.trigger.direction} onChange={(e) => set("trigger", { ...(f.trigger as any), direction: e.target.value })}>
                  <option value="in">رسائل تجيني</option><option value="out">رسائل أرسلها أنا</option><option value="any">الاثنين</option>
                </select>
              </label>
              <label>المحادثات
                <select value={f.trigger.chats} onChange={(e) => set("trigger", { ...(f.trigger as any), chats: e.target.value })}>
                  <option value="direct">الخاصة فقط</option><option value="group">المجموعات فقط</option><option value="both">الكل</option>
                </select>
              </label>
            </>
          ) : (
            <>
              <label>كل كم دقيقة<input type="number" min={5} value={f.trigger.everyMinutes} onChange={(e) => set("trigger", { ...(f.trigger as any), everyMinutes: Number(e.target.value) })} /></label>
              <label>أو يومياً بعد الساعة (اختياري)
                <input type="number" min={0} max={23} value={f.trigger.atHour ?? ""} placeholder="مثلاً 8" onChange={(e) => set("trigger", { ...(f.trigger as any), atHour: e.target.value === "" ? undefined : Number(e.target.value) })} />
              </label>
            </>
          )}
        </div>
        {!isMsg && <p className="hint">الفلو المجدول ما له محادثة، فاستخدم "أرسل" و"Claude يجهز نص" وWebhook فقط. الجدول يتحقق وقت المزامنة.</p>}
      </section>

      <section>
        <h4>2. الشروط {isMsg ? "" : "(غير مستخدمة في الجدول)"}</h4>
        {isMsg && (
          <>
            <div className="grid2" style={{ marginBottom: 8 }}>
              <label>لازم يتحقق
                <select value={f.match} onChange={(e) => set("match", e.target.value as "all" | "any")}>
                  <option value="all">كل الشروط</option><option value="any">أي شرط</option>
                </select>
              </label>
            </div>
            {f.conditions.map((c, i) => (
              <div className="cond" key={i}>
                <select aria-label="الحقل" value={c.field} onChange={(e) => setCond(i, e.target.value === "ai" ? { field: "ai", op: "yes", value: "" } : { ...c, field: e.target.value as Cond["field"], op: c.field === "ai" ? "contains" : c.op })}>
                  {data.fields.map((x) => <option key={x} value={x}>{FIELD_LABEL[x] ?? x}</option>)}
                </select>
                <select aria-label="العملية" value={c.op} disabled={c.field === "ai"} onChange={(e) => setCond(i, { ...c, op: e.target.value as Cond["op"] })}>
                  {data.ops.filter((o) => (c.field === "ai" ? o === "yes" : o !== "yes")).map((o) => <option key={o} value={o}>{OP_LABEL[o] ?? o}</option>)}
                </select>
                {NO_VALUE.has(c.op) ? <span /> : (
                  <input aria-label="القيمة" value={String(c.value ?? "")} placeholder={c.field === "ai" ? "السؤال: هل الرسالة طلب سعر؟" : c.op === "contains_any" || c.op === "in" ? "كلمات مفصولة بفاصلة" : "القيمة"} onChange={(e) => setCond(i, { ...c, value: e.target.value })} />
                )}
                <button type="button" className="btn ghost small" aria-label="احذف الشرط" onClick={() => set("conditions", f.conditions.filter((_, j) => j !== i))}>×</button>
              </div>
            ))}
            <button type="button" className="btn ghost small" onClick={() => set("conditions", [...f.conditions, { field: "text", op: "contains_any", value: "" }])}>+ شرط</button>
            {f.conditions.length === 0 && <p className="hint">بدون شروط: الفلو يشتغل على كل رسالة تطابق المحفز. الكلمات العربية تُقارن بدون تشكيل.</p>}
          </>
        )}
      </section>

      <section>
        <h4>3. ماذا يسوي</h4>
        {f.actions.map((a, i) => (
          <div className="act" key={i}>
            <div className="body">
              <strong>{ACTION_LABEL[a.type]}</strong>
              <ActionFields a={a} onChange={(x) => setAction(i, x)} defaultPrompt={data.ai.defaultPrompt} aiOn={data.ai.configured} cheapModel={data.ai.cheap ? data.ai.cheapModel ?? "cheap" : undefined} />
            </div>
            <button type="button" className="btn ghost small" aria-label="احذف الأكشن" onClick={() => set("actions", f.actions.filter((_, j) => j !== i))}>×</button>
          </div>
        ))}
        <select aria-label="إضافة أكشن" value="" onChange={(e) => e.target.value && set("actions", [...f.actions, newAction(e.target.value as ActionType)])}>
          <option value="">+ أضف أكشن…</option>
          {(Object.keys(ACTION_LABEL) as ActionType[]).map((t) => <option key={t} value={t}>{ACTION_LABEL[t]}</option>)}
        </select>
        <p className="hint">المتغيرات داخل النصوص: {"{{text}} {{sender_name}} {{sender}} {{chat_name}} {{time}} {{date}} {{me}} {{ai}}"}. الأكشنات تشتغل بالترتيب، ولو واحد فشل توقف الباقي.</p>
      </section>

      <section>
        <h4>4. حدود الأمان</h4>
        <div className="grid2">
          <label>أقصى عمر للرسالة (دقيقة)<input type="number" min={1} value={f.maxAgeMinutes} onChange={(e) => set("maxAgeMinutes", Number(e.target.value))} /></label>
          <label>انتظار بين ردين لنفس الشخص (ثانية)<input type="number" min={0} value={f.cooldownSeconds} onChange={(e) => set("cooldownSeconds", Number(e.target.value))} /></label>
          <label>أقصى عدد في الساعة<input type="number" min={1} value={f.maxPerHour} onChange={(e) => set("maxPerHour", Number(e.target.value))} /></label>
          <label>المنطقة الزمنية<input dir="ltr" value={f.tz} onChange={(e) => set("tz", e.target.value)} /></label>
          <label className="sw"><input type="checkbox" checked={f.stopOnMatch} onChange={(e) => set("stopOnMatch", e.target.checked)} /> إذا اشتغل أوقف الفلوات اللي بعده</label>
        </div>
        <p className="hint">الفلو يتجاهل الرسائل الأقدم من وقت تفعيله. وفيه حد ثابت على الرسائل التلقائية لكل محادثة في الساعة عشان ما يدخل في حلقة مع بوت ثاني.</p>
      </section>

      {isMsg && (
        <section>
          <h4>جرّب قبل ما تفعّل</h4>
          <div className="grid2">
            <label>نص رسالة تجريبية<input value={sample.text} onChange={(e) => setSample({ ...sample, text: e.target.value })} /></label>
            <label>اسم المرسل<input value={sample.senderName} onChange={(e) => setSample({ ...sample, senderName: e.target.value })} /></label>
            <label className="sw" style={{ alignSelf: "end" }}><input type="checkbox" checked={useAi} onChange={(e) => setUseAi(e.target.checked)} disabled={!data.ai.configured} /> استدعِ Claude فعلاً (يحسب من استهلاكك)</label>
          </div>
          <button type="button" className="btn ghost" onClick={test} disabled={testing}>{testing ? "نجرب…" : "جرّب"}</button>
          {testError && <p className="err">{testError}</p>}
          {result && (
            <div className="result" style={{ marginTop: 12 }}>
              <p><strong className={result.matched ? "ok" : "err"}>{result.matched ? "الفلو بيشتغل على هذي الرسالة" : result.triggered ? "الشروط ما تحققت" : "المحفز ما ينطبق (اتجاه أو نوع محادثة)"}</strong></p>
              <ul>
                {result.conditions.map((c, i) => <li key={i} className={c.ok ? "ok" : "err"}>{c.ok ? "✓" : "✗"} {FIELD_LABEL[c.field] ?? c.field} {OP_LABEL[c.op] ?? c.op} {c.value ?? ""}{c.note ? ` (${c.note})` : ""}</li>)}
                {result.actions.map((a, i) => <li key={`a${i}`} className={a.ok ? "" : "err"}>{ACTION_LABEL[a.type as ActionType] ?? a.type}: {a.detail}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {error && <p className="err">{error}</p>}
      <div className="row">
        <button type="button" className="btn solid" onClick={() => onSave(f)} disabled={saving}>{saving ? "نحفظ…" : "احفظ الفلو"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>إغلاق</button>
        {f.id && <button type="button" className="btn ghost" onClick={() => onDelete(f)}>احذف</button>}
      </div>
    </div>
  );
}

function ActionFields({ a, onChange, defaultPrompt, aiOn, cheapModel }: { a: Action; onChange: (a: Action) => void; defaultPrompt: string; aiOn: boolean; cheapModel?: string }) {
  switch (a.type) {
    case "reply":
      return (
        <>
          <textarea aria-label="نص الرد" value={a.text} onChange={(e) => onChange({ ...a, text: e.target.value })} placeholder="نص الرد" />
          <label className="sw small"><input type="checkbox" checked={a.quote} onChange={(e) => onChange({ ...a, quote: e.target.checked })} /> اقتبس رسالته</label>
        </>
      );
    case "send":
      return (
        <>
          <input dir="ltr" aria-label="إلى" value={a.to} onChange={(e) => onChange({ ...a, to: e.target.value })} placeholder="me أو 966501234567" />
          <textarea aria-label="النص" value={a.text} onChange={(e) => onChange({ ...a, text: e.target.value })} placeholder="النص (تقدر تستخدم {{ai}} و{{text}})" />
        </>
      );
    case "react":
      return <input aria-label="الإيموجي" value={a.emoji} maxLength={8} style={{ width: 90 }} onChange={(e) => onChange({ ...a, emoji: e.target.value })} />;
    case "tag":
      return <input aria-label="الوسم" value={a.tag} maxLength={40} onChange={(e) => onChange({ ...a, tag: e.target.value })} placeholder="اسم الوسم" />;
    case "agent":
      return (
        <div>
          <textarea aria-label="تعليمات المهمة" value={a.prompt} onChange={(e) => onChange({ ...a, prompt: e.target.value })} placeholder="في فلو مجدول: اكتب المهمة هنا. في فلو الرسائل: تعليمات إضافية (اختياري)." />
          {cheapModel && (
            <label>المزود
              <select value={a.provider ?? ""} onChange={(e) => onChange({ ...a, provider: (e.target.value || undefined) as "claude" | "cheap" | undefined })}>
                <option value="">الافتراضي</option><option value="claude">Claude</option><option value="cheap">الرخيص ({cheapModel})</option>
              </select>
            </label>
          )}
          <label className="sw small"><input type="checkbox" checked={a.confirm} onChange={(e) => onChange({ ...a, confirm: e.target.checked })} /> اطلب تأكيدي (\"نعم\") قبل التنفيذ</label>
          <p className="hint">يستخدم الموصلات من صفحة قاعدة المعرفة. فقط رسائلك أنت (من رقمك) تُنفَّذ كمهام، ورد Claude يبدأ بـ 🤖 عشان ما يعيد نفسه.</p>
        </div>
      );
    case "webhook":
      return (
        <div className="grid2">
          <input dir="ltr" aria-label="الرابط" value={a.url} onChange={(e) => onChange({ ...a, url: e.target.value })} placeholder="https://…" />
          <select aria-label="الطريقة" value={a.method} onChange={(e) => onChange({ ...a, method: e.target.value as "POST" | "GET" })}><option>POST</option><option>GET</option></select>
        </div>
      );
    case "ai_reply":
    case "ai":
      return (
        <>
          {!aiOn && <p className="err small">أضف ANTHROPIC_API_KEY (أو مزود رخيص AI_COMPAT_*) في متغيرات فيرسل وأعد النشر.</p>}
          <textarea aria-label="تعليمات Claude" value={a.prompt} onChange={(e) => onChange({ ...a, prompt: e.target.value })} placeholder={a.type === "ai_reply" ? `تعليمات لـ Claude. اتركها فاضية لهذا الافتراضي:\n${defaultPrompt}` : "وش تبي من Claude؟ مثل: لخّص رسائل اليوم"} />
          <div className="grid2">
            <label>كم رسالة من المحادثة يقرأ<input type="number" min={1} max={60} value={a.context} onChange={(e) => onChange({ ...a, context: Number(e.target.value) })} /></label>
            {a.type === "ai" && (
              <label>يقرأ
                <select value={a.scope} onChange={(e) => onChange({ ...a, scope: e.target.value as "chat" | "recent" })}><option value="chat">المحادثة الحالية</option><option value="recent">كل المحادثات الأخيرة</option></select>
              </label>
            )}
            {a.type === "ai" && a.scope === "recent" && <label>آخر كم ساعة<input type="number" min={1} max={168} value={a.hours} onChange={(e) => onChange({ ...a, hours: Number(e.target.value) })} /></label>}
            <label>أقصى طول للجواب<input type="number" min={64} max={2000} value={a.maxTokens} onChange={(e) => onChange({ ...a, maxTokens: Number(e.target.value) })} /></label>
            {cheapModel && (
              <label>المزود
                <select value={a.provider ?? ""} onChange={(e) => onChange({ ...a, provider: (e.target.value || undefined) as "claude" | "cheap" | undefined })}>
                  <option value="">الافتراضي</option><option value="claude">Claude</option><option value="cheap">الرخيص ({cheapModel})</option>
                </select>
              </label>
            )}
            <label>موديل (اختياري)<input dir="ltr" value={a.model ?? ""} placeholder="الافتراضي" onChange={(e) => onChange({ ...a, model: e.target.value || undefined })} /></label>
          </div>
          {a.type === "ai_reply" && <label className="sw small"><input type="checkbox" checked={a.quote} onChange={(e) => onChange({ ...a, quote: e.target.checked })} /> اقتبس رسالته</label>}
          <p className="hint">{a.type === "ai_reply" ? "Claude يقرأ المحادثة وما يشوف فيها تعليمات، فنص الغرباء ما يقدر يغيّر قواعده. وإذا ما شاف رد مناسب يتجاهل الرسالة." : "الناتج يتخزن في {{ai}} وتستخدمه في أكشن بعده."}</p>
        </>
      );
    default:
      return null;
  }
}
