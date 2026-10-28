import type { Metadata } from "next";
import { Mark } from "@/components/Mark";

export const metadata: Metadata = { title: "الصفحة غير موجودة | واتساب MCP" };

// Any unknown path lands here instead of the framework's bare English 404.
export default function NotFound() {
  return (
    <div className="wrap">
      <header className="top">
        <a className="mark" href="/">
          <Mark />
          واتساب MCP
        </a>
        <nav aria-label="روابط">
          <a href="/guide">دليل الإعداد</a>
          <a className="btn solid" href="/personal">افتح النظام</a>
        </nav>
      </header>
      <main className="notfound">
        <p className="notfound-code" aria-hidden="true">404</p>
        <h1>ما لقينا هذي الصفحة</h1>
        <p className="intro">يمكن الرابط فيه حرف ناقص أو زايد. هذي أكثر الصفحات اللي يدورها الناس:</p>
        <div className="actions">
          <a className="btn solid" href="/personal">لوحة التحكم</a>
          <a className="btn ghost" href="/guide">دليل الإعداد</a>
          <a className="btn ghost" href="/">الصفحة الرئيسية</a>
        </div>
      </main>
    </div>
  );
}
