"use client";

import { useEffect, useState } from "react";

/** Marks the guide section on screen in the sticky index, and offers a way back to the top on long scrolls. */
export function TocSpy() {
  const [far, setFar] = useState(false);

  useEffect(() => {
    const links = [...document.querySelectorAll<HTMLAnchorElement>(".toc a[href^='#']")];
    const heads = links.map((a) => document.getElementById(a.hash.slice(1))).filter((h): h is HTMLElement => !!h);
    const mark = () => {
      // the last heading that has scrolled above the middle of the screen is the section being read
      let current = "";
      for (const h of heads) if (h.getBoundingClientRect().top < innerHeight * 0.4) current = h.id;
      for (const a of links) {
        const on = a.hash === `#${current}`;
        if (on) a.setAttribute("aria-current", "true");
        else a.removeAttribute("aria-current");
        // keep the active pill visible in the phone's sideways-scrolling index
        if (on && a.parentElement && a.parentElement.scrollWidth > a.parentElement.clientWidth) a.scrollIntoView({ block: "nearest", inline: "center" });
      }
      setFar(scrollY > innerHeight * 1.5);
    };
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(mark);
    };
    mark();
    addEventListener("scroll", onScroll, { passive: true });
    return () => (removeEventListener("scroll", onScroll), cancelAnimationFrame(raf));
  }, []);

  return (
    <button type="button" className="to-top" hidden={!far} onClick={() => scrollTo({ top: 0 })} aria-label="ارجع لأعلى الصفحة">
      <svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>
    </button>
  );
}
