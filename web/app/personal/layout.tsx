"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { Mark } from "@/components/Mark";
import { SecretGate, forgetSecret, useApi, type Status } from "./shared";

const ICON = {
  overview: "M4 13h6V4H4v9zm0 7h6v-5H4v5zm10 0h6V11h-6v9zm0-16v5h6V4h-6z",
  inbox: "M4 5h16v11H8l-4 4V5z",
  flows: "M13 2L4 14h7l-1 8 9-12h-7l1-8z",
  knowledge: "M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3V4zm3 4h8M8 12h8",
  numbers: "M12 3a4 4 0 100 8 4 4 0 000-8zm-8 18a8 8 0 0116 0",
  fold: "M15 6l-6 6 6 6",
  down: "M6 9l6 6 6-6",
  guide: "M12 21a9 9 0 100-18 9 9 0 000 18zM9.5 9a2.5 2.5 0 114 2c-.8.6-1.5 1-1.5 2M12 17h.01",
  logout: "M15 17l5-5-5-5M20 12H9M12 21H5a2 2 0 01-2-2V5a2 2 0 012-2h7",
  bell: "M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
};

type Item = { href: string; label: string; icon: string };
// sections follow the Ziadah sidebar: a small muted title that folds, then the pages under it
const GROUPS: { id: string; label: string; items: Item[] }[] = [
  {
    id: "home",
    label: "الرئيسية",
    items: [
      { href: "/personal/overview", label: "نظرة عامة", icon: ICON.overview },
      { href: "/personal/inbox", label: "صندوق الوارد", icon: ICON.inbox },
    ],
  },
  {
    id: "auto",
    label: "الأتمتة",
    items: [
      { href: "/personal/flows", label: "الفلوات", icon: ICON.flows },
      { href: "/personal/knowledge", label: "قاعدة المعرفة", icon: ICON.knowledge },
    ],
  },
  { id: "account", label: "الحساب", items: [{ href: "/personal", label: "الأرقام والمفاتيح", icon: ICON.numbers }] },
];

const NAV_KEY = "whats-mcp-nav";
const GROUPS_KEY = "whats-mcp-nav-groups";
const THEME_KEY = "whats-mcp-theme";

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {}
};

function isActive(path: string, href: string) {
  return href === "/personal" ? path === href : path === href || path.startsWith(`${href}/`);
}

const Svg = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);

/** Light or dark, remembered on this device. Until the user picks one the page follows the system. */
function useTheme() {
  const [theme, setTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const saved = read(THEME_KEY);
    setTheme(saved === "dark" || saved === "light" ? saved : matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  const choose = (t: "light" | "dark") => {
    setTheme(t);
    write(THEME_KEY, t);
    document.documentElement.dataset.theme = t;
  };
  return [theme, choose] as const;
}

function Shell({ status, children }: { status: Status; children: ReactNode }) {
  const path = usePathname();
  const [theme, setTheme] = useTheme();
  const [mini, setMini] = useState(() => read(NAV_KEY) === "mini");
  const [shut, setShut] = useState<Record<string, boolean>>(() => {
    try {
      return JSON.parse(read(GROUPS_KEY) ?? "{}");
    } catch {
      return {};
    }
  });
  // same request and cache as the inbox, so the bell costs nothing extra
  const drafts = useApi<{ drafts: unknown[] }>("/api/personal/drafts", { poll: 30_000 });
  const pending = drafts.data?.drafts?.length ?? 0;

  const paired = status.accounts.filter((a) => a.paired).length;
  const who = status.accounts.find((a) => a.paired);
  const whoName = who?.name ?? who?.label ?? "";
  const here = GROUPS.flatMap((g) => g.items).find((it) => isActive(path, it.href));
  const sub = path.startsWith("/personal/flows/run") ? "تفاصيل التشغيل" : null;

  const toggleMini = () => {
    write(NAV_KEY, mini ? "full" : "mini");
    setMini(!mini);
  };
  const toggleGroup = (id: string) => {
    const next = { ...shut, [id]: !shut[id] };
    write(GROUPS_KEY, JSON.stringify(next));
    setShut(next);
  };

  return (
    <div className="app" data-nav={mini ? "mini" : "full"}>
      <aside className="app-side" aria-label="القائمة الجانبية">
        <div className="side-head">
          <Link className="mark" href="/" aria-label="واتساب MCP">
            <Mark />
            <span className="lbl">واتساب MCP</span>
          </Link>
          <button type="button" className="side-fold" onClick={toggleMini} aria-expanded={!mini} aria-label={mini ? "توسيع القائمة" : "تصغير القائمة"}>
            <Svg d={ICON.fold} />
          </button>
        </div>
        <nav className="app-nav" aria-label="أقسام لوحة التحكم">
          {GROUPS.map((g) => {
            const active = g.items.some((it) => isActive(path, it.href));
            // the section that holds the current page never folds shut
            const open = !shut[g.id] || active;
            return (
              <div className="nav-group" key={g.id}>
                <button type="button" className="nav-label" aria-expanded={open} disabled={active} onClick={() => toggleGroup(g.id)}>
                  <span>{g.label}</span>
                  <Svg d={ICON.down} />
                </button>
                <div className="nav-items" hidden={!open}>
                  {g.items.map((it) => (
                    <Link key={it.href} href={it.href} prefetch title={mini ? it.label : undefined} aria-current={isActive(path, it.href) ? "page" : undefined}>
                      <Svg d={it.icon} />
                      <span className="lbl">{it.label}</span>
                    </Link>
                  ))}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="app-foot">
          <div className="foot-status">
            <span className={`dot ${paired ? "on" : "off"}`} aria-hidden="true" />
            <span className="lbl">{paired ? `${paired} رقم مربوط` : "لا يوجد رقم مربوط"}</span>
            {status.flowsPaused && <span className="tag lbl">الفلوات متوقفة</span>}
          </div>
          <Link className="foot-link" href="/guide" title={mini ? "دليل الإعداد" : undefined}>
            <Svg d={ICON.guide} />
            <span className="lbl">دليل الإعداد</span>
          </Link>
          <button type="button" className="foot-link" onClick={forgetSecret} title={mini ? "تسجيل الخروج" : undefined}>
            <Svg d={ICON.logout} />
            <span className="lbl">تسجيل الخروج</span>
          </button>
        </div>
      </aside>
      <div className="app-col">
        <header className="app-top">
          <nav className="crumbs" aria-label="مسار الصفحة">
            <span>لوحة التحكم</span>
            {here && (
              <>
                <span className="sep" aria-hidden="true">/</span>
                <span aria-current={sub ? undefined : "page"}>{here.label}</span>
              </>
            )}
            {sub && (
              <>
                <span className="sep" aria-hidden="true">/</span>
                <span aria-current="page">{sub}</span>
              </>
            )}
          </nav>
          <div className="top-tools">
            <div className="theme" role="group" aria-label="المظهر">
              <button type="button" aria-pressed={theme === "light"} aria-label="مظهر فاتح" onClick={() => setTheme("light")}>
                <Svg d={ICON.sun} />
              </button>
              <button type="button" aria-pressed={theme === "dark"} aria-label="مظهر داكن" onClick={() => setTheme("dark")}>
                <Svg d={ICON.moon} />
              </button>
            </div>
            <Link className="bell" href="/personal/inbox" aria-label={pending ? `${pending} مسودة تنتظر موافقتك` : "لا توجد مسودات تنتظر موافقتك"}>
              <Svg d={ICON.bell} />
              {pending > 0 && <b>{pending > 9 ? "9+" : pending}</b>}
            </Link>
            <Link className="avatar" href="/personal" title={whoName || "الأرقام والمفاتيح"} aria-label={whoName ? `الحساب: ${whoName}` : "الأرقام والمفاتيح"}>
              {whoName ? [...whoName][0] : <Svg d={ICON.numbers} />}
            </Link>
          </div>
        </header>
        {/* keyed by route: each page enters with a short fade instead of swapping in place */}
        <main className="app-main">
          <div key={path} className="route">{children}</div>
        </main>
      </div>
    </div>
  );
}

export default function PersonalLayout({ children }: { children: ReactNode }) {
  return <SecretGate>{(_secret, status) => <Shell status={status}>{children}</Shell>}</SecretGate>;
}
