"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";

const KEY = "whats-mcp-secret";

export function readSecret() {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export async function call<T = any>(secret: string, path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const r = await fetch(path, {
    method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
    headers: { Authorization: `Bearer ${secret}`, ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}) },
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d.error ?? `HTTP ${r.status}`);
  return d as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

export type Status = {
  accounts: { id: string; label: string; paired: boolean; me?: string; name?: string; lastSync: number | null; cachedChats: number }[];
  storage: boolean;
  ai: boolean;
  cron: boolean;
  official: boolean;
  flowsPaused: boolean;
};

/** Asks for MCP_SECRET once per tab, checks it against the server, then renders the page. */
export function SecretGate({ children }: { children: (secret: string, status: Status, reload: () => Promise<void>) => ReactNode }) {
  const [secret, setSecret] = useState("");
  const [input, setInput] = useState("");
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async (s: string) => {
    setBusy(true);
    setError("");
    try {
      const st = await call<Status>(s, "/api/personal/status");
      setStatus(st);
      setSecret(s);
      try {
        sessionStorage.setItem(KEY, s);
      } catch {}
    } catch (e) {
      setStatus(null);
      setSecret("");
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => {
    const s = readSecret();
    if (s) {
      setInput(s);
      void load(s);
    }
  }, [load]);

  if (status && secret) return <>{children(secret, status, () => load(secret))}</>;
  return (
    <form
      className="field panel"
      onSubmit={(e) => {
        e.preventDefault();
        void load(input.trim());
      }}
    >
      <label htmlFor="secret">كلمة السر (MCP_SECRET)</label>
      <div className="row">
        <input id="secret" type="password" dir="ltr" autoComplete="off" value={input} onChange={(e) => setInput(e.target.value)} required minLength={24} />
        <button className="btn solid" type="submit" disabled={busy}>
          {busy ? "…" : "افتح"}
        </button>
      </div>
      {error && <p className="err">{error}</p>}
    </form>
  );
}

export function Nav({ current }: { current: "link" | "inbox" | "flows" | "knowledge" }) {
  const items = [
    ["link", "/personal", "الأرقام والمفاتيح"],
    ["inbox", "/personal/inbox", "صندوق الوارد"],
    ["flows", "/personal/flows", "الفلوات"],
    ["knowledge", "/personal/knowledge", "قاعدة المعرفة"],
  ] as const;
  return (
    <nav className="tabs" aria-label="أقسام لوحة التحكم">
      {items.map(([id, href, label]) => (
        <a key={id} href={href} aria-current={current === id ? "page" : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}

export function useCopy() {
  const [done, setDone] = useState("");
  const copy = async (text: string, id = "x") => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(id);
      setTimeout(() => setDone(""), 1500);
    } catch {}
  };
  return { copied: done, copy };
}

export const when = (sec: number | null | undefined) => (sec ? new Date(sec * 1000).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" }) : "—");
export const phoneOf = (me?: string) => (me ? `+${me.split(":")[0].split("@")[0]}` : "");
