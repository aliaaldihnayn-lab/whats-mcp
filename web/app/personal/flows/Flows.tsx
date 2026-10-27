"use client";

import { useState } from "react";
import type { Action, Cond, Flow } from "@/lib/flows/types";
import { call, errMsg, invalidate, useApi, useCopy, useSession } from "../shared";
import { FlowBuilder } from "./FlowBuilder";
import { ACTION_LABEL, PRESETS, blankFlow, type ActionType, type EF } from "./presets";

type Account = { id: string; label: string; kind: "personal" | "official" };
type Log = { t: number; account: string; accountLabel?: string; flow: string; name: string; chat: string; chatName?: string; text?: string; status: string; note?: string; actions: { type: string; ok: boolean; detail?: string }[] };
type Data = { flows: Flow[]; paused: boolean; ai: { configured: boolean; claude?: boolean; cheap?: boolean; cheapModel?: string; model: string; dailyCap: number; defaultPrompt: string }; accounts: Account[]; fields: string[]; ops: string[]; log: Log[] };

export function Flows() {
  const { secret } = useSession();
  return <App secret={secret} />;
}

const PROVIDER_NAME = "الذكاء الاصطناعي";

function App({ secret }: { secret: string }) {
  const api = useApi<Data>("/api/personal/flows", { fresh: 20_000 });
  const data = api.data;
  const [edit, setEdit] = useState<EF | null>(null);
  const [tab, setTab] = useState<"flows" | "log">("flows");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    invalidate("/api/personal/flows");
    await api.reload();
  };

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
    api.set((d) => ({ ...d!, flows: d!.flows.map((x) => (x.id === f.id ? { ...x, enabled: !f.enabled } : x)) }));
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

  if (!data)
    return api.error || error ? (
      <p className="err">{api.error || error}</p>
    ) : (
      <div style={{ display: "grid", gap: 12 }}>
        <div className="skel" style={{ height: 44 }} />
        <div className="skel" style={{ height: 260 }} />
      </div>
    );

  if (edit)
    return <FlowBuilder key={edit.id ?? edit.name + data.flows.length} secret={secret} data={data} value={edit} saving={saving} error={error} onSave={save} onDelete={remove} onCancel={() => setEdit(null)} />;

  return (
    <>
      <div className="chips">
        {!data.ai.configured && <a className="chip opt" href="/guide#s3">خطوات التفعيل</a>}
        <span className={`chip ${data.ai.configured ? "on" : "opt"}`}>{data.ai.configured ? `✓ ${[data.ai.claude && `Anthropic (${data.ai.model})`, data.ai.cheap && `متوافق مع OpenAI (${data.ai.cheapModel ?? "?"})`].filter(Boolean).join(" + ")} جاهز، حد يومي ${data.ai.dailyCap}` : `○ ${PROVIDER_NAME} غير مفعّل: أضف مفتاح Anthropic أو أي مزود متوافق مع OpenAI (AI_COMPAT_URL و AI_COMPAT_KEY و AI_COMPAT_MODEL) في فيرسل`}</span>
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
          <section>
            <div className="section-head">
              <h4>فلواتك</h4>
              <button type="button" className="btn solid small" onClick={() => setEdit(blankFlow())}>+ فلو جديد</button>
            </div>
            <div className="flowlist">
              {data.flows.map((f) => (
                <div key={f.id} className="flowrow">
                  <button type="button" className="flowitem" onClick={() => setEdit(toEF(f))}>
                    <strong>{f.name}</strong>
                    <span className="sub">
                      {f.trigger.type === "schedule" ? "جدول زمني" : f.trigger.chats === "group" ? "رسائل المجموعات" : f.trigger.chats === "both" ? "كل الرسائل" : "الرسائل الخاصة"} · {f.mode === "auto" ? "تلقائي" : f.mode === "approve" ? "مسودة" : "تجربة"} · {data.accounts.find((a) => a.id === f.account)?.label ?? (f.account === "*" ? "كل الأرقام" : f.account)}
                    </span>
                  </button>
                  <label className="sw small" title={f.enabled ? "مفعّل" : "متوقف"}><input type="checkbox" checked={f.enabled} onChange={() => toggle(f)} aria-label={`تفعيل ${f.name}`} /></label>
                </div>
              ))}
              {data.flows.length === 0 && <p className="empty">ما عندك فلوات بعد. ابدأ من قالب أو من فلو جديد.</p>}
            </div>
          </section>
          <section>
            <div className="section-head"><h4>ابدأ من قالب</h4></div>
            <div className="flowlist">
              {PRESETS.map((p) => (
                <button key={p.id} type="button" className="flowitem" onClick={() => setEdit(p.make())}>
                  <strong>{p.title}</strong>
                  <span className="sub">{p.hint}</span>
                </button>
              ))}
            </div>
          </section>
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
                {l.actions.map((a, j) => <div key={j} className={`small ${a.ok ? "muted" : "err"}`}>{a.type === "condition" ? "شرط" : ACTION_LABEL[a.type as ActionType] ?? a.type}: {a.detail}</div>)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
