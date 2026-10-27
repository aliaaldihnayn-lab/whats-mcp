import { Mark } from "@/components/Mark";
import { Flows } from "./Flows";

export const dynamic = "force-dynamic";
export const metadata = { title: "الفلوات", robots: { index: false } };

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
        <Flows />
      </main>
    </div>
  );
}
