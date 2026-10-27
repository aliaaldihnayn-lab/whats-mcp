import { Mark } from "@/components/Mark";
import { Knowledge } from "./Knowledge";

export const dynamic = "force-dynamic";
export const metadata = { title: "قاعدة المعرفة", robots: { index: false } };

export default function Page() {
  return (
    <div className="wrap wide">
      <header className="top">
        <a className="mark" href="/">
          <Mark />
          واتساب MCP
        </a>
      </header>
      <main>
        <Knowledge />
      </main>
    </div>
  );
}
