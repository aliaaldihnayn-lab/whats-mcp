import { Mark } from "@/components/Mark";
import { Inbox } from "./Inbox";

export const dynamic = "force-dynamic";
export const metadata = { title: "صندوق الوارد", robots: { index: false } };

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
        <Inbox />
      </main>
    </div>
  );
}
